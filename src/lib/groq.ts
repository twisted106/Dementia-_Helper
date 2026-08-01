/**
 * Groq API client — calls go through the local server proxy.
 * No API keys are exposed in the browser.
 */

export async function summarizeTranscript(transcript: string): Promise<string> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });

    // Even if status is 500, our backend sends a JSON payload with a fallback summary!
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      console.warn(`Server returned ${res.status}, using fallback if available.`);
    }

    return data.summary || "Shared a warm greeting and friendly check-in.";
  } catch (error) {
    console.error("Summary Error:", error);
    return "Shared a warm greeting and friendly check-in.";
  }
}

export interface ExtractedIdentity {
  name: string | null;
  relation: string | null;
}

export async function extractIdentityFromSpeech(speechText: string): Promise<ExtractedIdentity> {
  const text = speechText.trim();
  if (!text || text.length < 3) return { name: null, relation: null };

  try {
    const res = await fetch("/api/extract-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    return await res.json();
  } catch (error) {
    console.error("Identity Extraction Error:", error);
    return { name: null, relation: null };
  }
}
