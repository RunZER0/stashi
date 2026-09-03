import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { createCheckpoint, getDatabase, listCheckpoints } from "@/lib/store";
import type { CheckpointKind } from "@/lib/control-plane";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = await getDatabase(access.email, id);
  if (!db) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ checkpoints: await listCheckpoints(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { kind?: CheckpointKind; label?: string };
  const kind: CheckpointKind = body.kind === "backup" ? "backup" : "checkpoint";
  const label = body.label?.trim() || (kind === "backup" ? "Manual backup" : "Checkpoint");

  try {
    const { checkpoint, job } = await createCheckpoint(
      access.email,
      id,
      kind,
      label,
      access.via === "apiKey" ? "agent" : "you"
    );
    return NextResponse.json({ checkpoint, job }, { status: 201 });
  } catch (err: any) {
    const status = err.message === "not_found" ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
