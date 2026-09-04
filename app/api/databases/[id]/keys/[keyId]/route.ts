import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { revokeScopedKey } from "@/lib/store";

export async function DELETE(request: Request, context: { params: Promise<{ id: string; keyId: string }> }) {
  const { id, keyId } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.via !== "session") {
    return NextResponse.json({ error: "Scoped keys can only be revoked from the console, not with an API key." }, { status: 403 });
  }

  try {
    await revokeScopedKey(access.email, id, keyId);
    return NextResponse.json({ revoked: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "not_found" ? 404 : 400 });
  }
}
