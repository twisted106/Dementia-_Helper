import { User, Heart, MessageSquare, Sparkles, Volume2 } from "lucide-react";

interface MemoryCardProps {
  visible: boolean;
  name: string;
  relation: string;
  lastContext: string;
  confidence?: number;
  summary?: string | null;
  isSummarizing?: boolean;
  onReplayAudio?: () => void;
}

const MemoryCard = ({ 
  visible, 
  name, 
  relation, 
  lastContext, 
  summary,
  isSummarizing,
  onReplayAudio
}: MemoryCardProps) => {
  if (!visible) return null;

  const displaySummary = summary || lastContext || "First conversation together. Speak naturally to build shared memories.";

  return (
    <div className="animate-glass-slide pointer-events-auto fixed right-4 top-5 z-30 w-84 md:right-8 md:top-8 md:w-96">
      {/* Obsidian Black Glassmorphic Panel with Pure White Text */}
      <div 
        className="glass-panel rounded-3xl p-6 transition-all duration-300 text-white"
        style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)" }}
      >
        {/* Header with Relation Glass Pill */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-inner text-white shadow-inner">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <span 
                className="text-[11px] font-extrabold uppercase tracking-widest text-white/80"
                style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)" }}
              >
                Identified Person
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                <span 
                  className="text-xs font-black tracking-wide"
                >
                  Active in Sight
                </span>
              </div>
            </div>
          </div>

          {/* Frosted Glass Relation Pill */}
          {relation && (
            <div 
              className="glass-pill flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
            >
              <Heart className="h-3.5 w-3.5 fill-rose-500/30 text-rose-600" />
              <span className="text-xs font-black tracking-wide">
                {relation}
              </span>
            </div>
          )}
        </div>

        {/* Person Name Heading */}
        <div className="mb-4 flex items-center justify-between">
          <h2 
            className="text-2xl font-black tracking-tight md:text-3xl"
          >
            {name || "Friend"}
          </h2>
          {onReplayAudio && (
            <button
              onClick={onReplayAudio}
              title="Replay Audio Whisper"
              className="glass-inner flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-900/10 transition-all duration-200"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Frosted Glass Summary Plate */}
        <div className="glass-inner mb-4 rounded-2xl p-4.5 shadow-inner">
          <div className="mb-2 flex items-center justify-between">
            <span 
              className="text-[11px] font-black uppercase tracking-wider opacity-90"
            >
              Memory & Context
            </span>
            {isSummarizing ? (
              <span 
                className="flex items-center gap-1 text-[11px] font-black text-amber-600 animate-pulse"
              >
                <Sparkles className="h-3 w-3 text-amber-600" />
                Updating Memory...
              </span>
            ) : (
              <span 
                className="text-[10px] font-bold opacity-60"
              >
                Cognitive Cue
              </span>
            )}
          </div>
          <p 
            className="text-sm md:text-base leading-relaxed font-medium"
          >
            {displaySummary}
          </p>
        </div>

        {/* Live Conversation State */}
        <div className="flex items-center justify-between text-xs text-white/80 pt-0.5 font-bold">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-white/70" />
            <span 
              className="text-white font-bold"
              style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)" }}
            >
              {isSummarizing ? "Extracting memory..." : "Connected & listening"}
            </span>
          </div>
          <span 
            className="text-[11px] text-white/60 font-semibold"
            style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)" }}
          >
            Auto-saves context
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryCard;
