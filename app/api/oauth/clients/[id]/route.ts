import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { logAuditEvent } from "@/lib/auth/audit";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureSchema();
  const pool = getPool();

  const { rows } = await pool.query(
    `DELETE FROM "oauthClient"
     WHERE ("clientId" = $1 OR id = $1)
       AND "userId" = (SELECT id FROM "user" WHERE email = $2 LIMIT 1)
     RETURNING "clientId", name`,
    [id, session.user.email]
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Client not found or unauthorized" }, { status: 404 });
  }

  await logAuditEvent({
    event: "oauth.client.deleted",
    outcome: "success",
    userEmail: session.user.email,
    clientId: rows[0].clientId,
    details: { name: rows[0].name },
  });

  return NextResponse.json({ ok: true, deletedClientId: rows[0].clientId });
}
