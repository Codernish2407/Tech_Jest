// Calls the site assistant's language model through the OpenAI-compatible chat completions API.
// The default is Google's Gemini (free tier from Google AI Studio). Any other OpenAI-compatible
// provider works by setting AI_BASE_URL and AI_MODEL, for example Groq:
//   AI_BASE_URL=https://api.groq.com/openai/v1   AI_MODEL=llama-3.3-70b-versatile
import type { ChatMessage } from "@/lib/chat-history";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// Google's alias for its current Flash-Lite model, so the assistant keeps working when a model is retired.
// Measured on the free tier (6 Nov 2026) with this knowledge base: Flash-Lite answered in about 2 seconds,
// while gemini-flash-latest took about 45 seconds or returned "high demand" errors.
const GEMINI_MODEL = "gemini-flash-lite-latest";

export type ModelConfig = { apiKey: string; baseUrl: string; model: string; reasoningEffort: string };

// null when no key is set: the assistant is then off.
export function modelConfig(env: Record<string, string | undefined> = process.env): ModelConfig | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.AI_BASE_URL?.trim() || GEMINI_BASE_URL).replace(/\/+$/, "");
  return {
    apiKey,
    baseUrl,
    model: env.AI_MODEL?.trim() || GEMINI_MODEL,
    // Optional OpenAI-style reasoning_effort. Not sent unless set: models and providers accept different values
    // (Flash-Lite rejects "none").
    reasoningEffort: env.AI_REASONING_EFFORT?.trim() ?? "",
  };
}

export class ModelError extends Error {
  constructor(
    message: string,
    // "busy": the provider's rate limit or free quota is used up; "failed": anything else.
    readonly kind: "busy" | "failed",
    readonly status?: number,
  ) {
    super(message);
  }
}

// Returns the answer text, or null when the provider's safety filter blocked it.
export async function askModel(config: ModelConfig, system: string, messages: ChatMessage[]) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        // Room for the model's reasoning plus a short answer.
        max_tokens: 4096,
        ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new ModelError(
      `Could not reach the model: ${error instanceof Error ? error.message : String(error)}`,
      "failed",
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = JSON.stringify(data)?.slice(0, 500) ?? "";
    throw new ModelError(
      `Model request failed (${response.status}): ${detail}`,
      response.status === 429 ? "busy" : "failed",
      response.status,
    );
  }
  const choice = (data as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] } | null)
    ?.choices?.[0];
  if (choice?.finish_reason === "content_filter") return null;
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new ModelError(`The model returned no answer (finish_reason: ${choice?.finish_reason ?? "none"})`, "failed");
  return content.trim();
}
