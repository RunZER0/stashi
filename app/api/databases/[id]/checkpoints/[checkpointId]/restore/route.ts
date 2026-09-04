import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { restoreCheckpoint } from "@/lib/store";

export async function POST(request: Request, context: { params: Promise<{ id: string; checkpointId: string }> }) {
  const { id, checkpointId } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.scope === "readonly") {
    return NextResponse.json(
      { error: "This API key is read-only and can't restore a checkpoint (it overwrites data)." },
      { status: 403 }
    );
  }

  try {
    const actor = access.via === "apiKey" ? (access.keyLabel ? `agent:${access.keyLabel}` : "agent") : "you";
    const { job } = await restoreCheckpoint(access.email, id, checkpointId, actor);
    return NextResponse.json({ job }, { status: 202 });
  } catch (err: any) {
    const status = err.message === "not_found" || err.message === "checkpoint_not_found" ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
