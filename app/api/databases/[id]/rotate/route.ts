import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordActivity, updateDatabase } from "@/lib/store";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const password = `st_${randomBytes(12).toString("base64url")}`;
  const updated = await updateDatabase(email, id, { password });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await recordActivity(email, "you", "database.credentials.rotated", updated.name);
  return NextResponse.json({ id, password, rotatedAt: new Date().toISOString() });
}
