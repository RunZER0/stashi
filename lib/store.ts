import { randomBytes } from "node:crypto";
import { ensureSchema, getPool } from "./db";
import type {
  ActivityEntry,
  AgentJob,
  AgentJobStatus,
  Checkpoint,
  CheckpointKind,
  ManagedDatabase,
  Node,
  ScopedKey,
  ScopedKeyScope,
} from "./control-plane";
import { getPlan, type PlanId } from "./plans";

// Real Postgres-backed control plane. See lib/db.ts for why: this used to be
// a JSON file on local disk, which only worked as a stopgap — it doesn't
// survive a redeploy on a host without a persistent disk, and disks cost
// extra. There's already a real, paid-for Postgres server (the same VPS that
// runs customer databases) sitting idle for this purpose.

const DEFAULT_NODE_ID = "node-nj-01";

// Every Dev-tier ("pooled") tenant lives as its own schema inside this one
// shared database, isolated by Postgres's own permission model (own schema,
// own role, default-deny on everyone else's) rather than a dedicated
// database — that's how the $1/mo tier stays cheap without losing isolation.
export const POOL_DATABASE = "stashi_pool";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) || "database";

function rowToDatabase(row: any): ManagedDatabase {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    region: row.region,
    status: row.status,
    version: row.version,
    host: row.host,
    port: row.port,
    database: row.database_name,
    username: row.username,
    password: row.password,
    apiKey: row.api_key,
    createdAt: row.created_at.toISOString(),
    storageUsedMb: row.storage_used_mb,
    connections: row.connections,
    p95LatencyMs: row.p95_latency_ms,
    tenancyMode: row.tenancy_mode,
    poolSchema: row.pool_schema,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    parentDatabaseId: row.parent_database_id,
  };
}

function rowToScopedKey(row: any): ScopedKey {
  return {
    id: row.id,
    databaseId: row.database_id,
    label: row.label,
    apiKey: row.api_key,
    scope: row.scope,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
  };
}

function rowToActivity(row: any): ActivityEntry {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    createdAt: row.created_at.toISOString(),
  };
}

function rowToNode(row: any): Node {
  return {
    id: row.id,
    label: row.label,
    region: row.region,
    cpuPct: row.cpu_pct,
    memoryPct: row.memory_pct,
    diskPct: row.disk_pct,
    databaseCount: row.database_count,
    capacityStatus: row.capacity_status,
    lastHeartbeat: row.last_heartbeat ? row.last_heartbeat.toISOString() : null,
  };
}

function rowToJob(row: any): AgentJob {
  return {
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    payload: row.payload,
    status: row.status,
    ownerEmail: row.owner_email,
    databaseId: row.database_id,
    createdAt: row.created_at.toISOString(),
    result: row.result ?? undefined,
    error: row.error ?? undefined,
  };
}

function rowToCheckpoint(row: any): Checkpoint {
  return {
    id: row.id,
    databaseId: row.database_id,
    kind: row.kind,
    label: row.label,
    status: row.status,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    offNode: row.off_node,
    createdAt: row.created_at.toISOString(),
    error: row.error ?? undefined,
  };
}

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

async function pushActivity(email: string, actor: string, action: string, target: string) {
  await getPool().query(
    `INSERT INTO activity (id, owner_email, actor, action, target) VALUES ($1,$2,$3,$4,$5)`,
    [newId("ev"), email, actor, action, target]
  );
}

export async function recordUserSeen(email: string) {
  await ensureSchema();
  await getPool().query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);
}

export async function listDatabases(email: string): Promise<ManagedDatabase[]> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM databases WHERE owner_email = $1 ORDER BY created_at DESC`, [
    email,
  ]);
  return rows.map(rowToDatabase);
}

export async function getDatabase(email: string, id: string): Promise<ManagedDatabase | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM databases WHERE owner_email = $1 AND id = $2`, [email, id]);
  return rows[0] ? rowToDatabase(rows[0]) : null;
}

