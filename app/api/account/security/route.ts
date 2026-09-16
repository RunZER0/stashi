import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureSchema, getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await ensureSchema();
  const pool = getPool();

  // Find linked accounts
  const { rows: accounts } = await pool.query(
    `SELECT a."providerId", a."createdAt"
     FROM "account" a
     WHERE a."userId" = (SELECT id FROM "user" WHERE email = $1 LIMIT 1)`,
    [session.user.email]
  );

  // Find active sessions
  const { rows: sessions } = await pool.query(
    `SELECT s.id, s."expiresAt", s."createdAt", s."ipAddress", s."userAgent"
     FROM "session" s
     WHERE s."userId" = (SELECT id FROM "user" WHERE email = $1 LIMIT 1)
       AND s."expiresAt" > now()
     ORDER BY s."createdAt" DESC`,
    [session.user.email]
  );

  return NextResponse.json({
    email: session.user.email,
    linkedProviders: accounts.map((a) => a.providerId),
    activeSessions: sessions,
  });
}
