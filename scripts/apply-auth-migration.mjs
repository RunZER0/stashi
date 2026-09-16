import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
if (!connectionString) {
  console.error("CONTROL_PLANE_DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 2 });

async function run() {
  console.log("Connecting to Stashi control plane database...");
  const client = await pool.connect();
  try {
    console.log("Connected. Applying non-destructive schema migrations...");
    await client.query("BEGIN");

    // Existing core tables
    await client.query(`
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
        key_secret text NOT NULL,
        connection_url text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      );

      CREATE TABLE IF NOT EXISTS account_keys (
        id text PRIMARY KEY,
        owner_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        name text NOT NULL,
        role text NOT NULL,
        key_secret text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz
      );
    `);

    // Better Auth Core Tables
    await client.query(`
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
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Better Auth OAuth 2.1 Provider Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS "oauthClient" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL UNIQUE,
        "clientSecret" text,
        "name" text,
        "icon" text,
        "metadata" text,
        "type" text NOT NULL DEFAULT 'public',
        "redirectUrls" text NOT NULL,
        "disabled" boolean NOT NULL DEFAULT false,
        "userId" text REFERENCES "user"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthResource" (
        "id" text PRIMARY KEY,
        "name" text,
        "identifier" text NOT NULL UNIQUE,
        "metadata" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthClientResource" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "resourceId" text NOT NULL REFERENCES "oauthResource"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
        "id" text PRIMARY KEY,
        "token" text NOT NULL UNIQUE,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "sessionId" text REFERENCES "session"("id") ON DELETE CASCADE,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "scope" text NOT NULL,
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
        "scope" text NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "revoked" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthConsent" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "scope" text NOT NULL,
        "consentGiven" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
        "id" text PRIMARY KEY,
        "clientId" text NOT NULL REFERENCES "oauthClient"("id") ON DELETE CASCADE,
        "jti" text NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Multi-tenancy & Project Authorization Tables
    await client.query(`
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
    `);

    // Additive columns
    await client.query(`
      ALTER TABLE databases ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS key_hash text;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS key_prefix text;
      ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS key_hash text;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS key_prefix text;
      ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
    `);

    // Backfill projects for existing users
    await client.query(`
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

      -- Link databases without project_id to owner default project
      UPDATE databases d
      SET project_id = p.id
      FROM projects p
      WHERE d.project_id IS NULL AND p.id = 'proj_' || substr(md5(d.owner_email), 1, 16);
    `);

    await client.query("COMMIT");
    console.log("MIGRATIONS_APPLIED_SUCCESSFULLY");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
