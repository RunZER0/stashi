import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { restoreCheckpoint } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string; checkpointId: string }> }) {
  const { id, checkpointId } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const { job } = await restoreCheckpoint(access.email, id, checkpointId, access.via === "apiKey" ? "agent" : "you");
    return NextResponse.json({ job }, { status: 202 });
  } catch (err: any) {
    const status = err.message === "not_found" || err.message === "checkpoint_not_found" ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
