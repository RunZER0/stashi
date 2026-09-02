import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { recordActivity, updateDatabase } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { suspended?: boolean };
  const status = body.suspended === false ? "healthy" : "suspended";
  const updated = updateDatabase(email, id, { status });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  recordActivity(email, "you", status === "suspended" ? "database.suspended" : "database.resumed", updated.name);
  return NextResponse.json({ id, status });
}
