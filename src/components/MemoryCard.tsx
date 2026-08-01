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
      <div className="glass-panel rounded-3xl p-6 transition-all duration-300">
        {/* Header with Relation Glass Pill */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-inner text-amber-300 shadow-inner">
              <User className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/90">
                Identified Person
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,166,35,0.6)]" />
                <span className="text-xs font-semibold text-amber-200/90 tracking-wide">
                  Active in Sight
                </span>
              </div>
            </div>
          </div>

          {/* Frosted Glass Relation Pill */}
          {relation && (
            <div className="glass-pill flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-secondary">
              <Heart className="h-3.5 w-3.5 fill-secondary/25 text-secondary" />
              <span className="text-xs font-bold tracking-wide text-orange-200">
                {relation}
              </span>
            </div>
          )}
        </div>

        {/* Person Name Heading */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl drop-shadow-sm">
            {name || "Friend"}
          </h2>
          {onReplayAudio && (
            <button
              onClick={onReplayAudio}
              title="Replay Audio Whisper"
              className="glass-inner flex h-9 w-9 items-center justify-center rounded-xl text-amber-300/80 hover:text-amber-200 hover:bg-white/10 transition-all duration-200"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Frosted Glass Summary Plate */}
        <div className="glass-inner mb-4 rounded-2xl p-4.5 shadow-inner">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90">
              Memory & Context
            </span>
            {isSummarizing ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-300 animate-pulse">
                <Sparkles className="h-3 w-3" />
                Updating...
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/70">
                Spoken after 30m break
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-foreground/95 font-normal">
            {displaySummary}
          </p>
        </div>

        {/* Live Conversation State */}
        <div className="flex items-center justify-between text-xs text-muted-foreground/90 pt-0.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-amber-400/80" />
            <span className="font-medium text-foreground/80">
              {isSummarizing ? "Saving memory..." : "Connected & listening"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground/70">
            Auto-saves on exit
          </span>
        </div>
      </div>
    </div>
  );
};

export default MemoryCard;
