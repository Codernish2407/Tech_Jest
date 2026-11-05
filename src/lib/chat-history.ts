// The site assistant's conversation format, shared by the chat widget and /api/chat.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export const MAX_QUESTION_LENGTH = 1000;
// The newest messages sent to the model. Odd, so a history that ends on the visitor also starts on them.
export const MAX_HISTORY = 11;

// Checks the visitor's conversation (oldest first: alternating turns that start and end with the visitor)
// and returns its newest MAX_HISTORY messages, or an error message.
export function parseChatHistory(body: unknown): ChatMessage[] | string {
  const raw = typeof body === "object" && body !== null && "messages" in body ? body.messages : undefined;
  if (!Array.isArray(raw) || !raw.length || raw.length > 50) return "Send between 1 and 50 messages.";
  const messages: ChatMessage[] = [];
  for (const [index, item] of raw.entries()) {
    const role = typeof item === "object" && item !== null && "role" in item ? item.role : undefined;
    const content = typeof item === "object" && item !== null && "content" in item ? item.content : undefined;
    if (role !== (index % 2 === 0 ? "user" : "assistant")) return "Messages must alternate, starting with yours.";
    if (typeof content !== "string" || !content.trim()) return "Messages cannot be empty.";
    // Earlier answers can be longer than a question, but not unbounded.
    if (content.length > MAX_QUESTION_LENGTH * 4) return "A message is too long.";
    messages.push({ role, content: content.trim() });
  }
  if (messages.at(-1)!.role !== "user") return "The last message must be yours.";
  if (messages.at(-1)!.content.length > MAX_QUESTION_LENGTH)
    return `Keep your question under ${MAX_QUESTION_LENGTH} characters.`;
  return messages.slice(-MAX_HISTORY);
}
