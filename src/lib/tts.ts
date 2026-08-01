/**
 * Robust Text-to-Speech (TTS) Voice Prompt Engine.
 * 
 * Provides gentle audio memory prompting into the user's glasses/earbuds.
 * - Primary: OpenAI TTS (alloy voice) via backend proxy.
 * - Instant Fallback: Browser Web Speech API (speechSynthesis).
 */

let currentAudio: HTMLAudioElement | null = null;
let isAudioUnlocked = false;

// Unlock audio context on first user interaction
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    if (isAudioUnlocked) return;
    isAudioUnlocked = true;

    // Wake up Web Speech API
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      const dummy = new SpeechSynthesisUtterance("");
      dummy.volume = 0;
      window.speechSynthesis.speak(dummy);
    }

    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };

  window.addEventListener("click", unlockAudio);
  window.addEventListener("touchstart", unlockAudio);
  window.addEventListener("keydown", unlockAudio);
}

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
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.92; // Gentle pacing
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Karen") ||
            v.name.includes("Daniel") ||
            v.name.includes("Alex"))
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      window.speechSynthesis.speak(utterance);
    } catch (synthErr) {
      console.error("[TTS] Speech synthesis error:", synthErr);
    }
  };

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
      audio.volume = 0.95;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
      };

      try {
        await audio.play();
        return;
      } catch (playErr) {
        console.warn("[TTS] Audio.play blocked or failed, using SpeechSynthesis fallback:", playErr);
        fallbackToSpeechSynthesis();
        return;
      }
    } else {
      console.warn("[TTS] Server returned non-200, using SpeechSynthesis fallback");
      fallbackToSpeechSynthesis();
    }
  } catch (err) {
    console.warn("[TTS] Server TTS fetch failed, using SpeechSynthesis fallback:", err);
    fallbackToSpeechSynthesis();
  }
};