// Creates the database record in "provisioning" state and enqueues the real
// job for the node agent to execute. The record only flips to "healthy" once
// completeJob() processes a successful result — see
// app/api/agent/jobs/complete/route.ts. Dev-tier plans provision into the
// shared pool (schema isolation); everything else gets its own database.
export async function createDatabase(
  email: string,
  input: { name: string; plan: PlanId; region: string; ttlHours?: number; parentDatabaseId?: string }
): Promise<{ database: ManagedDatabase; job: AgentJob }> {
  await ensureSchema();
  const pool = getPool();
  await pool.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);

  const safeName = slugify(input.name);
  const suffix = randomBytes(3).toString("hex");
  const password = `st_${randomBytes(12).toString("base64url")}`;
  const id = newId("db").toUpperCase();
  const apiKey = `st_live_${randomBytes(9).toString("hex")}`;
  const host = process.env.NEXT_PUBLIC_DB_HOST || "db.stashi.dev";
  const port = Number(process.env.NEXT_PUBLIC_DB_PORT || 6432);
  const name = input.name.trim() || "database";
  const plan = getPlan(input.plan);
  const pooled = input.plan === "dev";
  const expiresAt =
    input.ttlHours && input.ttlHours > 0 ? new Date(Date.now() + input.ttlHours * 3600_000) : null;

  const roleName = pooled ? `st_pool_${safeName}_${suffix}` : `st_${safeName}_${suffix}`;
  const dbNameOrSchema = pooled ? `t_${safeName}_${suffix}` : `st_${safeName}_${suffix}`;

  await pool.query(
    `INSERT INTO databases (id, owner_email, name, plan, region, status, version, host, port, database_name, username, password, api_key, tenancy_mode, pool_schema, expires_at, parent_database_id)
     VALUES ($1,$2,$3,$4,$5,'provisioning','17',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      email,
      name,
      input.plan,
      input.region || "us-east",
      host,
      port,
      pooled ? POOL_DATABASE : dbNameOrSchema,
      roleName,
      password,
      apiKey,
      pooled ? "pooled" : "isolated",
      pooled ? dbNameOrSchema : null,
      expiresAt,
      input.parentDatabaseId ?? null,
    ]
  );

  const jobId = newId("job");
  const payload = pooled
    ? {
        pool_database: POOL_DATABASE,
        schema_name: dbNameOrSchema,
        role_name: roleName,
        password,
        connection_limit: plan.connections,
      }
    : { database_name: dbNameOrSchema, role_name: roleName, password, connection_limit: plan.connections };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,$3,$4,'pending',$5,$6)`,
    [jobId, DEFAULT_NODE_ID, pooled ? "create_pool_tenant" : "create_database", JSON.stringify(payload), email, id]
  );

  await pushActivity(email, "you", "database.provisioning.queued", name);

  const database = (await getDatabase(email, id))!;
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return { database, job: rowToJob(rows[0]) };
}

// Real branching: a new database (own role, same tenancy mode as the
// source) seeded with a pg_dump of the source's current data via the same
// dump/restore machinery checkpoints already use, restored into the new
// target instead of back onto the source. Not storage-layer copy-on-write
// -- a full logical copy -- but real, and it doesn't require locking out
// the source database the way `CREATE DATABASE ... TEMPLATE` would.
export async function createBranch(
  email: string,
  sourceId: string,
  name: string,
  ttlHours?: number
): Promise<{ database: ManagedDatabase; job: AgentJob }> {
  await ensureSchema();
  const pool = getPool();
  const source = await getDatabase(email, sourceId);
  if (!source) throw new Error("not_found");
  if (source.status !== "healthy") throw new Error("database_not_ready");

  const safeName = slugify(name);
  const suffix = randomBytes(3).toString("hex");
  const password = `st_${randomBytes(12).toString("base64url")}`;
  const id = newId("db").toUpperCase();
  const apiKey = `st_live_${randomBytes(9).toString("hex")}`;
  const pooled = source.tenancyMode === "pooled";
  const plan = getPlan(source.plan);
  const expiresAt = ttlHours && ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600_000) : null;

  const roleName = pooled ? `st_pool_${safeName}_${suffix}` : `st_${safeName}_${suffix}`;
  const dbNameOrSchema = pooled ? `t_${safeName}_${suffix}` : `st_${safeName}_${suffix}`;

  await pool.query(
    `INSERT INTO databases (id, owner_email, name, plan, region, status, version, host, port, database_name, username, password, api_key, tenancy_mode, pool_schema, expires_at, parent_database_id)
     VALUES ($1,$2,$3,$4,$5,'provisioning','17',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      email,
      name.trim() || `${source.name}-branch`,
      source.plan,
      source.region,
      source.host,
      source.port,
      pooled ? POOL_DATABASE : dbNameOrSchema,
      roleName,
      password,
      apiKey,
      pooled ? "pooled" : "isolated",
      pooled ? dbNameOrSchema : null,
      expiresAt,
      sourceId,
    ]
  );

  const jobId = newId("job");
  const payload = pooled
    ? {
        source_pool_database: POOL_DATABASE,
        source_schema_name: source.poolSchema,
        target_pool_database: POOL_DATABASE,
        target_schema_name: dbNameOrSchema,
        role_name: roleName,
        password,
        connection_limit: plan.connections,
      }
    : {
        source_database_name: source.database,
        target_database_name: dbNameOrSchema,
        role_name: roleName,
        password,
        connection_limit: plan.connections,
      };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,'create_branch',$3,'pending',$4,$5)`,
    [jobId, DEFAULT_NODE_ID, JSON.stringify(payload), email, id]
  );
  await pushActivity(email, "you", "database.branch.queued", `${name} (from ${source.name})`);

  const database = (await getDatabase(email, id))!;
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return { database, job: rowToJob(rows[0]) };
}

