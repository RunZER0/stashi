import { NextResponse } from "next/server";
import { createDatabase, listDatabases } from "@/lib/store";
import type { PlanId } from "@/lib/plans";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ databases: await listDatabases(email) });
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json()) as { name?: string; plan?: PlanId; region?: string; ttlHours?: number };
  const { database, job } = await createDatabase(email, {
    name: body.name || "database",
    plan: body.plan || "starter",
    region: body.region || "us-east",
    ttlHours: body.ttlHours,
  });

  return NextResponse.json({ database, job }, { status: 201 });
}
