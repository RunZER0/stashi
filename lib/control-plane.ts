import type { PlanId } from "./plans";

export type DatabaseStatus = "healthy" | "provisioning" | "suspended" | "failed" | "resizing";

// "isolated": its own database + role, full separation (Starter and up).
// "pooled": a schema inside a shared database (stashi_pool), separated from
// other tenants by Postgres's own permission model rather than a dedicated
// instance -- how the Dev tier gets to $1/mo without losing real isolation.
export type TenancyMode = "isolated" | "pooled";

export type ManagedDatabase = {
  id: string;
  name: string;
  plan: PlanId;
  region: string;
  status: DatabaseStatus;
  version: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  apiKey: string;
  createdAt: string;
  storageUsedMb: number;
  connections: number;
  p95LatencyMs: number | null;
  tenancyMode: TenancyMode;
  poolSchema: string | null;
};

export type CheckpointKind = "checkpoint" | "backup";
export type CheckpointStatus = "pending" | "ready" | "failed" | "restoring";

export type Checkpoint = {
  id: string;
  databaseId: string;
  kind: CheckpointKind;
  label: string;
  status: CheckpointStatus;
  sizeBytes: number | null;
  createdAt: string;
  error?: string;
};

export type ActivityEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
};

export type NodeCapacityStatus = "open" | "watch" | "closed" | "pending";

export type AgentJobStatus = "pending" | "running" | "completed" | "failed";

export type AgentJob = {
  id: string;
  nodeId: string;
  type: string;
  payload: Record<string, unknown>;
  status: AgentJobStatus;
  ownerEmail: string;
  databaseId: string;
  createdAt: string;
  result?: Record<string, unknown>;
  error?: string;
};

export type Node = {
  id: string;
  label: string;
  region: string;
  cpuPct: number | null;
  memoryPct: number | null;
  diskPct: number | null;
  databaseCount: number;
  capacityStatus: NodeCapacityStatus;
  lastHeartbeat: string | null;
};

export const makeConnectionString = (db: ManagedDatabase) =>
  `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}?sslmode=require`;

export const architecture = {
  provisioningSteps: [
    "Validate quota and fixed-price plan",
    "Select the healthiest eligible PostgreSQL node",
    "Create role, database and scoped privileges",
    "Register PgBouncer route and TLS endpoint",
    "Create backup policy and monitoring target",
    "Return credentials only after a health probe succeeds",
  ],
  placementRule:
    "Choose the lowest-pressure compatible node while CPU < 60%, memory < 75%, disk < 70%, and customer/database quotas remain available.",
};
