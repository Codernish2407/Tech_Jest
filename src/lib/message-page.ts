import { isUuid } from "@/lib/uuid";

export const MESSAGE_PAGE_SIZE = 100;

export type MessageCursor = { created_at: string; id: string };

export function encodeMessageCursor(message: MessageCursor) {
  return `${message.created_at}|${message.id}`;
}

// Keep microseconds intact: rounding PostgreSQL timestamps to milliseconds can skip messages.
// The strict allowlist also makes the values safe for a PostgREST keyset filter.
export function decodeMessageCursor(value: string): MessageCursor | null {
  const [created_at, id, extra] = value.split("|");
  if (
    extra !== undefined ||
    !id ||
    !isUuid(id) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(created_at ?? "") ||
    !Number.isFinite(Date.parse(created_at!))
  )
    return null;
  return { created_at: created_at!, id };
}

export function mergeMessages<T extends MessageCursor>(existing: T[], incoming: T[]): T[] {
  const unique = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) unique.set(message.id, message);
  const timestamp = (value: string) => {
    const [seconds, fraction = ""] = value.replace(/(?:Z|\+00:00)$/, "").split(".");
    return `${seconds}.${fraction.padEnd(6, "0")}`;
  };
  return [...unique.values()].sort(
    (a, b) => timestamp(a.created_at).localeCompare(timestamp(b.created_at)) || a.id.localeCompare(b.id),
  );
}
