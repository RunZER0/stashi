import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createDatabase, listDatabases } from "@/lib/store";
import type { PlanId } from "@/lib/plans";

export async function GET() {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ databases: await listDatabases(email) });
}

export async function POST(request: Request) {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json()) as { name?: string; plan?: PlanId; region?: string };
  const { database, job } = await createDatabase(email, {
    name: body.name || "database",
    plan: body.plan || "starter",
    region: body.region || "us-east",
  });

  return NextResponse.json({ database, job }, { status: 201 });
}
