"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/backend/supabase/client";
import { documentsBucket } from "@/backend/supabase/documents";
import { REQUEST_DELETE_WARNING } from "./admin-request-bulk-delete";

const tables = {
  task: "project_tasks",
  document: "project_documents",
  conversation: "conversations",
  request: "project_requests",
} as const;

const consequences = {
  task: "",
  document: " The client will no longer be able to download it.",
  conversation: " Every message in it is removed for you and the client. This cannot be undone.",
  request: `\n\n${REQUEST_DELETE_WARNING}`,
};

// Removes a project task, a project document together with its stored file, a client
// conversation (its messages go with it through the database cascade), or a consultation request.
export function AdminDeleteButton({
  kind,
  id,
  name,
  storagePath,
  label = "Delete",
  redirectTo,
}: {
  kind: keyof typeof tables;
  id: string;
  name: string;
  storagePath?: string;
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete “${name}”?${consequences[kind]}`)) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from(tables[kind]).delete().eq("id", id).select("id");
    if (error || !data?.length) {
      window.alert(`Could not delete this ${kind}.`);
      setBusy(false);
      return;
    }
    // The record goes first, so a failed file removal never leaves a broken download link.
    if (storagePath) await supabase.storage.from(documentsBucket).remove([storagePath]);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <button type="button" className="request-delete" onClick={remove} disabled={busy} aria-label={`Delete ${name}`}>
      {busy ? "Deleting…" : label}
    </button>
  );
}
