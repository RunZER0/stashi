import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { createScopedKey, listScopedKeys } from "@/lib/store";
import type { ScopedKeyScope } from "@/lib/control-plane";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    return NextResponse.json({ keys: await listScopedKeys(access.email, id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "not_found" ? 404 : 400 });
  }
}

// Full-scope access only (session, or the primary/full API key) — not a
// via==="session" check, on purpose: a full key already has complete
// control over this database's data, so minting a scoped key for a
// subagent isn't privilege escalation, it's the opposite (handing out
// *less* access than the caller already has). The one real escalation
// path — a read-only key minting itself broader access — is what this
// actually blocks, letting an orchestrating agent provision keys for its
// own subagents without a human in the console every time.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.scope !== "full") {
    return NextResponse.json({ error: "This API key is read-only and can't create new keys." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { label?: string; scope?: ScopedKeyScope };
  const scope: ScopedKeyScope = body.scope === "readonly" ? "readonly" : "full";

  try {
    const key = await createScopedKey(access.email, id, body.label || "", scope);
    return NextResponse.json({ key }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "not_found" ? 404 : 400 });
  }
}