// Finds databases past their TTL and enqueues real delete jobs for them --
// called by the control plane's TTL sweep endpoint, which the node agent
// pings periodically (see app/api/agent/ttl-sweep). Reuses deleteDatabase
// so an expired branch or scratch database is torn down exactly the way a
// manual delete would be.
export async function reapExpiredDatabases(): Promise<{ id: string; name: string; ownerEmail: string }[]> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, name, owner_email FROM databases WHERE expires_at IS NOT NULL AND expires_at < now() AND status NOT IN ('provisioning')`
  );
  const reaped: { id: string; name: string; ownerEmail: string }[] = [];
  for (const row of rows) {
    const target = await deleteDatabase(row.owner_email, row.id);
    if (target) {
      await pushActivity(row.owner_email, "system", "database.ttl_expired.deleted", row.name);
      reaped.push({ id: row.id, name: row.name, ownerEmail: row.owner_email });
    }
  }
  return reaped;
}

export async function updateDatabase(
  email: string,
  id: string,
  patch: Partial<ManagedDatabase>
): Promise<ManagedDatabase | null> {
  await ensureSchema();
  const columnMap: Record<string, string> = {
    status: "status",
    password: "password",
    storageUsedMb: "storage_used_mb",
    connections: "connections",
    p95LatencyMs: "p95_latency_ms",
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (key in patch) {
      values.push((patch as any)[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (sets.length === 0) return getDatabase(email, id);

  values.push(email, id);
  const { rows } = await getPool().query(
    `UPDATE databases SET ${sets.join(", ")} WHERE owner_email = $${values.length - 1} AND id = $${values.length} RETURNING *`,
    values
  );
  return rows[0] ? rowToDatabase(rows[0]) : null;
}

export async function deleteDatabase(email: string, id: string): Promise<ManagedDatabase | null> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query(`DELETE FROM databases WHERE owner_email = $1 AND id = $2 RETURNING *`, [
    email,
    id,
  ]);
  const target = rows[0] ? rowToDatabase(rows[0]) : null;
  if (!target) return null;

  const payload =
    target.tenancyMode === "pooled"
      ? { pool_database: POOL_DATABASE, schema_name: target.poolSchema, role_name: target.username }
      : { database_name: target.database, role_name: target.username };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,$3,$4,'pending',$5,$6)`,
    [newId("job"), DEFAULT_NODE_ID, target.tenancyMode === "pooled" ? "delete_pool_tenant" : "delete_database", JSON.stringify(payload), email, id]
  );
  await pushActivity(email, "you", "database.deleted", target.name);
  return target;
}

// Changes a database's plan. Validates the downgrade against current usage,
// enqueues a real resize job (connection limit today; storage quota
// enforcement is monitored, not filesystem-enforced -- see ops/plan-limits.md),
// and only applies the new plan once the agent confirms it, same pattern as
// create/delete.
export async function requestPlanChange(
  email: string,
  id: string,
  newPlan: PlanId
): Promise<{ database: ManagedDatabase; job: AgentJob }> {
  await ensureSchema();
  const pool = getPool();
  const current = await getDatabase(email, id);
  if (!current) throw new Error("not_found");
  if (current.plan === newPlan) throw new Error("already_on_plan");
  if (current.status !== "healthy") throw new Error("database_not_ready");

  const target = getPlan(newPlan);
  if (current.storageUsedMb > target.storageGb * 1024) {
    throw new Error(
      `Can't switch to ${target.name}: this database is using ${current.storageUsedMb} MB, over the ${target.storageGb} GB limit on that plan.`
    );
  }

  await pool.query(`UPDATE databases SET status = 'resizing' WHERE owner_email = $1 AND id = $2`, [email, id]);

  const jobId = newId("job");
  const payload = { role_name: current.username, new_plan: newPlan, connection_limit: target.connections };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,'resize_plan',$3,'pending',$4,$5)`,
    [jobId, DEFAULT_NODE_ID, JSON.stringify(payload), email, id]
  );
  await pushActivity(email, "you", "database.plan_change.queued", `${current.plan} → ${newPlan}`);

  const database = (await getDatabase(email, id))!;
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return { database, job: rowToJob(rows[0]) };
}

export async function listActivity(email: string): Promise<ActivityEntry[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT * FROM activity WHERE owner_email = $1 ORDER BY created_at DESC LIMIT 100`,
    [email]
  );
  return rows.map(rowToActivity);
}

