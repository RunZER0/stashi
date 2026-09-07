import { NextResponse } from "next/server";
import { resolveAccountAccess } from "@/lib/auth";
import { createAccountKey, listAccountKeys } from "@/lib/store";
import type { ScopedKeyScope } from "@/lib/control-plane";

export async function GET(request: Request) {
  const access = await resolveAccountAccess(request);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ keys: await listAccountKeys(access.email) });
}

// Full-scope access only, same reasoning as the per-database scoped-key
// route: an account key minting another account key isn't privilege
// escalation, since neither can exceed the account's own access. What this
// blocks is a read-only account key minting itself a full one.
export async function POST(request: Request) {
  const access = await resolveAccountAccess(request);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.scope !== "full") {
    return NextResponse.json({ error: "This API key is read-only and can't create new keys." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { label?: string; scope?: ScopedKeyScope };
  const scope: ScopedKeyScope = body.scope === "readonly" ? "readonly" : "full";

  const key = await createAccountKey(access.email, body.label || "", scope);
  return NextResponse.json({ key }, { status: 201 });
}
