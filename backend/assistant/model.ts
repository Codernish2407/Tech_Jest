// Calls the site assistant's language model through the OpenAI-compatible chat completions API.
// The default is Google's Gemini (free tier from Google AI Studio). Any other OpenAI-compatible
// provider works by setting AI_BASE_URL and AI_MODEL, for example Groq:
//   AI_BASE_URL=https://api.groq.com/openai/v1   AI_MODEL=llama-3.3-70b-versatile
import type { ChatMessage } from "@/lib/chat-history";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
// Tried in order: when one model is overloaded, out of free quota, or retired, the next one answers.
// Measured on the free tier (6 Nov 2026) with this knowledge base: these Flash-Lite models answer in about
// 2 seconds, but each one sometimes returns 503 "high demand". gemini-flash-latest took about 45 seconds.
// The last entry is Google's alias for its newest Flash-Lite, which keeps working after older models retire.
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];

// One slow model must not use up the whole request: Vercel stops the function after 60 seconds.
const ATTEMPT_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS = 45_000;

export type ModelConfig = { apiKey: string; baseUrl: string; models: string[]; reasoningEffort: string };

// null when no key is set: the assistant is then off.
export function modelConfig(env: Record<string, string | undefined> = process.env): ModelConfig | null {
  const apiKey = env.AI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.AI_BASE_URL?.trim() || GEMINI_BASE_URL).replace(/\/+$/, "");
  // AI_MODEL may list several models, separated by commas, tried in order.
  const models = (env.AI_MODEL ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return {
    apiKey,
    baseUrl,
    models: models.length ? models : GEMINI_MODELS,
    // Optional OpenAI-style reasoning_effort. Not sent unless set: models and providers accept different values
    // (Flash-Lite rejects "none").
    reasoningEffort: env.AI_REASONING_EFFORT?.trim() ?? "",
  };
}

export class ModelError extends Error {
  constructor(
    message: string,
    // "busy": every model was overloaded or out of free quota; "failed": anything else.
    readonly kind: "busy" | "failed",
    readonly status?: number,
  ) {
    super(message);
  }
}

// Worth trying the next model: overloaded (429, 5xx), retired (404), timed out, or no answer.
// Other errors (400, 401, 403) would fail the same way on every model.
const tryNextModel = (error: ModelError) =>
  error.status === undefined || error.status === 404 || error.status === 429 || error.status >= 500;

async function askOneModel(
  config: ModelConfig,
  model: string,
  system: string,
  messages: ChatMessage[],
  timeoutMs: number,
) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model,
        // Room for the model's reasoning plus a short answer.
        max_tokens: 4096,
        ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ModelError(
      `${model}: could not reach the model: ${error instanceof Error ? error.message : String(error)}`,
      "failed",
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = JSON.stringify(data)?.slice(0, 300) ?? "";
    throw new ModelError(
      `${model}: request failed (${response.status}): ${detail}`,
      response.status === 429 || response.status === 503 ? "busy" : "failed",
      response.status,
    );
  }
  const choice = (data as { choices?: { finish_reason?: string; message?: { content?: unknown } }[] } | null)
    ?.choices?.[0];
  if (choice?.finish_reason === "content_filter") return null;
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new ModelError(`${model}: returned no answer (finish_reason: ${choice?.finish_reason ?? "none"})`, "failed");
  return content.trim();
}

// Returns the answer text, or null when the provider's safety filter blocked it.
export async function askModel(config: ModelConfig, system: string, messages: ChatMessage[]) {
  const started = Date.now();
  const errors: ModelError[] = [];
  for (const model of config.models) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 3_000) break;
    try {
      return await askOneModel(config, model, system, messages, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    } catch (error) {
      if (!(error instanceof ModelError)) throw error;
      errors.push(error);
      if (!tryNextModel(error)) break;
    }
  }
  const last = errors.at(-1);
  throw new ModelError(
    errors.map((error) => error.message).join(" | ") || "No model was tried.",
    errors.length && errors.every((error) => error.kind === "busy") ? "busy" : "failed",
    last?.status,
  );
}
