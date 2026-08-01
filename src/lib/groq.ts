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

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const data = await res.json();
    return data.summary || "No summary generated.";
  } catch (error) {
    console.error("Summary Error:", error);
    throw error;
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
