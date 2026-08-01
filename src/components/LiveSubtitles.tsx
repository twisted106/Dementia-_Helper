import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";

interface LiveSubtitlesProps {
  visible: boolean;
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
}

const LiveSubtitles = ({
  visible,
  transcript,
  interimTranscript,
  isListening,
  isSupported,
}: LiveSubtitlesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  if (!visible) return null;

  const hasContent = transcript.trim().length > 0;
  const isProcessing = interimTranscript.trim().length > 0;

  return (
    <div className="animate-glass-in pointer-events-none fixed bottom-7 left-1/2 z-30 w-[92%] max-w-2xl -translate-x-1/2 md:bottom-9">
      <div className="glass-panel rounded-3xl px-6 py-5 transition-all duration-300">
        {/* Header Bar */}
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 items-center justify-center rounded-xl glass-inner ${isListening ? "text-amber-300" : "text-muted-foreground"}`}>
              {isListening ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </div>
            <span className="text-xs font-semibold text-muted-foreground/90 tracking-wide">
              {!isSupported
                ? "Microphone not supported"
                : isListening
                ? "Live Speech Transcription"
                : "Microphone Paused"}
            </span>
          </div>

          {isListening && (
            <div className="glass-pill-amber flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(245,166,35,0.8)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">
                Live
              </span>
            </div>
          )}
        </div>

        {/* Written Subtitles Area */}
        <div 
          ref={containerRef}
          className="max-h-28 overflow-y-auto pr-1 text-base leading-relaxed text-foreground font-medium scroll-smooth md:text-lg drop-shadow-sm"
        >
          {hasContent || isProcessing ? (
            <>
              <span>{transcript}</span>
              {transcript && interimTranscript ? " " : ""}
              <span className="text-amber-300 font-semibold">{interimTranscript}</span>
              {isListening && (
                <span className="ml-1 inline-block h-4 w-0.5 bg-amber-300 align-middle animate-pulse" />
              )}
            </>
          ) : (
            <span className="text-muted-foreground/60 italic text-sm">
              {isListening ? "Listening continuously... speak anytime" : "Microphone is muted"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveSubtitles;
