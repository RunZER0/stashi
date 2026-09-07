import { NextResponse } from "next/server";
import { createDatabase, listDatabases } from "@/lib/store";
import type { PlanId } from "@/lib/plans";
import { resolveAccountAccess } from "@/lib/auth";

export async function GET(request: Request) {
  const access = await resolveAccountAccess(request);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ databases: await listDatabases(access.email) });
}

export async function POST(request: Request) {
  const access = await resolveAccountAccess(request);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.scope !== "full") {
    return NextResponse.json({ error: "This API key is read-only and can't create databases." }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; plan?: PlanId; region?: string; ttlHours?: number };
  const { database, job } = await createDatabase(access.email, {
    name: body.name || "database",
    plan: body.plan || "starter",
    region: body.region || "us-east",
    ttlHours: body.ttlHours,
  });

  return NextResponse.json({ database, job }, { status: 201 });
}
