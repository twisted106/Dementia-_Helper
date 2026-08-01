import { useState, useEffect, useRef, useCallback } from "react";
import VisionLayer from "@/components/VisionLayer";
import MemoryCard from "@/components/MemoryCard";
import LiveSubtitles from "@/components/LiveSubtitles";
import { useToast } from "@/hooks/use-toast";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { summarizeTranscript, extractIdentityFromSpeech } from "@/lib/groq";
import { speakMemoryContext } from "@/lib/tts";
import { 
  searchFaceInDatabase, 
  saveOrUpdateProfile, 
  updateProfileSummary,
  updateProfileRelation, 
  MatchedProfile 
} from "@/lib/supabase";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

const Index = () => {
  const [activeProfile, setActiveProfile] = useState<MatchedProfile | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [currentSummary, setCurrentSummary] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);

  // Live References
  const currentFaceDescriptorRef = useRef<Float32Array | null>(null);
  const activeProfileRef = useRef<MatchedProfile | null>(null);
  const isQueryingDbRef = useRef(false);
  const lastQueryTimeRef = useRef(0);
  const spokenInCurrentVisitRef = useRef<Set<string>>(new Set());
  
  // Timers & State Tracking
  const faceAbsenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechSilenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nameTriggerDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const currentConversationTranscriptRef = useRef<string>("");
  const lastSummarizedTranscriptRef = useRef<string>("");

  // Keep activeProfileRef in sync with state
  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);

  const { toast } = useToast();
  const speech = useSpeechRecognition();

  // Auto-start microphone listening on mount
  useEffect(() => {
    if (speech.isSupported && !speech.isListening) {
      speech.start();
    }
  }, [speech.isSupported]);

  // Silent Background Summarizer (updates memory card box without intrusive popups)
  const runSummarization = useCallback(async (profileName: string, transcript: string) => {
    const textToSummarize = transcript.trim();
    if (!textToSummarize || textToSummarize === lastSummarizedTranscriptRef.current || textToSummarize.length < 20) {
      return;
    }

    lastSummarizedTranscriptRef.current = textToSummarize;
    setIsSummarizing(true);
    console.log(`[Auto-Summarizer] Summarizing conversation for ${profileName}...`);

    try {
      const summary = await summarizeTranscript(textToSummarize);
      console.log(`[Auto-Summarizer] Memory generated:`, summary);

      setCurrentSummary(summary);
      setActiveProfile((prev) => prev ? { ...prev, last_summary: summary } : null);

      if (activeProfileRef.current?.id || activeProfileRef.current?.name) {
        await updateProfileSummary(activeProfileRef.current.id || activeProfileRef.current.name, summary);
      }
    } catch (err) {
      console.error("Auto-summarization failed:", err);
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  // Handle Real-Time Face ID Vector Detection
  const handleFaceDetected = useCallback(async (descriptor: Float32Array | null) => {
    if (!descriptor) {
      currentFaceDescriptorRef.current = null;

      // Person walked out of camera frame (> 2.5s absence)
      if (activeProfileRef.current && !faceAbsenceTimerRef.current) {
        faceAbsenceTimerRef.current = setTimeout(() => {
          const departingProfile = activeProfileRef.current;
          const transcriptToSummarize = currentConversationTranscriptRef.current;

          if (departingProfile) {
            runSummarization(departingProfile.name, transcriptToSummarize);
            const personKey = departingProfile.id || departingProfile.name;
            localStorage.setItem(`left_${personKey}`, String(Date.now()));
            spokenInCurrentVisitRef.current.delete(personKey);
          }

          setActiveProfile(null);
          setShowCard(false);
          currentConversationTranscriptRef.current = "";
          lastSummarizedTranscriptRef.current = "";
          faceAbsenceTimerRef.current = null;
        }, 2500);
      }
      return;
    }

    // Face is in frame
    currentFaceDescriptorRef.current = descriptor;

    if (faceAbsenceTimerRef.current) {
      clearTimeout(faceAbsenceTimerRef.current);
      faceAbsenceTimerRef.current = null;
    }

    // Throttle queries to Supabase database (350ms for near-instant recognition)
    const now = Date.now();
    if (isQueryingDbRef.current || (now - lastQueryTimeRef.current < 350)) {
      return;
    }

    isQueryingDbRef.current = true;
    lastQueryTimeRef.current = now;

    try {
      const matched = await searchFaceInDatabase(descriptor);

      if (matched) {
        const personKey = matched.id || matched.name;
        const lastLeftTimestamp = Number(localStorage.getItem(`left_${personKey}`) || 0);
        const timeAway = lastLeftTimestamp > 0 ? (now - lastLeftTimestamp) : Infinity;
        const hasSpokenThisVisit = spokenInCurrentVisitRef.current.has(personKey);

        // Speak when person enters for the first time OR if absent for 30+ minutes
        if (!hasSpokenThisVisit && timeAway >= THIRTY_MINUTES_MS) {
          console.log(`[Audio Memory] Person ${matched.name} entered (away ${timeAway === Infinity ? "first time" : Math.round(timeAway / 60000) + "m"}). Triggering whisper...`);
          spokenInCurrentVisitRef.current.add(personKey);
          speakMemoryContext(matched.name, matched.relation, matched.last_summary);
        }

        if (!activeProfileRef.current) {
          setActiveProfile(matched);
          setShowCard(true);
          setCurrentSummary(matched.last_summary || null);
        } else if (activeProfileRef.current.id !== matched.id && (matched.distance ?? 1) < 0.38) {
          setActiveProfile(matched);
          setShowCard(true);
          setCurrentSummary(matched.last_summary || null);
        }
      }
    } catch (err) {
      console.error("Face database search error:", err);
    } finally {
      isQueryingDbRef.current = false;
    }
  }, [runSummarization]);

  // Known quick-match relations for instant (<1ms) detection
  const COMMON_RELATIONS = [
    "son", "daughter", "doctor", "brother", "sister", "friend", "father", "mother",
    "wife", "husband", "nurse", "caregiver", "grandson", "granddaughter", "uncle",
    "aunt", "nephew", "niece", "colleague", "neighbor", "therapist", "grandpa", "grandma"
  ];

  // Speech Transcript Monitoring: Instant Real-Time Updates & Silence Summarization
  useEffect(() => {
    const fullTranscript = (speech.transcript + " " + speech.interimTranscript).trim();
    if (!fullTranscript) return;

    currentConversationTranscriptRef.current = fullTranscript;

    // Condition 2: Person stops talking (Silence > 4.0s) -> Silent Auto-Summarize to Box
    if (speechSilenceTimerRef.current) {
      clearTimeout(speechSilenceTimerRef.current);
    }
    speechSilenceTimerRef.current = setTimeout(() => {
      if (activeProfileRef.current && currentConversationTranscriptRef.current.length > 25) {
        runSummarization(activeProfileRef.current.name, currentConversationTranscriptRef.current);
      }
    }, 4000);

    const activeSpeech = (speech.interimTranscript || speech.latestSentence || fullTranscript.slice(-80)).toLowerCase();

    // 1. INSTANT ZERO-LATENCY RELATION MATCHING (<1ms local evaluation)
    for (const rel of COMMON_RELATIONS) {
      if (
        activeSpeech.includes(`i am your ${rel}`) ||
        activeSpeech.includes(`i'm your ${rel}`) ||
        activeSpeech.includes(`your ${rel}`) ||
        activeSpeech.includes(`relation is ${rel}`) ||
        activeSpeech.includes(`i am the ${rel}`)
      ) {
        const titleRelation = rel.charAt(0).toUpperCase() + rel.slice(1);
        if (activeProfileRef.current?.relation !== titleRelation) {
          console.log("[Instant Relation Match]:", titleRelation);
          setActiveProfile((prev) => {
            if (prev) return { ...prev, relation: titleRelation };
            return { name: "Person", relation: titleRelation, last_summary: "First meeting." };
          });
          setShowCard(true);

          if (activeProfileRef.current?.id || activeProfileRef.current?.name) {
            updateProfileRelation(activeProfileRef.current.id || activeProfileRef.current.name, titleRelation);
          }
        }
        break;
      }
    }

    // 2. TRIGGER-BASED IDENTITY EXTRACTION (Name & Relation)
    const hasIntroductionTrigger =
      activeSpeech.includes("my name is") ||
      activeSpeech.includes("i am ") ||
      activeSpeech.includes("i'm ") ||
      activeSpeech.includes("this is ") ||
      activeSpeech.includes("call me ") ||
      activeSpeech.includes("your son") ||
      activeSpeech.includes("your daughter") ||
      activeSpeech.includes("your doctor") ||
      activeSpeech.includes("your brother") ||
      activeSpeech.includes("your sister") ||
      activeSpeech.includes("your friend");

    if (!hasIntroductionTrigger) return;

    if (nameTriggerDebounceRef.current) {
      clearTimeout(nameTriggerDebounceRef.current);
    }

    nameTriggerDebounceRef.current = setTimeout(async () => {
      const sentenceToAnalyze = speech.latestSentence || activeSpeech;
      const { name: newName, relation: newRelation } = await extractIdentityFromSpeech(sentenceToAnalyze);

      if (newRelation && activeProfileRef.current?.relation !== newRelation) {
        setActiveProfile((prev) => {
          if (prev) return { ...prev, relation: newRelation };
          return { name: "Person", relation: newRelation, last_summary: "First meeting." };
        });
        setShowCard(true);

        if (activeProfileRef.current?.id || activeProfileRef.current?.name) {
          updateProfileRelation(activeProfileRef.current.id || activeProfileRef.current.name, newRelation);
        }
      }

      if (newName && currentFaceDescriptorRef.current) {
        const finalRelation = newRelation || activeProfileRef.current?.relation || "Friend";

        setActiveProfile((prev) => ({
          id: prev?.id,
          name: newName,
          relation: finalRelation,
          last_summary: prev?.last_summary || "First meeting recorded.",
        }));
        setShowCard(true);

        try {
          const savedProfile = await saveOrUpdateProfile(
            activeProfileRef.current,
            currentFaceDescriptorRef.current,
            newName,
            finalRelation
          );
          if (savedProfile) {
            setActiveProfile(savedProfile);
            toast({
              title: "Identity Saved",
              description: `${newName} (${finalRelation}) is now recorded.`,
            });
          }
        } catch (err) {
          console.error("Failed to update profile name:", err);
        }
      }
    }, 400);
  }, [speech.transcript, speech.interimTranscript, speech.latestSentence, runSummarization, toast]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <VisionLayer onFaceDetected={handleFaceDetected} />

      {/* Frosted Glass Memory Card Plate */}
      <MemoryCard
        visible={showCard && !!activeProfile}
        name={activeProfile?.name || ""}
        relation={activeProfile?.relation || ""}
        lastContext={currentSummary || activeProfile?.last_summary || "First conversation together."}
        summary={currentSummary}
        isSummarizing={isSummarizing}
        onReplayAudio={() => {
          if (activeProfile?.name) {
            speakMemoryContext(
              activeProfile.name,
              activeProfile.relation,
              currentSummary || activeProfile.last_summary
            );
          }
        }}
      />

      {/* Frosted Glass Live Speech-to-Text Plate */}
      <LiveSubtitles
        visible={true}
        transcript={speech.transcript}
        interimTranscript={speech.interimTranscript}
        isListening={speech.isListening}
        isSupported={speech.isSupported}
      />

      {/* Frosted Glass Floating Mic & Audio Controls */}
      <div className="pointer-events-auto fixed bottom-7 right-7 z-40 flex items-center gap-2.5">
        {activeProfile?.name && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              speakMemoryContext(
                activeProfile.name,
                activeProfile.relation,
                currentSummary || activeProfile.last_summary
              );
            }}
            className="glass-button gap-2 rounded-2xl text-amber-300 hover:text-amber-100 text-xs font-semibold px-3.5 py-2.5"
            title="Hear Audio Memory Cue"
          >
            <Volume2 className="h-4 w-4 text-amber-400" />
            <span>Hear Whisper</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (speech.isListening) {
              speech.stop();
            } else {
              speech.start();
            }
          }}
          className={`glass-button gap-2.5 rounded-2xl transition-all duration-300 text-xs font-semibold px-4 py-2.5 ${
            speech.isListening 
              ? "text-amber-300 shadow-[0_0_15px_rgba(245,166,35,0.2)]" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {speech.isListening ? <Mic className="h-4 w-4 text-amber-400" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
          {speech.isListening ? "Listening" : "Muted"}
        </Button>
      </div>
    </div>
  );
};

export default Index;
