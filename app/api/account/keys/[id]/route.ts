import { NextResponse } from "next/server";
import { resolveAccountAccess } from "@/lib/auth";
import { revokeAccountKey } from "@/lib/store";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveAccountAccess(request);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.scope !== "full") {
    return NextResponse.json({ error: "This API key is read-only and can't revoke keys." }, { status: 403 });
  }

  await revokeAccountKey(access.email, id);
  return NextResponse.json({ revoked: true });
}
