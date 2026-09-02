import { NextResponse } from "next/server";
import { verifyAgentSignature } from "@/lib/agent-auth";
import { claimNextJob } from "@/lib/store";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyAgentSignature(rawBody, req.headers);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const { nodeId } = JSON.parse(rawBody || "{}") as { nodeId?: string };
    const job = await claimNextJob(nodeId || "");
    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
