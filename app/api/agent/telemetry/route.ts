import { NextResponse } from "next/server";
import { verifyAgentSignature } from "@/lib/agent-auth";
import { recordNodeTelemetry } from "@/lib/store";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = verifyAgentSignature(rawBody, req.headers);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const telemetry = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const { nodeId, cpuPct, memoryPct, diskPct, databaseCount } = telemetry as {
      nodeId?: string;
      cpuPct?: number;
      memoryPct?: number;
      diskPct?: number;
      databaseCount?: number;
    };

    if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (typeof cpuPct === "number") patch.cpuPct = cpuPct;
    if (typeof memoryPct === "number") patch.memoryPct = memoryPct;
    if (typeof diskPct === "number") patch.diskPct = diskPct;
    if (typeof databaseCount === "number") patch.databaseCount = databaseCount;
    if (typeof cpuPct === "number" && typeof memoryPct === "number") {
      patch.capacityStatus = cpuPct > 70 || memoryPct > 80 ? "watch" : "open";
    }

    await recordNodeTelemetry(nodeId, patch);

    return NextResponse.json({ success: true, recordedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
