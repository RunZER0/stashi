import { randomBytes } from "node:crypto";
import { ensureSchema, getPool } from "./db";
import type { ActivityEntry, AgentJob, AgentJobStatus, ManagedDatabase, Node } from "./control-plane";
import type { PlanId } from "./plans";

// Real Postgres-backed control plane. See lib/db.ts for why: this used to be
// a JSON file on local disk, which only worked as a stopgap — it doesn't
// survive a redeploy on a host without a persistent disk, and disks cost
// extra. There's already a real, paid-for Postgres server (the same VPS that
// runs customer databases) sitting idle for this purpose.

const DEFAULT_NODE_ID = "node-nj-01";

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
// completeJob() processes a successful create_database result — see
// app/api/agent/jobs/complete/route.ts.
export async function createDatabase(
  email: string,
  input: { name: string; plan: PlanId; region: string }
): Promise<{ database: ManagedDatabase; job: AgentJob }> {
  await ensureSchema();
  const pool = getPool();
  await pool.query(`INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`, [email]);

  const safeName = slugify(input.name);
  const suffix = randomBytes(3).toString("hex");
  const roleName = `st_${safeName}_${suffix}`;
  const dbName = `st_${safeName}_${suffix}`;
  const password = `st_${randomBytes(12).toString("base64url")}`;
  const id = newId("db").toUpperCase();
  const apiKey = `st_live_${randomBytes(9).toString("hex")}`;
  const host = process.env.NEXT_PUBLIC_DB_HOST || "db.stashi.dev";
  const port = Number(process.env.NEXT_PUBLIC_DB_PORT || 6432);
  const name = input.name.trim() || "database";

  await pool.query(
    `INSERT INTO databases (id, owner_email, name, plan, region, status, version, host, port, database_name, username, password, api_key)
     VALUES ($1,$2,$3,$4,$5,'provisioning','17',$6,$7,$8,$9,$10,$11)`,
    [id, email, name, input.plan, input.region || "us-east", host, port, dbName, roleName, password, apiKey]
  );

  const jobId = newId("job");
  const payload = { database_name: dbName, role_name: roleName, password, connection_limit: 10 };
  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,'create_database',$3,'pending',$4,$5)`,
    [jobId, DEFAULT_NODE_ID, JSON.stringify(payload), email, id]
  );

  await pushActivity(email, "you", "database.provisioning.queued", name);

  const database = (await getDatabase(email, id))!;
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
  return { database, job: rowToJob(rows[0]) };
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

  await pool.query(
    `INSERT INTO jobs (id, node_id, type, payload, status, owner_email, database_id)
     VALUES ($1,$2,'delete_database',$3,'pending',$4,$5)`,
    [newId("job"), DEFAULT_NODE_ID, JSON.stringify({ database_name: target.database, role_name: target.username }), email, id]
  );
  await pushActivity(email, "you", "database.deleted", target.name);
  return target;
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

  if (job.type === "create_database") {
    await pool.query(`UPDATE databases SET status = $3 WHERE owner_email = $1 AND id = $2`, [
      job.ownerEmail,
      job.databaseId,
      status === "completed" ? "healthy" : "failed",
    ]);
  }

  const { rows: dbRows } = await pool.query(`SELECT name FROM databases WHERE owner_email = $1 AND id = $2`, [
    job.ownerEmail,
    job.databaseId,
  ]);
  const targetName = dbRows[0]?.name;
  if (targetName) {
    await pushActivity(
      job.ownerEmail,
      "node-agent",
      status === "completed" ? `${job.type}.completed` : `${job.type}.failed`,
      targetName
    );
  }

  return job;
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
