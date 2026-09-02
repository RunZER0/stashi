import { NextResponse } from "next/server";
import { verifyAgentSignature } from "@/lib/agent-auth";
import { completeJob } from "@/lib/store";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyAgentSignature(rawBody, req.headers);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const { jobId, status, result, error } = JSON.parse(rawBody || "{}") as {
      jobId?: string;
      status?: "completed" | "failed";
      result?: Record<string, unknown>;
      error?: string;
    };
    if (!jobId || !status) {
      return NextResponse.json({ error: "jobId and status are required" }, { status: 400 });
    }
    const job = completeJob(jobId, status, result, error);
    if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ success: true, jobId, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