export async function recordActivity(email: string, actor: string, action: string, target: string) {
  await ensureSchema();
  await pushActivity(email, actor, action, target);
}

export async function listNodes(): Promise<Node[]> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM nodes ORDER BY id`);
  return rows.map(rowToNode);
}

export async function recordNodeTelemetry(nodeId: string, patch: Partial<Node>) {
  await ensureSchema();
  const columnMap: Record<string, string> = {
    cpuPct: "cpu_pct",
    memoryPct: "memory_pct",
    diskPct: "disk_pct",
    databaseCount: "database_count",
    capacityStatus: "capacity_status",
  };
  const sets: string[] = ["last_heartbeat = now()"];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columnMap)) {
    if (key in patch) {
      values.push((patch as any)[key]);
      sets.push(`${column} = $${values.length}`);
    }
  }
  values.push(nodeId);
  const { rows } = await getPool().query(
    `UPDATE nodes SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return rows[0] ? rowToNode(rows[0]) : null;
}

// --- Checkpoints & backups (one real mechanism, two labels) ----------------

export async function listCheckpoints(databaseId: string): Promise<Checkpoint[]> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `SELECT * FROM checkpoints WHERE database_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [databaseId]
  );
  return rows.map(rowToCheckpoint);
}

export async function getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM checkpoints WHERE id = $1`, [checkpointId]);
  return rows[0] ? rowToCheckpoint(rows[0]) : null;
}

export async function createCheckpoint(
  email: string,
  databaseId: string,
  kind: CheckpointKind,
  label: string,
  actor: string = "you"
): Promise<{ checkpoint: Checkpoint; job: AgentJob }> {
  await ensureSchema();
  const pool = getPool();
  const db = await getDatabase(email, databaseId);
  if (!db) throw new Error("not_found");
  if (db.status !== "healthy") throw new Error("database_not_ready");

  const checkpointId = newId("cp");
  await pool.query(
    `INSERT INTO checkpoints (id, database_id, owner_email, kind, label, status) VALUES ($1,$2,$3,$4,$5,'pending')`,
    [checkpointId, databaseId, email, kind, label]
  );

  const jobId = newId("job");
  const payload =
    db.tenancyMode === "pooled"
      ? { checkpoint_id: checkpointId, pool_database: POOL_DATABASE, schema_name: db.poolSchema, kind }
      : { checkpoint_id: checkpointId, database_name: db.database, kind };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,'create_checkpoint',$3,'pending',$4,$5)`,
    [jobId, DEFAULT_NODE_ID, JSON.stringify(payload), email, databaseId]
  );
  await pushActivity(email, actor, kind === "backup" ? "backup.queued" : "checkpoint.queued", label);

  const { rows: cpRows } = await pool.query(`SELECT * FROM checkpoints WHERE id = $1`, [checkpointId]);
  const { rows: jobRows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return { checkpoint: rowToCheckpoint(cpRows[0]), job: rowToJob(jobRows[0]) };
}

export async function restoreCheckpoint(
  email: string,
  databaseId: string,
  checkpointId: string,
  actor: string = "you"
): Promise<{ job: AgentJob }> {
  await ensureSchema();
  const pool = getPool();
  const db = await getDatabase(email, databaseId);
  if (!db) throw new Error("not_found");

  const { rows: cpRows } = await pool.query(
    `SELECT * FROM checkpoints WHERE id = $1 AND database_id = $2`,
    [checkpointId, databaseId]
  );
  const checkpoint = cpRows[0] ? rowToCheckpoint(cpRows[0]) : null;
  if (!checkpoint) throw new Error("checkpoint_not_found");
  if (checkpoint.status !== "ready") throw new Error("checkpoint_not_ready");

  await pool.query(`UPDATE checkpoints SET status = 'restoring' WHERE id = $1`, [checkpointId]);
  await pool.query(`UPDATE databases SET status = 'resizing' WHERE owner_email = $1 AND id = $2`, [email, databaseId]);

  const jobId = newId("job");
  const payload =
    db.tenancyMode === "pooled"
      ? { checkpoint_id: checkpointId, pool_database: POOL_DATABASE, schema_name: db.poolSchema, role_name: db.username }
      : { checkpoint_id: checkpointId, database_name: db.database, role_name: db.username };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,'restore_checkpoint',$3,'pending',$4,$5)`,
    [jobId, DEFAULT_NODE_ID, JSON.stringify(payload), email, databaseId]
  );
  await pushActivity(email, actor, "checkpoint.restore.queued", checkpoint.label);

  const { rows: jobRows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return { job: rowToJob(jobRows[0]) };
}

