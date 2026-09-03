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
      created_at timestamptz NOT NULL DEFAULT now(),
      error text
    );
    CREATE INDEX IF NOT EXISTS checkpoints_database_idx ON checkpoints(database_id, created_at DESC);

    INSERT INTO nodes (id, label, region, capacity_status)
    VALUES ('node-nj-01', 'NJ · 01', 'New Jersey, US', 'pending')
    ON CONFLICT (id) DO NOTHING;
  `);
  migrated = true;
}
