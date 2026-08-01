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
      {/* Glassmorphic Panel with Inherited Dark Text */}
      <div 
        className="glass-panel rounded-3xl px-6 py-5 transition-all duration-300"
      >
        {/* Header Bar */}
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-7 w-7 items-center justify-center rounded-xl glass-inner ${isListening ? "opacity-100" : "opacity-50"}`}>
              {isListening ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4 opacity-50" />
              )}
            </div>
            <span 
              className="text-xs font-bold opacity-90 tracking-wide"
            >
              Live Subtitles
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isProcessing && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
            <span 
              className="text-[10px] font-semibold uppercase tracking-wider opacity-60"
            >
              {isSupported ? (isListening ? "Active" : "Paused") : "Not Supported"}
            </span>
          </div>
        </div>

        {/* Written Subtitles Area */}
        <div 
          ref={containerRef}
          className="relative max-h-[140px] min-h-[60px] overflow-y-auto pr-2 scroll-smooth"
          style={{ scrollbarWidth: "none" }}
        >
          {hasContent || isProcessing ? (
            <>
              <span className="font-medium">{transcript}</span>
              {transcript && interimTranscript ? " " : ""}
              <span className="font-bold underline decoration-slate-900/40">{interimTranscript}</span>
              {isListening && (
                <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-slate-900/70" />
              )}
            </>
          ) : (
            <span className="opacity-50 italic">
              {isListening ? "Listening for speech..." : "Microphone is muted"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveSubtitles;
