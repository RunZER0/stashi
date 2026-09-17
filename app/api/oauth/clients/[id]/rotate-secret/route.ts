import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { logAuditEvent } from "@/lib/auth/audit";

export const runtime = "nodejs";

export async function POST(
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

  const newSecret = `secret_${randomBytes(32).toString("hex")}`;

  const { rows } = await pool.query(
    `UPDATE "oauthClient"
     SET "clientSecret" = $1, "updatedAt" = now()
     WHERE ("clientId" = $2 OR id = $2)
       AND "userId" = (SELECT id FROM "user" WHERE email = $3 LIMIT 1)
     RETURNING "clientId", name`,
    [newSecret, id, session.user.email]
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Client not found or unauthorized" }, { status: 404 });
  }

  await logAuditEvent({
    event: "oauth.client.updated",
    outcome: "success",
    userEmail: session.user.email,
    clientId: rows[0].clientId,
    details: { action: "secret_rotated" },
  });

  return NextResponse.json({
    ok: true,
    clientId: rows[0].clientId,
    clientSecret: newSecret, // One-time display
  });
}
