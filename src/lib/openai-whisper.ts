import OpenAI from "openai";

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

export const openai = new OpenAI({
  apiKey: apiKey || "",
  dangerouslyAllowBrowser: true,
});

/**
 * Transcribes an audio Blob (webm/wav/mp4) using OpenAI Whisper (whisper-1) model.
 */
export async function transcribeAudioWithWhisper(audioBlob: Blob): Promise<string> {
  if (!apiKey) {
    console.error("OpenAI API key is missing in .env (VITE_OPENAI_API_KEY)");
    return "";
  }

  try {
    const file = new File([audioBlob], "speech.webm", { type: audioBlob.type || "audio/webm" });

    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en",
      temperature: 0.2,
      prompt: "My name is Harshit Gupta. I am your son. I am your doctor. Second Sight memory assistant.",
    });

    return response.text || "";
  } catch (error) {
    console.error("OpenAI Whisper Transcription Error:", error);
    return "";
  }
}
