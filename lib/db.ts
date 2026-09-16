import { Pool } from "pg";

// Real Postgres-backed control-plane storage — a dedicated, non-superuser
// tenant (`stashi_control_owner` / `stashi_control`) on the same VPS that
// runs customer databases, reached the same way any customer would: through
// PgBouncer on 6432 with TLS. This replaced an earlier JSON-file store, which
// was only ever a stopgap for when no real database connection existed yet.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.CONTROL_PLANE_DATABASE_URL;
    if (!connectionString) {
      throw new Error("CONTROL_PLANE_DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString, max: 5 });
  }
  return pool;
}

let migrated = false;

export async function ensureSchema() {
  if (migrated) return;
  const pool = getPool();
  await pool.query(`
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
      api_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      storage_used_mb integer NOT NULL DEFAULT 0,
      connections integer NOT NULL DEFAULT 0,
      p95_latency_ms integer,
      tenancy_mode text NOT NULL DEFAULT 'isolated',
      pool_schema text
    );
    CREATE INDEX IF NOT EXISTS databases_owner_idx ON databases(owner_email);
    ALTER TABLE databases ADD COLUMN IF NOT EXISTS tenancy_mode text NOT NULL DEFAULT 'isolated';
    ALTER TABLE databases ADD COLUMN IF NOT EXISTS pool_schema text;
    ALTER TABLE databases ADD COLUMN IF NOT EXISTS expires_at timestamptz;
    ALTER TABLE databases ADD COLUMN IF NOT EXISTS parent_database_id text;
    CREATE INDEX IF NOT EXISTS databases_expires_idx ON databases(expires_at) WHERE expires_at IS NOT NULL;

    CREATE TABLE IF NOT EXISTS activity (
      id text PRIMARY KEY,
      owner_email text NOT NULL REFERENCES users(email),
      actor text NOT NULL,
      action text NOT NULL,
      target text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS activity_owner_idx ON activity(owner_email, created_at DESC);

    CREATE TABLE IF NOT EXISTS nodes (
      id text PRIMARY KEY,
      label text NOT NULL,
      region text NOT NULL,
      cpu_pct real,
      memory_pct real,
      disk_pct real,
      database_count integer NOT NULL DEFAULT 0,
      capacity_status text NOT NULL DEFAULT 'pending',
      last_heartbeat timestamptz
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id text PRIMARY KEY,
      node_id text NOT NULL,
      type text NOT NULL,
      payload jsonb NOT NULL,
      status text NOT NULL,
      owner_email text NOT NULL REFERENCES users(email),
      database_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      result jsonb,
      error text
    );
    CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status, node_id);

    -- Point-in-time snapshots. "checkpoint" (fast, manual/agent-triggered,
    -- meant for rapid rollback during iterative schema changes) and "backup"
    -- (the plan's scheduled/retained snapshot) are the same underlying
    -- pg_dump mechanism with a different kind tag and retention policy —
    -- one real system instead of two parallel fake ones.
    CREATE TABLE IF NOT EXISTS checkpoints (
      id text PRIMARY KEY,
      database_id text NOT NULL,
      owner_email text NOT NULL REFERENCES users(email),
      kind text NOT NULL DEFAULT 'checkpoint',
      label text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      size_bytes bigint,
      file_path text,
      off_node boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      error text
    );
    CREATE INDEX IF NOT EXISTS checkpoints_database_idx ON checkpoints(database_id, created_at DESC);
    ALTER TABLE checkpoints ADD COLUMN IF NOT EXISTS off_node boolean NOT NULL DEFAULT false;

    -- Per-agent scoped API keys. A database's primary api_key column stays
    -- the full-access owner key (shown in the console's MCP config); these
    -- are additional, individually revocable keys -- so a swarm of subagents
    -- sharing one database still shows up as distinct actors in the audit
    -- log, and a key can be minted read-only for an agent that should never
    -- write.
    CREATE TABLE IF NOT EXISTS scoped_keys (
      id text PRIMARY KEY,
      database_id text NOT NULL,
      owner_email text NOT NULL REFERENCES users(email),
      label text NOT NULL,
      api_key text NOT NULL UNIQUE,
      scope text NOT NULL DEFAULT 'full',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS scoped_keys_database_idx ON scoped_keys(database_id);
    CREATE INDEX IF NOT EXISTS scoped_keys_lookup_idx ON scoped_keys(api_key) WHERE revoked_at IS NULL;

    -- Account-wide keys: same idea as scoped_keys, but not tied to one
    -- database_id -- valid for every database the owner has, present or
    -- future. Lets one MCP connection (one URL) reach all of an account's
    -- databases instead of needing a separate connector per database. Full
    -- scope on an account key still can't do anything a full per-database
    -- key couldn't already do to that same database; the only thing it
    -- adds is not having to pick which database ahead of time.
    CREATE TABLE IF NOT EXISTS account_keys (
      id text PRIMARY KEY,
      owner_email text NOT NULL REFERENCES users(email),
      label text NOT NULL,
      api_key text NOT NULL UNIQUE,
      scope text NOT NULL DEFAULT 'full',
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS account_keys_owner_idx ON account_keys(owner_email);
    CREATE INDEX IF NOT EXISTS account_keys_lookup_idx ON account_keys(api_key) WHERE revoked_at IS NULL;

    INSERT INTO nodes (id, label, region, capacity_status)
    VALUES ('node-nj-01', 'NJ · 01', 'New Jersey, US', 'pending')
    ON CONFLICT (id) DO NOTHING;

    -- Better Auth core tables
    CREATE TABLE IF NOT EXISTS "user" (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      image text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "session" (
      id text PRIMARY KEY,
      "expiresAt" timestamptz NOT NULL,
      token text NOT NULL UNIQUE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");

    CREATE TABLE IF NOT EXISTS "account" (
      id text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      scope text,
      password text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

    CREATE TABLE IF NOT EXISTS "verification" (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "jwks" (
      id text PRIMARY KEY,
      "publicKey" text NOT NULL,
      "privateKey" text NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "expiresAt" timestamptz,
      alg text,
      crv text
    );

    CREATE TABLE IF NOT EXISTS "oauthClient" (
      id text PRIMARY KEY,
      "clientId" text NOT NULL UNIQUE,
      "clientSecret" text,
      "clientDiscoveryId" text,
      disabled boolean DEFAULT false,
      "skipConsent" boolean DEFAULT false,
      "enableEndSession" boolean DEFAULT false,
      "subjectType" text,
      scopes text[],
      "clientCredentialsScopes" text[],
      "userId" text REFERENCES "user"(id) ON DELETE CASCADE,
      "createdAt" timestamptz DEFAULT now(),
      "updatedAt" timestamptz DEFAULT now(),
      name text,
      uri text,
      icon text,
      contacts text[],
      tos text,
      policy text,
      "softwareId" text,
      "softwareVersion" text,
      "softwareStatement" text,
      "redirectUris" text[] NOT NULL,
      "postLogoutRedirectUris" text[],
      "backchannelLogoutUri" text,
      "backchannelLogoutSessionRequired" boolean,
      "tokenEndpointAuthMethod" text,
      "applicationType" text,
      jwks text,
      "jwksUri" text,
      "grantTypes" text[],
      "responseTypes" text[],
      "requirePKCE" boolean,
      "dpopBoundAccessTokens" boolean DEFAULT false,
      "referenceId" text,
      metadata jsonb
    );

    CREATE TABLE IF NOT EXISTS "oauthResource" (
      id text PRIMARY KEY,
      identifier text NOT NULL UNIQUE,
      name text NOT NULL,
      "accessTokenTtl" integer,
      "refreshTokenTtl" integer,
      "signingAlgorithm" text,
      "signingKeyId" text,
      "allowedScopes" text[],
      "customClaims" jsonb,
      "dpopBoundAccessTokensRequired" boolean DEFAULT false,
      disabled boolean DEFAULT false,
      "createdAt" timestamptz DEFAULT now(),
      "updatedAt" timestamptz DEFAULT now(),
      "policyVersion" integer DEFAULT 1,
      metadata jsonb
    );

    CREATE TABLE IF NOT EXISTS "oauthClientResource" (
      id text PRIMARY KEY,
      "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE CASCADE,
      "resourceId" text NOT NULL REFERENCES "oauthResource"(identifier) ON DELETE CASCADE,
      metadata jsonb,
      "createdAt" timestamptz DEFAULT now(),
      UNIQUE("clientId", "resourceId")
    );

    CREATE TABLE IF NOT EXISTS "oauthRefreshToken" (
      id text PRIMARY KEY,
      token text NOT NULL UNIQUE,
      "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE CASCADE,
      "sessionId" text REFERENCES "session"(id) ON DELETE SET NULL,
      "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "referenceId" text,
      "authorizationCodeId" text,
      resources text[],
      "requestedUserInfoClaims" text[],
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      revoked timestamptz,
      "rotatedAt" timestamptz,
      "rotationReplayResponse" text,
      "rotationReplayExpiresAt" timestamptz,
      "authTime" timestamptz,
      confirmation jsonb,
      scopes text[] NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "oauthRefreshToken_clientId_idx" ON "oauthRefreshToken"("clientId");
    CREATE INDEX IF NOT EXISTS "oauthRefreshToken_userId_idx" ON "oauthRefreshToken"("userId");

    CREATE TABLE IF NOT EXISTS "oauthAccessToken" (
      id text PRIMARY KEY,
      token text UNIQUE,
      "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE CASCADE,
      "sessionId" text REFERENCES "session"(id) ON DELETE SET NULL,
      "userId" text REFERENCES "user"(id) ON DELETE CASCADE,
      "referenceId" text,
      "authorizationCodeId" text,
      resources text[],
      "requestedUserInfoClaims" text[],
      "refreshId" text REFERENCES "oauthRefreshToken"(id) ON DELETE CASCADE,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      revoked timestamptz,
      confirmation jsonb,
      scopes text[] NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "oauthAccessToken_clientId_idx" ON "oauthAccessToken"("clientId");
    CREATE INDEX IF NOT EXISTS "oauthAccessToken_userId_idx" ON "oauthAccessToken"("userId");

    CREATE TABLE IF NOT EXISTS "oauthConsent" (
      id text PRIMARY KEY,
      "clientId" text NOT NULL REFERENCES "oauthClient"("clientId") ON DELETE CASCADE,
      "userId" text REFERENCES "user"(id) ON DELETE CASCADE,
      "referenceId" text,
      resources text[],
      "requestedUserInfoClaims" text[],
      scopes text[] NOT NULL,
      "createdAt" timestamptz DEFAULT now(),
      "updatedAt" timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "oauthConsent_client_user_idx" ON "oauthConsent"("clientId", "userId");

    CREATE TABLE IF NOT EXISTS "oauthClientAssertion" (
      id text PRIMARY KEY,
      "expiresAt" timestamptz NOT NULL
    );

    -- Stashi Project Multi-Tenancy & RBAC
    CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY,
      name text NOT NULL,
      slug text UNIQUE,
      owner_user_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id text PRIMARY KEY,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'owner',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(project_id, user_email)
    );
    CREATE INDEX IF NOT EXISTS project_members_lookup_idx ON project_members(project_id, user_email);
    CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members(user_email);

    -- Stashi Audit Logging
    CREATE TABLE IF NOT EXISTS auth_audit_events (
      id text PRIMARY KEY,
      timestamp timestamptz NOT NULL DEFAULT now(),
      request_id text,
      user_id text,
      project_id text,
      client_id text,
      event text NOT NULL,
      outcome text NOT NULL,
      ip text,
      user_agent text,
      details jsonb
    );
    CREATE INDEX IF NOT EXISTS auth_audit_events_event_idx ON auth_audit_events(event, timestamp DESC);
    CREATE INDEX IF NOT EXISTS auth_audit_events_user_idx ON auth_audit_events(user_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS auth_audit_events_project_idx ON auth_audit_events(project_id, timestamp DESC);

    -- Add project_id & hashed key columns
    ALTER TABLE databases ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id);
    CREATE INDEX IF NOT EXISTS databases_project_idx ON databases(project_id);

    ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id);
    ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS key_hash text;
    ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS key_prefix text;
    ALTER TABLE scoped_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
    CREATE INDEX IF NOT EXISTS scoped_keys_hash_idx ON scoped_keys(key_hash) WHERE revoked_at IS NULL;

    ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id);
    ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS key_hash text;
    ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS key_prefix text;
    ALTER TABLE account_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
    CREATE INDEX IF NOT EXISTS account_keys_hash_idx ON account_keys(key_hash) WHERE revoked_at IS NULL;

    -- Additive migration backfill: ensure default projects for existing users
    INSERT INTO projects (id, name, slug)
    SELECT 'proj_' || substr(md5(email), 1, 16), 'Personal', 'personal-' || substr(md5(email), 1, 8)
    FROM users
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO project_members (id, project_id, user_email, role)
    SELECT 'pm_' || substr(md5(email), 1, 16), 'proj_' || substr(md5(email), 1, 16), email, 'owner'
    FROM users
    ON CONFLICT (project_id, user_email) DO NOTHING;

    UPDATE databases d
    SET project_id = 'proj_' || substr(md5(d.owner_email), 1, 16)
    WHERE d.project_id IS NULL;

    UPDATE scoped_keys k
    SET project_id = 'proj_' || substr(md5(k.owner_email), 1, 16)
    WHERE k.project_id IS NULL;

    UPDATE account_keys a
    SET project_id = 'proj_' || substr(md5(a.owner_email), 1, 16)
    WHERE a.project_id IS NULL;
  `);
  migrated = true;
}
