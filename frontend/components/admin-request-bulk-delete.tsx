"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/backend/supabase/client";

export const BULK_FORM = "request-bulk-delete";

// Matches the foreign keys: selected services, proposals, and notifications cascade; conversations,
// projects, and invoices are kept but lose their link to the request.
export const REQUEST_DELETE_WARNING =
  "Selected services, proposals, and notifications go with it. Conversations, projects, and invoices are kept, but clients no longer see projects linked to a deleted request. This cannot be undone.";

const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM}"]`));

// The toolbar for deleting several requests at once. The checkboxes live on the server-rendered
// cards and join this form through their form attribute, so the cards stay server components.
export function AdminRequestBulkDelete({ total }: { total: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const count = () => setSelected(boxes().filter((box) => box.checked).length);
    count();
    document.addEventListener("change", count);
    return () => document.removeEventListener("change", count);
  }, [total]);

  function toggleAll() {
    const all = boxes();
    const check = all.some((box) => !box.checked);
    all.forEach((box) => (box.checked = check));
    setSelected(check ? all.length : 0);
  }

  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ids = new FormData(event.currentTarget).getAll("id").map(String);
    if (!ids.length) return;
    const noun = ids.length === 1 ? "this request" : `these ${ids.length} requests`;
    if (!window.confirm(`Delete ${noun} permanently?\n\n${REQUEST_DELETE_WARNING}`)) return;
    setBusy(true);
    const { data, error } = await createClient().from("project_requests").delete().in("id", ids).select("id");
    setBusy(false);
    if (error || !data?.length) {
      window.alert("Could not delete the selected requests.");
      return;
    }
    if (data.length < ids.length) window.alert(`Deleted ${data.length} of ${ids.length} requests.`);
    boxes().forEach((box) => (box.checked = false));
    setSelected(0);
    router.refresh();
  }

  if (!total) return null;
  return (
    <form id={BULK_FORM} className="admin-bulk" onSubmit={remove}>
      <button type="button" className="text-link" onClick={toggleAll} disabled={busy}>
        {selected === total ? "Clear selection" : "Select all on this page"}
      </button>
      <span>{selected ? `${selected} selected` : "Tick requests to delete several at once"}</span>
      <button type="submit" className="btn btn-small admin-bulk-delete" disabled={busy || !selected}>
        {busy ? "Deleting…" : selected ? `Delete ${selected}` : "Delete selected"}
      </button>
    </form>
  );
}
