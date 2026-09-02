import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { backupId?: string };
  return NextResponse.json({ id, backupId: body.backupId ?? "latest", job: "restore_queued", queuedAt: new Date().toISOString() }, { status: 202 });
}
