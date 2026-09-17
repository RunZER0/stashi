import pg from "pg";
import crypto from "node:crypto";
const { Pool } = pg;

const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
if (!connectionString) {
  console.error("Error: CONTROL_PLANE_DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 2 });

const MIGRATIONS = [
  {
    version: "20260916_001",
    name: "core_stashi_schema",
    up: `
      CREATE TABLE IF NOT EXISTS users (
        email text PRIMARY KEY,
        first_seen_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS databases (
        id text PRIMARY KEY,
        owner_email text NOT NULL REFERENCES users(email),
        name text NOT NULL,
        plan text NOT NULL,
        region text NOT NULL,
        status text NOT NULL,
        version text NOT NULL,
        host text NOT NULL,
        port integer NOT NULL,
        database_name text NOT NULL,
        username text NOT NULL,
        password text NOT NULL,
        connection_url text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS scoped_keys (
        id text PRIMARY KEY,
        database_id text NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
        role text NOT NULL,
        api_key text NOT NULL UNIQUE,
        connection_url text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS account_keys (
        id text PRIMARY KEY,
        owner_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        name text NOT NULL,
        role text NOT NULL,
        api_key text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      );
    `,
  },
  {
    version: "20260916_002",
    name: "better_auth_core",
    up: `
      CREATE TABLE IF NOT EXISTS "user" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "image" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "session" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "token" text NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "account" (
        "id" text PRIMARY KEY,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "accountId" text NOT NULL,
        "providerId" text NOT NULL,
        "accessToken" text,
        "refreshToken" text,
        "idToken" text,
        "accessTokenExpiresAt" timestamptz,
        "refreshTokenExpiresAt" timestamptz,
        "scope" text,
        "password" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "verification" (
        "id" text PRIMARY KEY,
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "jwks" (
        "id" text PRIMARY KEY,
        "publicKey" text NOT NULL,
        "privateKey" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "expiresAt" timestamptz,
        "alg" text,
        "crv" text
      );
    `,
  },
  {
    version: "20260916_003",
    name: "better_auth_oauth_provider",
    up: `
      CREATE TABLE IF NOT EXISTS "oauthClient" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL UNIQUE,
        "clientSecret" text,
        "clientDiscoveryId" text,
        "name" text,
        "icon" text,
        "metadata" text,
        "type" text NOT NULL DEFAULT 'public',
        "redirectUrls" text,
        "redirectUris" text,
        "postLogoutRedirectUris" text,
        "backchannelLogoutUri" text,
        "backchannelLogoutSessionRequired" boolean,
        "tokenEndpointAuthMethod" text,
        "applicationType" text,
        "jwks" text,
        "jwksUri" text,
        "grantTypes" text,
        "responseTypes" text,
        "requirePKCE" boolean DEFAULT true,
        "dpopBoundAccessTokens" boolean DEFAULT false,
        "referenceId" text,
        "disabled" boolean NOT NULL DEFAULT false,
        "skipConsent" boolean DEFAULT false,
        "enableEndSession" boolean DEFAULT false,
        "subjectType" text,
        "scopes" text,
        "clientCredentialsScopes" text,
        "uri" text,
        "contacts" text,
        "tos" text,
        "policy" text,
        "softwareId" text,
        "softwareVersion" text,
        "softwareStatement" text,
        "userId" text REFERENCES "user"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthResource" (
        "id" text PRIMARY KEY,
        "name" text,
        "identifier" text NOT NULL UNIQUE,
        "metadata" text,
        "accessTokenTtl" integer,
        "refreshTokenTtl" integer,
        "signingAlgorithm" text,
        "signingKeyId" text,
        "allowedScopes" text,
        "customClaims" text,
        "dpopBoundAccessTokensRequired" boolean DEFAULT false,
        "disabled" boolean DEFAULT false,
        "policyVersion" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthClientResource" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "resourceId" text NOT NULL REFERENCES "oauthResource"("id") ON DELETE CASCADE,
        "metadata" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
        "id" text PRIMARY KEY,
        "token" text NOT NULL UNIQUE,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "sessionId" text REFERENCES "session"("id") ON DELETE CASCADE,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "scope" text,
        "scopes" text,
        "resources" text,
        "referenceId" text,
        "authorizationCodeId" text,
        "requestedUserInfoClaims" text,
        "rotatedAt" timestamptz,
        "rotationReplayResponse" text,
        "rotationReplayExpiresAt" timestamptz,
        "authTime" timestamptz,
        "confirmation" text,
        "expiresAt" timestamptz NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthAccessToken" (
        "id" text PRIMARY KEY,
        "token" text NOT NULL UNIQUE,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "sessionId" text REFERENCES "session"("id") ON DELETE CASCADE,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "refreshTokenId" text REFERENCES "oauthRefreshToken"("id") ON DELETE CASCADE,
        "scope" text,
        "scopes" text,
        "resources" text,
        "referenceId" text,
        "authorizationCodeId" text,
        "requestedUserInfoClaims" text,
        "refreshId" text,
        "confirmation" text,
        "expiresAt" timestamptz NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthConsent" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "scope" text,
        "scopes" text,
        "resources" text,
        "referenceId" text,
        "requestedUserInfoClaims" text,
        "consentGiven" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
        "id" text PRIMARY KEY,
        "clientId" text REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "jti" text UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: "20260916_004",
    name: "projects_multitenancy_audit",
    up: `
      CREATE TABLE IF NOT EXISTS projects (
        id text PRIMARY KEY,
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS project_members (
        id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_email text NOT NULL,
        role text NOT NULL DEFAULT 'member',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_project_member UNIQUE (project_id, user_email)
      );

      CREATE TABLE IF NOT EXISTS auth_audit_events (
        id text PRIMARY KEY,
        timestamp timestamptz NOT NULL DEFAULT now(),
        event text NOT NULL,
        outcome text NOT NULL,
        request_id text,
        user_id text,
        project_id text,
        client_id text,
        ip text,
        user_agent text,
        details jsonb NOT NULL DEFAULT '{}'::jsonb
      );

      ALTER TABLE databases ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS key_hash text;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS key_prefix text;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS key_hash text;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS key_prefix text;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
    `,
  },
  {
    version: "20260916_005",
    name: "backfill_user_projects",
    up: `
      INSERT INTO projects (id, name, slug)
      SELECT 
        'proj_' || substr(md5(email), 1, 16),
        split_part(email, '@', 1) || '''s Project',
        split_part(email, '@', 1) || '-' || substr(md5(email), 1, 6)
      FROM users
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO project_members (id, project_id, user_email, role)
      SELECT 
        'pm_' || substr(md5(u.email || p.id), 1, 16),
        p.id,
        u.email,
        'owner'
      FROM users u
      JOIN projects p ON p.id = 'proj_' || substr(md5(u.email), 1, 16)
      ON CONFLICT (project_id, user_email) DO NOTHING;

      UPDATE databases d
      SET project_id = p.id
      FROM projects p
      WHERE d.project_id IS NULL AND p.id = 'proj_' || substr(md5(d.owner_email), 1, 16);
    `,
  },
];

async function run() {
  console.log("=== Stashi Unified Migration Runner ===");
  const client = await pool.connect();
  try {
    // 1. Create migration tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stashi_schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 2. Fetch applied migrations
    const { rows: applied } = await client.query(`SELECT version FROM stashi_schema_migrations`);
    const appliedSet = new Set(applied.map((r) => r.version));

    let count = 0;
    for (const m of MIGRATIONS) {
      if (appliedSet.has(m.version)) {
        console.log(`✓ Migration [${m.version}] ${m.name} already applied.`);
        continue;
      }

      console.log(`→ Applying migration [${m.version}] ${m.name}...`);
      const checksum = crypto.createHash("sha256").update(m.up).digest("hex");

      await client.query("BEGIN");
      try {
        await client.query(m.up);
        await client.query(
          `INSERT INTO stashi_schema_migrations (version, name, checksum) VALUES ($1, $2, $3)`,
          [m.version, m.name, checksum]
        );
        await client.query("COMMIT");
        console.log(`  ✓ Applied [${m.version}] successfully.`);
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  ✗ Migration [${m.version}] failed. Rolled back transaction.`, err);
        process.exit(1);
      }
    }

    console.log(`=== Migration run completed: ${count} new migrations applied. ===`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
