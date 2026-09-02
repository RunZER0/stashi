import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Off-node backups are not implemented yet (see the productionize-node handover
// issue, Phase 7). Report that honestly instead of pretending a restore ran.
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  await context.params;
  return NextResponse.json(
    { error: "not_implemented", message: "Backups are not yet wired to a live node. Nothing to restore." },
    { status: 501 }
  );
}
