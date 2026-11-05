import { NextResponse } from "next/server";
import { ASSISTANT_RULES, DEFAULT_REFUSAL } from "@/backend/assistant/prompt";
import { buildSiteKnowledge } from "@/backend/assistant/knowledge";
import { askModel, modelConfig, ModelError } from "@/backend/assistant/model";
import { getServiceCatalog } from "@/backend/supabase/services";
import { getSiteSettings, whatsappLink } from "@/backend/supabase/site-settings";
import { team } from "@/frontend/data/team";
import { parseChatHistory } from "@/lib/chat-history";
import { createRateLimiter } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";

// Public website assistant. It answers only from the website's own content (backend/assistant/).
// Off until AI_API_KEY is set; the layout hides the chat button without it.

export const maxDuration = 60;

// The free model quota is shared by every visitor, so one visitor cannot use it all up.
// Per server instance only, like the proxy's /api/ limit.
const perMinute = createRateLimiter({ limit: 6, windowMs: 60_000 });
const perHour = createRateLimiter({ limit: 40, windowMs: 60 * 60_000 });

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { ...noStore, ...headers } });

async function loadKnowledge() {
  const [settings, catalog] = await Promise.all([getSiteSettings(), getServiceCatalog()]);
  return buildSiteKnowledge({
    siteUrl: getSiteUrl(),
    contactEmail: settings.contact_email,
    whatsappHref: whatsappLink(settings.whatsapp_number),
    team,
    services: catalog.status === "ready" ? catalog.services : null,
  });
}

export async function POST(request: Request) {
  const config = modelConfig();
  if (!config) return fail("The assistant is not available right now.", 503);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  for (const limiter of [perMinute, perHour]) {
    const result = limiter(ip);
    if (!result.allowed)
      return fail("You’ve sent a lot of questions. Please wait a little and try again.", 429, {
        "Retry-After": String(result.retryAfter),
      });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const messages = parseChatHistory(body);
  if (typeof messages === "string") return fail(messages, 400);

  try {
    const system = `${ASSISTANT_RULES}\n\n<website_knowledge_base>\n${await loadKnowledge()}\n</website_knowledge_base>`;
    const reply = await askModel(config, system, messages);
    return NextResponse.json({ reply: reply ?? DEFAULT_REFUSAL }, { headers: noStore });
  } catch (error) {
    console.error("Site assistant request failed", error instanceof Error ? error.message : error);
    if (error instanceof ModelError && error.kind === "busy")
      return fail("The assistant is busy right now. Please try again later, or use the contact page.", 503);
    return fail("The assistant couldn’t answer just now. Please try again, or use the contact page.", 502);
  }
}
