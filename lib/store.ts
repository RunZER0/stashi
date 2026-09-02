import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { ActivityEntry, AgentJob, AgentJobStatus, ManagedDatabase, Node } from "./control-plane";
import type { PlanId } from "./plans";

// Lightweight file-backed persistence for the control plane. There is no real
// control-plane database yet (see the productionize-node handover issue), so
// this is the honest replacement for the in-memory demo arrays and the
// in-memory job queue: real create/read/update/delete that survives a page
// refresh and a server restart, without inventing telemetry that isn't
// actually being collected, and without pretending a database is "healthy"
// before the node agent has actually created it.

type StoreShape = {
  users: Record<string, { email: string; firstSeenAt: string }>;
  databasesByUser: Record<string, ManagedDatabase[]>;
  activityByUser: Record<string, ActivityEntry[]>;
  nodes: Node[];
  jobs: AgentJob[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function defaultStore(): StoreShape {
  return {
    users: {},
    databasesByUser: {},
    activityByUser: {},
    nodes: [
      {
        id: "node-nj-01",
        label: "NJ · 01",
        region: "New Jersey, US",
        cpuPct: null,
        memoryPct: null,
        diskPct: null,
        databaseCount: 0,
        capacityStatus: "pending",
        lastHeartbeat: null,
      },
    ],
    jobs: [],
  };
}

function readStore(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { ...defaultStore(), ...parsed };
  } catch {
    return defaultStore();
  }
}

function writeStore(store: StoreShape) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function pushActivity(store: StoreShape, email: string, actor: string, action: string, target: string) {
  const entry: ActivityEntry = {
    id: `ev_${Date.now().toString(36)}${randomBytes(2).toString("hex")}`,
    actor,
    action,
    target,
    createdAt: new Date().toISOString(),
  };
  const list = store.activityByUser[email] ?? [];
  store.activityByUser[email] = [entry, ...list].slice(0, 100);
}

export function recordUserSeen(email: string) {
  const store = readStore();
  if (!store.users[email]) {
    store.users[email] = { email, firstSeenAt: new Date().toISOString() };
    writeStore(store);
  }
}

export function listDatabases(email: string): ManagedDatabase[] {
  return readStore().databasesByUser[email] ?? [];
}

export function getDatabase(email: string, id: string): ManagedDatabase | null {
  return listDatabases(email).find((db) => db.id === id) ?? null;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) || "database";

const DEFAULT_NODE_ID = "node-nj-01";

// Creates the database record in "provisioning" state and enqueues the real
// job for the node agent to execute. The record only flips to "healthy" once
// completeJob() processes a successful create_database result — see
// app/api/agent/jobs/complete/route.ts.
export function createDatabase(
  email: string,
  input: { name: string; plan: PlanId; region: string }
): { database: ManagedDatabase; job: AgentJob } {
  const store = readStore();
  const safeName = slugify(input.name);
  const suffix = randomBytes(3).toString("hex");
  const roleName = `st_${safeName}_${suffix}`;
  const dbName = `st_${safeName}_${suffix}`;
  const password = `st_${randomBytes(12).toString("base64url")}`;

  const record: ManagedDatabase = {
    id: `db_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`.toUpperCase(),
    name: input.name.trim() || "database",
    plan: input.plan,
    region: input.region || "us-east",
    status: "provisioning",
    version: "17",
    host: process.env.NEXT_PUBLIC_DB_HOST || "db.stashi.dev",
    port: Number(process.env.NEXT_PUBLIC_DB_PORT || 6432),
    database: dbName,
    username: roleName,
    password,
    apiKey: `st_live_${randomBytes(9).toString("hex")}`,
    createdAt: new Date().toISOString(),
    storageUsedMb: 0,
    connections: 0,
    p95LatencyMs: null,
  };

  const job: AgentJob = {
    id: `job_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    nodeId: DEFAULT_NODE_ID,
    type: "create_database",
    payload: { database_name: dbName, role_name: roleName, password, connection_limit: 10 },
    status: "pending",
    ownerEmail: email,
    databaseId: record.id,
    createdAt: new Date().toISOString(),
  };

  store.databasesByUser[email] = [record, ...(store.databasesByUser[email] ?? [])];
  store.jobs.push(job);
  pushActivity(store, email, "you", "database.provisioning.queued", record.name);
  writeStore(store);
  return { database: record, job };
}

export function updateDatabase(
  email: string,
  id: string,
  patch: Partial<ManagedDatabase>
): ManagedDatabase | null {
  const store = readStore();
  const list = store.databasesByUser[email] ?? [];
  const index = list.findIndex((db) => db.id === id);
  if (index === -1) return null;
  const updated = { ...list[index], ...patch };
  list[index] = updated;
  store.databasesByUser[email] = list;
  writeStore(store);
  return updated;
}

export function deleteDatabase(email: string, id: string): ManagedDatabase | null {
  const store = readStore();
  const list = store.databasesByUser[email] ?? [];
  const target = list.find((db) => db.id === id);
  if (!target) return null;
  store.databasesByUser[email] = list.filter((db) => db.id !== id);

  const job: AgentJob = {
    id: `job_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    nodeId: DEFAULT_NODE_ID,
    type: "delete_database",
    payload: { database_name: target.database, role_name: target.username },
    status: "pending",
    ownerEmail: email,
    databaseId: target.id,
    createdAt: new Date().toISOString(),
  };
  store.jobs.push(job);
  pushActivity(store, email, "you", "database.deleted", target.name);
  writeStore(store);
  return target;
}

export function listActivity(email: string): ActivityEntry[] {
  return readStore().activityByUser[email] ?? [];
}

export function recordActivity(email: string, actor: string, action: string, target: string) {
  const store = readStore();
  pushActivity(store, email, actor, action, target);
  writeStore(store);
}

export function listNodes(): Node[] {
  return readStore().nodes;
}

export function recordNodeTelemetry(nodeId: string, patch: Partial<Node>) {
  const store = readStore();
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  Object.assign(node, patch, { lastHeartbeat: new Date().toISOString() });
  writeStore(store);
  return node;
}

// --- Agent job queue -------------------------------------------------------

export function enqueueJob(
  nodeId: string,
  type: string,
  payload: Record<string, unknown>,
  ownerEmail: string,
  databaseId: string
): AgentJob {
  const store = readStore();
  const job: AgentJob = {
    id: `job_${Date.now().toString(36)}${randomBytes(3).toString("hex")}`,
    nodeId,
    type,
    payload,
    status: "pending",
    ownerEmail,
    databaseId,
    createdAt: new Date().toISOString(),
  };
  store.jobs.push(job);
  writeStore(store);
  return job;
}

// Claims the oldest pending job for a node (or unassigned) and marks it running.
export function claimNextJob(nodeId: string): AgentJob | null {
  const store = readStore();
  const job = store.jobs.find((j) => j.status === "pending" && (!j.nodeId || j.nodeId === nodeId));
  if (!job) return null;
  job.status = "running";
  writeStore(store);
  return job;
}

export function completeJob(
  jobId: string,
  status: AgentJobStatus,
  result?: Record<string, unknown>,
  error?: string
): AgentJob | null {
  const store = readStore();
  const job = store.jobs.find((j) => j.id === jobId);
  if (!job) return null;
  job.status = status;
  if (result) job.result = result;
  if (error) job.error = error;

  // Reflect the real outcome onto the owning database record.
  const list = store.databasesByUser[job.ownerEmail] ?? [];
  const db = list.find((d) => d.id === job.databaseId);
  if (db) {
    if (job.type === "create_database") {
      db.status = status === "completed" ? "healthy" : "failed";
    }
    pushActivity(
      store,
      job.ownerEmail,
      "node-agent",
      status === "completed" ? `${job.type}.completed` : `${job.type}.failed`,
      db.name
    );
  }
  store.databasesByUser[job.ownerEmail] = list;

  writeStore(store);
  return job;
}

export function adminSummary() {
  const store = readStore();
  const workspaces = Object.keys(store.users).map((email) => {
    const databases = store.databasesByUser[email] ?? [];
    return { email, databases };
  });
  const totalDatabases = workspaces.reduce((sum, w) => sum + w.databases.length, 0);
  const pendingJobs = store.jobs.filter((j) => j.status === "pending" || j.status === "running").length;
  return {
    workspaceCount: workspaces.length,
    totalDatabases,
    nodes: store.nodes,
    workspaces,
    pendingJobs,
  };
}
