import { NextResponse } from "next/server";
import { verifyAgentSignature } from "@/lib/agent-auth";
import { reapExpiredDatabases } from "@/lib/store";

// Called periodically by the node agent (not on a schedule the control
// plane owns itself, since Next.js on Render has no built-in cron) to find
// and delete databases past their TTL. The actual deletion reuses
// deleteDatabase, which enqueues a real delete_database/delete_pool_tenant
// job for the agent to execute next poll — this endpoint only decides who's
// expired, it doesn't touch Postgres directly.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyAgentSignature(rawBody, req.headers);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const reaped = await reapExpiredDatabases();
    return NextResponse.json({ reaped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
