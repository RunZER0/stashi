import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteDatabase } from "@/lib/store";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const deleted = deleteDatabase(email, id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ id, status: "deleted" });
}
