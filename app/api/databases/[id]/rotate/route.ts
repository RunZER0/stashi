import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { recordActivity, updateDatabase } from "@/lib/store";
import { auth } from "@/auth";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const password = `st_${randomBytes(12).toString("base64url")}`;
  const updated = await updateDatabase(email, id, { password });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await recordActivity(email, "you", "database.credentials.rotated", updated.name);
  return NextResponse.json({ id, password, rotatedAt: new Date().toISOString() });
}
