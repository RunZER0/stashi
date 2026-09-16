import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
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
    `SELECT "clientId", name, "redirectUris", "tokenEndpointAuthMethod", "requirePKCE", "createdAt", scopes
     FROM "oauthClient"
     WHERE "userId" = (SELECT id FROM "user" WHERE email = $1 LIMIT 1)
     ORDER BY "createdAt" DESC`,
    [session.user.email]
  );

  return NextResponse.json({ clients: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    redirectUris?: string[];
    clientType?: "public" | "confidential";
    scopes?: string[];
  };

  const name = body.name?.trim() || "OAuth Application";
  const redirectUris = Array.isArray(body.redirectUris) && body.redirectUris.length > 0 ? body.redirectUris : ["https://localhost/callback"];
  const isConfidential = body.clientType === "confidential";

  // Validate redirect URIs: exact match, no wildcards
  for (const uri of redirectUris) {
    if (uri.includes("*")) {
      return NextResponse.json({ error: "Wildcard redirect URIs are not allowed" }, { status: 400 });
    }
    try {
      new URL(uri);
    } catch {
      return NextResponse.json({ error: `Invalid redirect URI: ${uri}` }, { status: 400 });
    }
  }

  await ensureSchema();
  const pool = getPool();

  // Resolve user ID
  let uRes = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [session.user.email]);
  let userId = uRes.rows[0]?.id;
  if (!userId) {
    userId = `usr_${randomBytes(12).toString("hex")}`;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, now(), now()) ON CONFLICT (email) DO UPDATE SET "updatedAt" = now() RETURNING id`,
      [userId, session.user.name || session.user.email, session.user.email]
    );
  }

  const clientId = `client_${randomBytes(16).toString("hex")}`;
  let clientSecret: string | null = null;

  if (isConfidential) {
    clientSecret = `secret_${randomBytes(32).toString("hex")}`;
  }

  const tokenEndpointAuthMethod = isConfidential ? "client_secret_post" : "none";
  const requirePKCE = true; // Mandatory PKCE
  const id = `cl_${randomBytes(12).toString("hex")}`;

  await pool.query(
    `INSERT INTO "oauthClient" (
      id, "clientId", "clientSecret", name, "redirectUris",
      "tokenEndpointAuthMethod", "requirePKCE", "userId", scopes, "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
    [
      id,
      clientId,
      clientSecret,
      name,
      redirectUris,
      tokenEndpointAuthMethod,
      requirePKCE,
      userId,
      body.scopes || ["openid", "profile", "email"],
    ]
  );

  await logAuditEvent({
    event: "oauth.client.created",
    outcome: "success",
    userId,
    userEmail: session.user.email,
    clientId,
    details: { name, clientType: body.clientType || "public", redirectUris },
  });

  return NextResponse.json(
    {
      client: {
        id,
        clientId,
        clientSecret, // Shown once upon creation for confidential clients
        name,
        redirectUris,
        tokenEndpointAuthMethod,
        requirePKCE,
      },
    },
    { status: 201 }
  );
}
