import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, getPool } from "@/lib/db";
import { logAuditEvent } from "@/lib/auth/audit";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await ensureSchema();
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT c.id, c."clientId", c.scopes, c.resources, c."createdAt", cl.name as "clientName", cl.uri as "clientUri", cl.icon as "clientIcon"
     FROM "oauthConsent" c
     LEFT JOIN "oauthClient" cl ON c."clientId" = cl."clientId"
     WHERE c."userId" = (SELECT id FROM "user" WHERE email = $1 LIMIT 1)
     ORDER BY c."createdAt" DESC`,
    [session.user.email]
  );

  return NextResponse.json({ authorizedApps: rows });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  await ensureSchema();
  const pool = getPool();

  const uRes = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [session.user.email]);
  const userId = uRes.rows[0]?.id;
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Revoke consent
  await pool.query(`DELETE FROM "oauthConsent" WHERE "clientId" = $1 AND "userId" = $2`, [clientId, userId]);

  // Invalidate any active refresh tokens and access tokens for this client + user
  await pool.query(
    `UPDATE "oauthRefreshToken" SET revoked = now() WHERE "clientId" = $1 AND "userId" = $2 AND revoked IS NULL`,
    [clientId, userId]
  );
  await pool.query(
    `UPDATE "oauthAccessToken" SET revoked = now() WHERE "clientId" = $1 AND "userId" = $2 AND revoked IS NULL`,
    [clientId, userId]
  );

  await logAuditEvent({
    event: "oauth.consent.revoked",
    outcome: "success",
    userId,
    userEmail: session.user.email,
    clientId,
    details: { reason: "user_revoked_authorized_application" },
  });

  return NextResponse.json({ ok: true, revokedClientId: clientId });
}
