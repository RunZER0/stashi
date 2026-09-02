import type { PlanId } from "./plans";

export type DatabaseStatus = "healthy" | "provisioning" | "suspended" | "failed";

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
