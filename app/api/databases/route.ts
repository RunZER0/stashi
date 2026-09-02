import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { ManagedDatabase } from "@/lib/control-plane";
import type { PlanId } from "@/lib/plans";

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32);

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; plan?: PlanId; region?: string };
  const safeName = slugify(body.name || "database");
  const suffix = randomBytes(3).toString("hex");
  const record: ManagedDatabase = {
    id: `db_${Date.now().toString(36).toUpperCase()}`,
    name: body.name?.trim() || "database",
    plan: body.plan || "starter",
    region: body.region || "us-east",
    status: "healthy",
    version: "17",
    host: process.env.NEXT_PUBLIC_DB_HOST || "db.ynai.co.ke",
    port: Number(process.env.NEXT_PUBLIC_DB_PORT || 6432),
    database: `${safeName}_${suffix}`,
    username: `${safeName}_owner`,
    password: `st_${randomBytes(12).toString("base64url")}`,
    createdAt: new Date().toISOString(),
    storageUsedMb: 0,
    connections: 0,
    p95LatencyMs: 0,
  };

  return NextResponse.json({ database: record, job: { state: "succeeded", steps: 6 } }, { status: 201 });
}
