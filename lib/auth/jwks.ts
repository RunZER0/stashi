import { ensureSchema, getPool } from "../db";

export interface JwkKey {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  alg?: string;
  use?: string;
  kid?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface JwksResponse {
  keys: JwkKey[];
}

export async function getPublicJwks(): Promise<JwksResponse> {
  await ensureSchema();
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, "publicKey", alg, crv FROM "jwks" WHERE "expiresAt" IS NULL OR "expiresAt" > now() ORDER BY "createdAt" DESC`
  );

  if (rows.length === 0) {
    try {
      const { generateKeyPair, exportJWK } = await import("jose");
      const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
      const publicJwk = await exportJWK(publicKey);
      const privateJwk = await exportJWK(privateKey);
      const keyId = "key_" + Math.random().toString(36).substring(2, 12);

      await pool.query(
        `INSERT INTO "jwks" (id, "publicKey", "privateKey", alg, crv) VALUES ($1, $2, $3, $4, $5)`,
        [keyId, JSON.stringify(publicJwk), JSON.stringify(privateJwk), "EdDSA", publicJwk.crv || "Ed25519"]
      );

      return {
        keys: [
          {
            kty: publicJwk.kty || "OKP",
            kid: keyId,
            alg: "EdDSA",
            use: "sig",
            ...publicJwk,
          },
        ],
      };
    } catch {
      return { keys: [] };
    }
  }

  const keys: JwkKey[] = [];
  for (const row of rows) {
    try {
      const parsed = typeof row.publicKey === "string" ? JSON.parse(row.publicKey) : row.publicKey;
      if (parsed) {
        keys.push({
          kid: row.id,
          alg: row.alg || parsed.alg || "EdDSA",
          use: "sig",
          ...parsed,
        });
      }
    } catch {
      // Ignore malformed key records
    }
  }

  return { keys };
}