// --- Agent job queue -------------------------------------------------------

export async function enqueueJob(
  nodeId: string,
  type: string,
  payload: Record<string, unknown>,
  ownerEmail: string,
  databaseId: string
): Promise<AgentJob> {
  await ensureSchema();
  const id = newId("job");
  const { rows } = await getPool().query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,$3,$4,'pending',$5,$6) RETURNING *`,
    [id, nodeId, type, JSON.stringify(payload), ownerEmail, databaseId]
  );
  return rowToJob(rows[0]);
}

// Atomically claims the oldest pending job for a node (or unassigned) using
// SKIP LOCKED, so concurrent agent polls never double-claim the same job.
export async function claimNextJob(nodeId: string): Promise<AgentJob | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE jobs SET status = 'running'
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'pending' AND (node_id = $1 OR node_id IS NULL OR node_id = '')
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [nodeId]
  );
  return rows[0] ? rowToJob(rows[0]) : null;
}

const DATABASE_STATUS_JOB_TYPES = new Set([
  "create_database",
  "create_pool_tenant",
  "create_branch",
  "resize_plan",
  "restore_checkpoint",
]);

export async function completeJob(
  jobId: string,
  status: AgentJobStatus,
  result?: Record<string, unknown>,
  error?: string
): Promise<AgentJob | null> {
  await ensureSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE jobs SET status = $2, result = COALESCE($3, result), error = COALESCE($4, error)
     WHERE id = $1 RETURNING *`,
    [jobId, status, result ? JSON.stringify(result) : null, error ?? null]
  );
  const job = rows[0] ? rowToJob(rows[0]) : null;
  if (!job) return null;

  const ok = status === "completed";

  if (job.type === "create_database" || job.type === "create_pool_tenant" || job.type === "create_branch") {
    await pool.query(`UPDATE databases SET status = $3 WHERE owner_email = $1 AND id = $2`, [
      job.ownerEmail,
      job.databaseId,
      ok ? "healthy" : "failed",
    ]);
  }

  if (job.type === "resize_plan") {
    if (ok) {
      await pool.query(`UPDATE databases SET status = 'healthy', plan = $3 WHERE owner_email = $1 AND id = $2`, [
        job.ownerEmail,
        job.databaseId,
        job.payload.new_plan,
      ]);
    } else {
      await pool.query(`UPDATE databases SET status = 'healthy' WHERE owner_email = $1 AND id = $2`, [
        job.ownerEmail,
        job.databaseId,
      ]);
    }
  }

  if (job.type === "create_checkpoint") {
    const checkpointId = job.payload.checkpoint_id as string;
    if (ok) {
      await pool.query(
        `UPDATE checkpoints SET status = 'ready', size_bytes = $2, file_path = $3, off_node = $4 WHERE id = $1`,
        [checkpointId, result?.size_bytes ?? null, result?.file_path ?? null, Boolean(result?.off_node)]
      );
    } else {
      await pool.query(`UPDATE checkpoints SET status = 'failed', error = $2 WHERE id = $1`, [
        checkpointId,
        error ?? "unknown error",
      ]);
    }
  }

  if (job.type === "restore_checkpoint") {
    const checkpointId = job.payload.checkpoint_id as string;
    await pool.query(`UPDATE checkpoints SET status = 'ready' WHERE id = $1`, [checkpointId]);
    await pool.query(`UPDATE databases SET status = $3 WHERE owner_email = $1 AND id = $2`, [
      job.ownerEmail,
      job.databaseId,
      ok ? "healthy" : "failed",
    ]);
  }

  const { rows: dbRows } = await pool.query(`SELECT name FROM databases WHERE owner_email = $1 AND id = $2`, [
    job.ownerEmail,
    job.databaseId,
  ]);
  const targetName = dbRows[0]?.name;
  if (targetName) {
    await pushActivity(job.ownerEmail, "node-agent", ok ? `${job.type}.completed` : `${job.type}.failed`, targetName);
  }

  return job;
}

