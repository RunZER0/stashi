import { NextResponse } from "next/server";
import { recordActivity, updateDatabase } from "@/lib/store";
import { auth } from "@/auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { suspended?: boolean };
  const status = body.suspended === false ? "healthy" : "suspended";
  const updated = await updateDatabase(email, id, { status });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await recordActivity(email, "you", status === "suspended" ? "database.suspended" : "database.resumed", updated.name);
  return NextResponse.json({ id, status });
}
