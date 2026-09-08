import { NextResponse } from "next/server";
import { verifyAgentSignature } from "@/lib/agent-auth";
import { reapExpiredCheckpoints } from "@/lib/store";

// Same pattern as ttl-sweep: called periodically by the node agent (Render
// has no built-in cron for the Next.js app to hang one off of), the control
// plane decides which checkpoints are past their plan's backupRetentionDays
// and deletes their rows, enqueuing a real delete_checkpoint job per one so
// the agent removes the actual file (and off-node copy, if any) next poll.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyAgentSignature(rawBody, req.headers);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const reaped = await reapExpiredCheckpoints();
    return NextResponse.json({ reaped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
