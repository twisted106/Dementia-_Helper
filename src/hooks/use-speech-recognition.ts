import { useEffect, useRef, useState, useCallback } from "react";

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionResult {
  transcript: string;
  interimTranscript: string;
  latestSentence: string;
  isListening: boolean;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  resetTranscript: () => void;
}

/**
 * Ultra-Low-Latency Raw PCM Deepgram Speech Recognition.
 * 
 * Streams uncompressed Linear PCM16 audio packets directly from Web Audio API (~40ms packets).
 * - Instant zero-lag word-by-word transcription as words leave the speaker's mouth.
 * - No WebM container header corruption or disconnect loops.
 * - Automatically keeps microphone hardware active without dropping on pauses.
 */
export function useSpeechRecognition(
  _options: UseSpeechRecognitionOptions = {}
): SpeechRecognitionResult {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [latestSentence, setLatestSentence] = useState("");
  const [isListening, setIsListening] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalizedTextRef = useRef("");
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const isExplicitlyStoppedRef = useRef(false);
  const isConnectingRef = useRef(false);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof (window.AudioContext || (window as any).webkitAudioContext) !== "undefined";

  const cleanupAudioPipeline = () => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      } catch {}
      processorRef.current = null;
    }

    if (sourceNodeRef.current) {
      try { sourceNodeNode: sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
  };

  const connect = useCallback(async () => {
    if (isExplicitlyStoppedRef.current || isConnectingRef.current) return;
    isConnectingRef.current = true;

    try {
      // 1. Get or reuse Microphone MediaStream
      if (!streamRef.current || !streamRef.current.active) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }
      const stream = streamRef.current;

      // 2. Initialize AudioContext for Raw PCM streaming
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const sampleRate = audioCtx.sampleRate || 48000;

      // 3. Connect to WebSocket Proxy with exact sample rate
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/deepgram?sample_rate=${sampleRate}`;

      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.onerror = null;
          wsRef.current.close();
        } catch {}
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[Speech] Live PCM stream connected (${sampleRate}Hz)`);
        setIsListening(true);
        isConnectingRef.current = false;

        // Clean up previous audio nodes
        cleanupAudioPipeline();

        try {
          // Create 2048-sample buffer processor (~42ms packet latency)
          const source = audioCtx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;

          const processor = audioCtx.createScriptProcessor(2048, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            ws.send(pcm16.buffer);
          };

          // Mute output node so user doesn't hear microphone feedback echo
          const muteGain = audioCtx.createGain();
          muteGain.gain.value = 0;

          source.connect(processor);
          processor.connect(muteGain);
          muteGain.connect(audioCtx.destination);
        } catch (audioErr) {
          console.error("[Speech] Audio processing error:", audioErr);
        }

        // Heartbeat KeepAlive
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        keepAliveRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.channel?.alternatives?.[0]) return;

          const text = data.channel.alternatives[0].transcript || "";
          if (!text.trim()) return;

          if (data.is_final) {
            finalizedTextRef.current = (
              finalizedTextRef.current + " " + text
            ).trim();
            setTranscript(finalizedTextRef.current);
            setInterimTranscript("");
            setLatestSentence(text.trim());
          } else {
            setInterimTranscript(text);
            setLatestSentence(text.trim());
          }
        } catch {}
      };

      ws.onerror = (err) => {
        console.warn("[Speech] WebSocket notice:", err);
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        cleanupAudioPipeline();

        if (keepAliveRef.current) {
          clearInterval(keepAliveRef.current);
          keepAliveRef.current = null;
        }

        if (!isExplicitlyStoppedRef.current) {
          console.log("[Speech] Auto-reconnecting live stream...");
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 300);
        } else {
          setIsListening(false);
        }
      };
    } catch (err) {
      console.error("[Speech] Connection error:", err);
      isConnectingRef.current = false;
      cleanupAudioPipeline();

      if (!isExplicitlyStoppedRef.current) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 1500);
      } else {
        setIsListening(false);
      }
    }
  }, []);

  const start = useCallback(() => {
    isExplicitlyStoppedRef.current = false;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    connect();
  }, [connect]);

  const stop = useCallback(() => {
    isExplicitlyStoppedRef.current = true;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    cleanupAudioPipeline();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }

    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalizedTextRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setLatestSentence("");
  }, []);

  useEffect(() => {
    return () => {
      isExplicitlyStoppedRef.current = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      cleanupAudioPipeline();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try { audioContextRef.current.close(); } catch {}
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
      }
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    latestSentence,
    isListening,
    isSupported,
    start,
    stop,
    resetTranscript,
  };
}
