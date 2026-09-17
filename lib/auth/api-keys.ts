import { createHash, randomBytes } from "node:crypto";
import { ensureSchema, getPool } from "../db";
import type { ScopedKeyScope } from "../control-plane";

export interface StashiApiKeyRecord {
  id: string;
  kind: "database" | "account";
  email: string;
  projectId: string;
  databaseId?: string;
  label: string;
  keyPrefix: string;
  scope: ScopedKeyScope;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
}

export interface GeneratedKeyResult {
  keyRecord: StashiApiKeyRecord;
  plaintextKey: string;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateRawApiKey(): { plaintextKey: string; keyHash: string; keyPrefix: string } {
  // Safe prefix: stashi_live_<24 random bytes in base64url>
  const entropy = randomBytes(24).toString("base64url");
  const plaintextKey = `stashi_live_${entropy}`;
  const keyPrefix = plaintextKey.slice(0, 16);
  const keyHash = hashApiKey(plaintextKey);
  return { plaintextKey, keyHash, keyPrefix };
}

/**
 * Creates a new hashed account key.
 */
export async function createHashedAccountKey(
  email: string,
  label: string,
  scope: ScopedKeyScope = "full",
  expiresInDays?: number
): Promise<GeneratedKeyResult> {
  await ensureSchema();
  const pool = getPool();
  const { plaintextKey, keyHash, keyPrefix } = generateRawApiKey();
  const id = `ack_${randomBytes(12).toString("hex")}`;
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

  // Resolve user's project
  const pRes = await pool.query(`SELECT project_id FROM project_members WHERE user_email = $1 LIMIT 1`, [email]);
  const projectId = pRes.rows[0]?.project_id || `proj_${createHash("md5").update(email).digest("hex").slice(0, 16)}`;

  await pool.query(
    `INSERT INTO account_keys (id, owner_email, project_id, label, api_key, key_hash, key_prefix, scope, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, email, projectId, label, plaintextKey, keyHash, keyPrefix, scope, expiresAt]
  );

  return {
    plaintextKey,
    keyRecord: {
      id,
      kind: "account",
      email,
      projectId,
      label,
      keyPrefix,
      scope,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    },
  };
}

/**
 * Resolves an incoming API key, checking both new hashed keys and legacy plaintext keys.
 */
export async function resolveApiKey(rawKey: string): Promise<StashiApiKeyRecord | null> {
  if (!rawKey || typeof rawKey !== "string") return null;
  await ensureSchema();
  const pool = getPool();
  const keyHash = hashApiKey(rawKey);
  const now = new Date();

  // 1. Check account_keys by hash or legacy plaintext
  const { rows: accRows } = await pool.query(
    `SELECT id, owner_email, project_id, label, key_prefix, scope, created_at, last_used_at, revoked_at, expires_at
     FROM account_keys
     WHERE (key_hash = $1 OR api_key = $2) AND revoked_at IS NULL`,
    [keyHash, rawKey]
  );

  if (accRows[0]) {
    const row = accRows[0];
    if (row.expires_at && new Date(row.expires_at) < now) return null;

    // Update last_used_at asynchronously
    pool.query(`UPDATE account_keys SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {});

    return {
      id: row.id,
      kind: "account",
      email: row.owner_email,
      projectId: row.project_id,
      label: row.label,
      keyPrefix: row.key_prefix || row.api_key?.slice(0, 12) || "stashi_...",
      scope: row.scope,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
      revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    };
  }

  // 2. Check scoped_keys by hash or legacy plaintext
  const { rows: scpRows } = await pool.query(
    `SELECT id, database_id, owner_email, project_id, label, key_prefix, scope, created_at, last_used_at, revoked_at, expires_at
     FROM scoped_keys
     WHERE (key_hash = $1 OR api_key = $2) AND revoked_at IS NULL`,
    [keyHash, rawKey]
  );

  if (scpRows[0]) {
    const row = scpRows[0];
    if (row.expires_at && new Date(row.expires_at) < now) return null;

    pool.query(`UPDATE scoped_keys SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {});

    return {
      id: row.id,
      kind: "database",
      databaseId: row.database_id,
      email: row.owner_email,
      projectId: row.project_id,
      label: row.label,
      keyPrefix: row.key_prefix || row.api_key?.slice(0, 12) || "stashi_...",
      scope: row.scope,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
      revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    };
  }

  // 3. Check databases primary api_key (full access)
  const { rows: dbRows } = await pool.query(
    `SELECT id, owner_email, project_id FROM databases WHERE api_key = $1`,
    [rawKey]
  );

  if (dbRows[0]) {
    const row = dbRows[0];
    return {
      id: `primary_${row.id}`,
      kind: "database",
      databaseId: row.id,
      email: row.owner_email,
      projectId: row.project_id,
      label: "Primary Database Key",
      keyPrefix: rawKey.slice(0, 8),
      scope: "full",
      createdAt: now.toISOString(),
    };
  }

  return null;
}
