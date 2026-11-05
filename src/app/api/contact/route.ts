import { createClient } from "@/backend/supabase/server";
import { after, NextResponse } from "next/server";
import { requestAlertEmail, sendTeamAlert } from "@/backend/email/team-alert";
import { getServices } from "@/backend/supabase/services";
import { findServiceArea, notSureService } from "@/frontend/data/service-areas";
import { getSessionUser } from "@/backend/supabase/session";

type ContactBody = {
  service?: unknown;
  serviceSlugs?: unknown;
  message?: unknown;
  budget?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  timeline?: unknown;
  // Hidden from people; bots that fill every field fill this one too.
  website?: unknown;
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Booking a service needs an account: the request lands in the client's workspace, where the team replies.
// The contact form and cart send visitors to log in first and keep what they typed.
const loginRequiredError = "Please log in or create an account to book a service.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: loginRequiredError, loginRequired: true }, { status: 401 });
  let body: ContactBody;
  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  // Looks like success to the bot, so it does not retry; nothing is saved.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });
  if (
    body.serviceSlugs !== undefined &&
    (!Array.isArray(body.serviceSlugs) ||
      body.serviceSlugs.length > 30 ||
      body.serviceSlugs.some((slug) => typeof slug !== "string" || !slug.trim() || slug.length > 160))
  )
    return NextResponse.json({ error: "Select up to 30 valid services." }, { status: 400 });
  const services = await getServices({ fallbackOnMissingTable: false });
  const requestedSlugs = Array.isArray(body.serviceSlugs)
    ? [
        ...new Set(
          body.serviceSlugs
            .filter((slug): slug is string => typeof slug === "string")
            .map((slug) => slug.trim())
            .filter(Boolean),
        ),
      ]
    : [];
  const requestedService = typeof body.service === "string" ? body.service.trim() : "";
  const matchingArea = findServiceArea(requestedService);
  const notSure = requestedService.toLowerCase() === notSureService.toLowerCase();
  if (!services.length && (requestedSlugs.length > 0 || (requestedService && !matchingArea && !notSure))) {
    return NextResponse.json(
      { error: "The service catalog is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
  const selectedServices = requestedSlugs
    .map((slug) => services.find((item) => item.slug === slug))
    .filter((item): item is (typeof services)[number] => Boolean(item));
  if (requestedSlugs.length !== selectedServices.length)
    return NextResponse.json({ error: "One or more selected services are invalid." }, { status: 400 });
  const matchingService = services.find(
    (item) =>
      item.name.toLowerCase() === requestedService.toLowerCase() ||
      item.category.toLowerCase() === requestedService.toLowerCase(),
  );
  if (!selectedServices.length && requestedService && !notSure && !matchingArea && !matchingService) {
    return NextResponse.json({ error: "Please select an available service." }, { status: 400 });
  }
  const service = selectedServices.length
    ? selectedServices.map((item) => item.name).join(", ")
    : (matchingArea?.title ?? matchingService?.category ?? requestedService);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const budget = typeof body.budget === "string" ? body.budget.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const timeline = typeof body.timeline === "string" ? body.timeline.trim() : "";
  if (!service || message.length < 20 || message.length > 5000)
    return NextResponse.json(
      { error: "Select a service and provide a message between 20 and 5000 characters." },
      { status: 400 },
    );
  if (
    service.length > 1000 ||
    budget.length > 160 ||
    name.length > 100 ||
    email.length > 320 ||
    phone.length > 30 ||
    company.length > 160 ||
    timeline.length > 160
  )
    return NextResponse.json({ error: "Some request details are too long." }, { status: 400 });
  if (body.email !== undefined && !emailPattern.test(email))
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const failed = (error: { code?: string; message: string }) => {
    if (error.code === "TJ429")
      return NextResponse.json(
        { error: "Several requests were sent from here in the last hour. Please wait a little, or email us instead." },
        { status: 429 },
      );
    // TJ400 messages are written for visitors in the database function.
    if (error.code === "TJ400") return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Could not save project request", { code: error.code, message: error.message });
    return NextResponse.json({ error: "We could not save your request. Please try again." }, { status: 500 });
  };
  const alert = (
    requestId: string,
    details: { name?: string | null; email?: string | null; phone?: string | null; company?: string | null },
  ) =>
    // After the response, so a slow email service never delays the visitor.
    after(() =>
      sendTeamAlert(requestAlertEmail({ requestId, guest: false, service, message, budget, timeline, ...details })),
    );
  // The contact form sends no contact details, so the profile fills them in for the admin team.
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, full_name, phone, company")
    .eq("id", user.id)
    .maybeSingle();
  // One database call saves the request, its services, conversation, first message, and admin
  // notification together, so a failure never leaves part of a request behind.
  const contact = {
    name: name || profile?.full_name || null,
    email: email || user.email || null,
    phone: phone || profile?.phone || null,
    company: company || profile?.company || null,
  };
  const { data: requestId, error } = await supabase.rpc("submit_project_request", {
    p_service: service,
    p_message: message,
    p_budget: budget || null,
    p_name: contact.name,
    p_email: contact.email,
    p_phone: contact.phone,
    p_company: contact.company,
    p_timeline: timeline || null,
    p_company_id: profile?.company_id ?? null,
    p_services: selectedServices.map((item) => ({ slug: item.slug, name: item.name, price: item.price })),
    p_notification_body: `${(name || profile?.full_name || email || user.email || "A client").slice(0, 100)} requested ${service}.`,
  });
  if (error) return failed(error);
  alert(String(requestId), contact);
  return NextResponse.json({ ok: true });
}
