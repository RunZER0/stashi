import { NextResponse } from "next/server";
import { deleteDatabase } from "@/lib/store";
import { auth } from "@/auth";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteDatabase(email, id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ id, status: "deleted" });
}
