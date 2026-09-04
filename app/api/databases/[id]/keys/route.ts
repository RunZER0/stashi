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

// Session-only: minting a new scoped key with an existing API key would be
// a privilege-escalation path (an agent handing itself more keys). Only the
// console, with a real browser session, can create or revoke keys.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.via !== "session") {
    return NextResponse.json({ error: "Scoped keys can only be created from the console, not with an API key." }, { status: 403 });
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
