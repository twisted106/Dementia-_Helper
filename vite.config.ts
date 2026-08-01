import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage, ServerResponse } from "http";
import { config as dotenvConfig } from "dotenv";
import { WebSocketServer, WebSocket as WSClient } from "ws";

// Load ALL .env vars into process.env (including non-VITE_ ones for server use)
dotenvConfig();

/**
 * Server-side API plugin.
 * All sensitive API calls (Groq, Deepgram, OpenAI) happen here on the server.
 * The browser NEVER sees any API keys.
 */
function apiServerPlugin(): PluginOption {
  const wss = new WebSocketServer({ noServer: true });

  return {
    name: "api-server",
    configureServer(server) {
      // Helper: read JSON body from request
      const readBody = (req: IncomingMessage): Promise<any> =>
        new Promise((resolve) => {
          let data = "";
          req.on("data", (chunk: string) => (data += chunk));
          req.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({});
            }
          });
        });

      // ── HTTP API routes ──
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // POST /api/summarize
        if (req.url === "/api/summarize" && req.method === "POST") {
          try {
            const { transcript } = await readBody(req);
            const Groq = (await import("groq-sdk")).default;
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

            const response = await groq.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content: `You are an AR cognitive memory assistant for smart glasses worn by someone needing memory assistance.
Extract ONLY tangible, high-value, actionable memory points that genuinely count for the wearer:

PRIORITIZE:
1. Object Locations & Physical Cues: Where important items were placed or mentioned (e.g. "Keys placed on the kitchen counter", "Medicine in the top drawer", "Glasses on the nightstand").
2. Actionable Plans & Commitments: Specific promises, appointments, or schedules (e.g. "Doctor appointment Friday at 10 AM", "She is bringing groceries tomorrow evening").
3. Core Emotional Moments & Key Topics: Meaningful personal moments, family news, or specific stories discussed (e.g. "Talked about grandson Leo's soccer trophy", "He felt very proud of his new work").
4. Caregiver Instructions: Health reminders or precautions mentioned.

STRICT RULES:
- DO NOT output generic small-talk summaries (avoid "They exchanged greetings and asked how each other was doing").
- Write 1 to 2 concise, reassuring, direct sentences (max 35 words).
- If the conversation was purely conversational pleasantries with no key facts, output: "Shared a warm greeting and friendly check-in."`,
                },
                { role: "user", content: transcript },
              ],
              model: "llama-3.3-70b-versatile",
              temperature: 0.1,
            });

            const summary = response.choices[0]?.message?.content?.trim() || "Shared a warm greeting and friendly check-in.";
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ summary }));
          } catch (err: any) {
            console.error("[API] Summarize error:", err?.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Summarization failed" }));
          }
          return;
        }

        // POST /api/extract-identity
        if (req.url === "/api/extract-identity" && req.method === "POST") {
          try {
            const { text } = await readBody(req);
            if (!text || text.trim().length < 3) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ name: null, relation: null }));
              return;
            }

            const Groq = (await import("groq-sdk")).default;
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

            const response = await groq.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content: `You are an entity extraction engine for an AR memory assistant.
Analyze the user's spoken sentence and extract:
1. "name": The person's actual name ONLY (strictly format: First [Middle] Last, maximum 3 words, capitalized). If no name was introduced, return null.
2. "relation": The relationship mentioned (e.g., "Son", "Doctor", "Daughter", "Father", "Mother", "Wife", "Husband", "Friend", "Brother", "Sister", "Colleague", "Neighbor", "Uncle", "Aunt"). If no relation was mentioned, return null.

Return ONLY valid JSON: {"name": string | null, "relation": string | null}`,
                },
                { role: "user", content: text },
              ],
              model: "llama-3.3-70b-versatile",
              response_format: { type: "json_object" },
              temperature: 0.0,
            });

            const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

            // Strict name sanitization
            let cleanName: string | null = null;
            if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
              const words = parsed.name.trim().split(/\s+/).filter((w: string) => /^[A-Za-z]+$/.test(w));
              if (words.length >= 1 && words.length <= 3) {
                cleanName = words.map((w: string) => String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase()).join(" ");
              }
            }

            let cleanRelation: string | null = null;
            if (typeof parsed.relation === "string" && parsed.relation.trim().length > 0) {
              const relWords = parsed.relation.trim().split(/\s+/).filter((w: string) => /^[A-Za-z]+$/.test(w));
              if (relWords.length >= 1 && relWords.length <= 2) {
                cleanRelation = relWords.map((w: string) => String(w).charAt(0).toUpperCase() + String(w).slice(1).toLowerCase()).join(" ");
              }
            }

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ name: cleanName, relation: cleanRelation }));
          } catch (err: any) {
            console.error("[API] Extract identity error:", err?.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ name: null, relation: null }));
          }
          return;
        }

        // POST /api/speak (Ultra-Realistic Neural TTS via Deepgram Aura & OpenAI)
        if (req.url === "/api/speak" && req.method === "POST") {
          try {
            const { text } = await readBody(req);
            if (!text || text.trim().length === 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing text" }));
              return;
            }

            const dgKey = process.env.DEEPGRAM_API_KEY;
            const openAiKey = process.env.OPENAI_API_KEY;

            // 1. Primary: Deepgram Aura (Ultra-realistic, soothing, mellow human voice)
            if (dgKey) {
              try {
                // Models: aura-luna-en (mellow, calm female) or aura-orion-en (calm, warm male)
                const dgRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-luna-en", {
                  method: "POST",
                  headers: {
                    Authorization: `Token ${dgKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ text }),
                });

                if (dgRes.ok) {
                  const arrayBuffer = await dgRes.arrayBuffer();
                  res.setHeader("Content-Type", "audio/mpeg");
                  res.end(Buffer.from(arrayBuffer));
                  return;
                }
              } catch (dgErr: any) {
                console.warn("[API] Deepgram Aura TTS failed, trying fallback:", dgErr?.message);
              }
            }

            // 2. Fallback: OpenAI TTS
            if (openAiKey) {
              try {
                const openAiRes = await fetch("https://api.openai.com/v1/audio/speech", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${openAiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "tts-1",
                    voice: "onyx",
                    input: text,
                    speed: 0.90,
                  }),
                });

                if (openAiRes.ok) {
                  const arrayBuffer = await openAiRes.arrayBuffer();
                  res.setHeader("Content-Type", "audio/mpeg");
                  res.end(Buffer.from(arrayBuffer));
                  return;
                }
              } catch (oaErr: any) {
                console.warn("[API] OpenAI TTS failed:", oaErr?.message);
              }
            }

            res.statusCode = 500;
            res.end(JSON.stringify({ error: "All TTS providers failed" }));
          } catch (err: any) {
            console.error("[API] TTS error:", err?.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "TTS error" }));
          }
          return;
        }

        next();
      });

      // ── Low-Latency Raw PCM WebSocket proxy for Deepgram ──
      server.httpServer?.on("upgrade", (request, socket, head) => {
        const reqUrl = request.url || "";
        if (!reqUrl.startsWith("/ws/deepgram")) return;

        wss.handleUpgrade(request, socket, head, (clientWs) => {
          const apiKey = process.env.DEEPGRAM_API_KEY;
          if (!apiKey) {
            console.error("[API] DEEPGRAM_API_KEY not found in process.env");
            clientWs.close(1011, "Missing API Key");
            return;
          }

          let sampleRate = "48000";
          try {
            const parsedUrl = new URL(reqUrl, "http://localhost");
            const sr = parsedUrl.searchParams.get("sample_rate");
            if (sr) sampleRate = sr;
          } catch {}

          console.log(`[API] Raw PCM speech proxy connected (sample_rate: ${sampleRate}), connecting to Deepgram Nova-2...`);

          const dgUrl =
            "wss://api.deepgram.com/v1/listen?" +
            `model=nova-2&language=en&smart_format=true&` +
            `interim_results=true&endpointing=300&punctuate=true&` +
            `encoding=linear16&sample_rate=${sampleRate}&channels=1`;

          const dgWs = new WSClient(dgUrl, {
            headers: { Authorization: `Token ${apiKey}` },
          });

          const bufferQueue: any[] = [];
          let isDgReady = false;
          let keepAliveTimer: NodeJS.Timeout | null = null;

          dgWs.on("open", () => {
            isDgReady = true;
            console.log("[API] Deepgram Nova-2 session established");
            
            while (bufferQueue.length > 0) {
              const chunk = bufferQueue.shift();
              if (dgWs.readyState === WSClient.OPEN) {
                dgWs.send(chunk);
              }
            }

            keepAliveTimer = setInterval(() => {
              if (dgWs.readyState === WSClient.OPEN) {
                dgWs.send(JSON.stringify({ type: "KeepAlive" }));
              }
            }, 3000);
          });

          clientWs.on("message", (data: any) => {
            if (isDgReady && dgWs.readyState === WSClient.OPEN) {
              dgWs.send(data);
            } else {
              if (bufferQueue.length < 50) {
                bufferQueue.push(data);
              }
            }
          });

          dgWs.on("message", (data: any) => {
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(data.toString());
            }
          });

          const cleanup = () => {
            if (keepAliveTimer) {
              clearInterval(keepAliveTimer);
              keepAliveTimer = null;
            }
          };

          clientWs.on("close", () => {
            cleanup();
            if (dgWs.readyState === WSClient.OPEN || dgWs.readyState === WSClient.CONNECTING) {
              dgWs.close();
            }
          });

          dgWs.on("close", (code, reason) => {
            cleanup();
            console.log("[API] Deepgram session closed:", code, reason?.toString() || "");
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close(code, reason?.toString() || "");
            }
          });

          dgWs.on("error", (err) => {
            cleanup();
            console.error("[API] Deepgram session error:", err.message);
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.close(1011, err.message);
            }
          });

          clientWs.on("error", (err) => {
            cleanup();
            console.error("[API] Client WS error:", err.message);
            if (dgWs.readyState === WSClient.OPEN) {
              dgWs.close();
            }
          });
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    apiServerPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
