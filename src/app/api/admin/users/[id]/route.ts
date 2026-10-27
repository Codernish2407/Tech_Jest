import { NextResponse } from "next/server";
import { getAdminForApi } from "@/backend/supabase/admin";
import { isUuid } from "@/lib/uuid";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdminForApi();
  if (admin.error) return NextResponse.json({ error: admin.error.message }, { status: admin.error.status });
  const { supabase, user } = admin;
  if (!isUuid(id)) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (id === user.id) return NextResponse.json({ error: "You cannot delete your own admin profile." }, { status: 400 });
  const { error } = await supabase.rpc("admin_delete_user_data", { target_user_id: id });
  if (error) {
    console.error("Admin user deletion failed", { userId: id, code: error.code, message: error.message });
    return NextResponse.json({ error: "Could not remove this user's data." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
