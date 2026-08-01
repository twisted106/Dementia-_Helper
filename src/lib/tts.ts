/**
 * Robust Text-to-Speech (TTS) Voice Prompt Engine.
 * 
 * Provides gentle audio memory prompting into the user's glasses/earbuds.
 * - Primary: OpenAI TTS (alloy voice) via backend proxy.
 * - Instant Fallback: Browser Web Speech API (speechSynthesis).
 */

let currentAudio: HTMLAudioElement | null = null;
let isAudioUnlocked = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Initialize & cache voices
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const loadVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch {}
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;

  // Unlock audio on ANY user click/touch/keypress
  const unlockAudio = () => {
    if (isAudioUnlocked) return;
    isAudioUnlocked = true;

    try {
      window.speechSynthesis.resume();
      const dummy = new SpeechSynthesisUtterance(" ");
      dummy.volume = 0.01;
      window.speechSynthesis.speak(dummy);
    } catch {}

    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };

  window.addEventListener("click", unlockAudio);
  window.addEventListener("touchstart", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
}

export const unlockAudioContext = () => {
  isAudioUnlocked = true;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.resume();
    } catch {}
  }
};

export const speakMemoryContext = async (
  name: string,
  relation?: string | null,
  summary?: string | null
): Promise<void> => {
  const cleanName = (name || "").trim();
  const cleanRelation = (relation || "").trim();
  const cleanSummary = (summary || "").trim();

  if (!cleanName && !cleanRelation) return;

  // Build natural, warm sentence
  let spokenText = "";
  const hasValidRelation =
    cleanRelation &&
    cleanRelation.toLowerCase() !== "friend" &&
    cleanRelation.toLowerCase() !== "person";

  const hasSpecificSummary =
    cleanSummary &&
    cleanSummary !== "First meeting recorded." &&
    cleanSummary !== "First conversation together." &&
    cleanSummary !== "First meeting." &&
    cleanSummary.length > 5;

  if (hasValidRelation && hasSpecificSummary) {
    spokenText = `This is your ${cleanRelation}, ${cleanName}. In your last conversation: ${cleanSummary}`;
  } else if (hasValidRelation && !hasSpecificSummary) {
    spokenText = `This is your ${cleanRelation}, ${cleanName}.`;
  } else if (!hasValidRelation && hasSpecificSummary) {
    spokenText = `This is ${cleanName}. In your last conversation: ${cleanSummary}`;
  } else {
    spokenText = `This is ${cleanName || "a friend"}.`;
  }

  // Stop any currently playing audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio = null;
    } catch {}
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  console.log("[TTS] Speaking memory cue:", spokenText);

  // Helper for Web Speech API fallback
  const fallbackToSpeechSynthesis = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.80; // Slower, unhurried pacing for elderly listeners
      utterance.pitch = 0.90; // Mellow, warm lower resonance
      utterance.volume = 0.95; // Clear, comfortable listening level

      const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
      
      // 1. Try to find a native Indian voice for flawless pronunciation of Indian names
      const indianVoice = voices.find(v => v.lang === "en-IN" || v.lang === "hi-IN" || v.name.includes("India"));
      
      // 2. Fallback to generic high-quality natural voices
      const naturalVoice = indianVoice || voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Ryan") ||
            v.name.includes("Guy") ||
            v.name.includes("Google") ||
            v.name.includes("Daniel") ||
            v.name.includes("Samantha") ||
            v.name.includes("Alex") ||
            v.name.includes("David"))
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      window.speechSynthesis.speak(utterance);
    } catch (synthErr) {
      console.error("[TTS] Speech synthesis error:", synthErr);
    }
  };

  // Pre-check for Indian voice to bypass cloud TTS and get native pronunciation
  const voices = cachedVoices.length > 0 ? cachedVoices : (typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
  const hasNativeIndianVoice = voices.some(v => v.lang === "en-IN" || v.lang === "hi-IN" || v.name.includes("India"));

  if (hasNativeIndianVoice) {
    console.log("[TTS] Native Indian voice found! Bypassing cloud TTS for perfect pronunciation.");
    fallbackToSpeechSynthesis();
    return;
  }

  // Try backend proxy OpenAI TTS
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: spokenText }),
    });

    if (response.ok) {
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.playbackRate = 0.82; // Slower, unhurried speech for elderly listeners
      audio.volume = 1.0;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
      };

      try {
        await audio.play();
        return;
      } catch (playErr) {
        console.warn("[TTS] Audio element play failed (autoplay restriction), falling back to SpeechSynthesis:", playErr);
        fallbackToSpeechSynthesis();
        return;
      }
    } else {
      console.warn("[TTS] Server TTS returned status", response.status, "falling back to SpeechSynthesis");
      fallbackToSpeechSynthesis();
    }
  } catch (err) {
    console.warn("[TTS] Server TTS fetch failed, falling back to SpeechSynthesis:", err);
    fallbackToSpeechSynthesis();
  }
};