// --- Scoped API keys --------------------------------------------------
// A database's primary api_key (on the databases row itself) is the
// full-access owner key shown in the console's MCP config. These are
// additional keys for individual agents in a swarm sharing one database --
// each one revocable on its own, optionally read-only, and distinguishable
// in the audit log by label instead of every agent looking identical.

export async function listScopedKeys(email: string, databaseId: string): Promise<ScopedKey[]> {
  await ensureSchema();
  const db = await getDatabase(email, databaseId);
  if (!db) throw new Error("not_found");
  const { rows } = await getPool().query(
    `SELECT * FROM scoped_keys WHERE database_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
    [databaseId]
  );
  return rows.map(rowToScopedKey);
}

export async function createScopedKey(
  email: string,
  databaseId: string,
  label: string,
  scope: ScopedKeyScope
): Promise<ScopedKey> {
  await ensureSchema();
  const db = await getDatabase(email, databaseId);
  if (!db) throw new Error("not_found");

  const id = newId("key");
  const apiKey = `st_${scope === "readonly" ? "ro" : "live"}_${randomBytes(9).toString("hex")}`;
  const { rows } = await getPool().query(
    `INSERT INTO scoped_keys (id, database_id, owner_email, label, api_key, scope) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, databaseId, email, label.trim() || "Unlabeled agent", apiKey, scope]
  );
  await pushActivity(email, "you", "scoped_key.created", `${label} (${scope}) on ${db.name}`);
  return rowToScopedKey(rows[0]);
}

export async function revokeScopedKey(email: string, databaseId: string, keyId: string): Promise<void> {
  await ensureSchema();
  const db = await getDatabase(email, databaseId);
  if (!db) throw new Error("not_found");
  const { rows } = await getPool().query(
    `UPDATE scoped_keys SET revoked_at = now() WHERE id = $1 AND database_id = $2 AND revoked_at IS NULL RETURNING label`,
    [keyId, databaseId]
  );
  if (rows[0]) await pushActivity(email, "you", "scoped_key.revoked", `${rows[0].label} on ${db.name}`);
}

// Resolves a Bearer token against the scoped_keys table (checked when it
// doesn't match a database's primary api_key -- see lib/auth.ts). Updates
// last_used_at best-effort so "unused since" is real, not decorative.
export async function resolveScopedKey(
  apiKey: string
): Promise<{ email: string; databaseId: string; scope: ScopedKeyScope; label: string } | null> {
  await ensureSchema();
  const { rows } = await getPool().query(
    `UPDATE scoped_keys SET last_used_at = now() WHERE api_key = $1 AND revoked_at IS NULL RETURNING owner_email, database_id, scope, label`,
    [apiKey]
  );
  if (!rows[0]) return null;
  return { email: rows[0].owner_email, databaseId: rows[0].database_id, scope: rows[0].scope, label: rows[0].label };
}

export async function adminSummary() {
  await ensureSchema();
  const pool = getPool();
  const [{ rows: userRows }, { rows: dbRows }, { rows: nodeRows }, { rows: jobRows }] = await Promise.all([
    pool.query(`SELECT email FROM users ORDER BY first_seen_at`),
    pool.query(`SELECT * FROM databases`),
    pool.query(`SELECT * FROM nodes ORDER BY id`),
    pool.query(`SELECT count(*)::int AS count FROM jobs WHERE status IN ('pending','running')`),
  ]);

  const databasesByUser = new Map<string, ManagedDatabase[]>();
  for (const row of dbRows) {
    const db = rowToDatabase(row);
    const list = databasesByUser.get(row.owner_email) ?? [];
    list.push(db);
    databasesByUser.set(row.owner_email, list);
  }

  const workspaces = userRows.map((u: any) => ({
    email: u.email as string,
    databases: databasesByUser.get(u.email) ?? [],
  }));

  return {
    workspaceCount: workspaces.length,
    totalDatabases: dbRows.length,
    nodes: nodeRows.map(rowToNode),
    workspaces,
    pendingJobs: jobRows[0]?.count ?? 0,
  };
}
