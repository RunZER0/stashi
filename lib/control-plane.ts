import type { PlanId } from "./plans";

export type DatabaseStatus = "healthy" | "provisioning" | "suspended";

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
  createdAt: string;
  storageUsedMb: number;
  connections: number;
  p95LatencyMs: number;
};

export type Node = {
  id: string;
  label: string;
  region: string;
  cpuPct: number;
  memoryPct: number;
  diskPct: number;
  databaseCount: number;
  capacityStatus: "open" | "watch" | "closed";
};

export const demoDatabases: ManagedDatabase[] = [
  {
    id: "db_01JSTASHI9K",
    name: "payments-api",
    plan: "starter",
    region: "us-east",
    status: "healthy",
    version: "17",
    host: "db.ynai.co.ke",
    port: 6432,
    database: "payments_api",
    username: "payments_owner",
    password: "st_demo_L7p8x4Y2q9",
    createdAt: "2026-09-02T10:18:00.000Z",
    storageUsedMb: 842,
    connections: 7,
    p95LatencyMs: 38,
  },
  {
    id: "db_01JSTASHIB2P",
    name: "student-portal",
    plan: "dev",
    region: "us-east",
    status: "healthy",
    version: "17",
    host: "db.ynai.co.ke",
    port: 6432,
    database: "student_portal",
    username: "student_owner",
    password: "st_demo_Q5m1n8K4v3",
    createdAt: "2026-09-01T07:42:00.000Z",
    storageUsedMb: 126,
    connections: 2,
    p95LatencyMs: 24,
  },
];

export const demoNodes: Node[] = [
  {
    id: "node-nj-01",
    label: "NJ · 01",
    region: "New Jersey, US",
    cpuPct: 34,
    memoryPct: 61,
    diskPct: 23,
    databaseCount: 18,
    capacityStatus: "open",
  },
  {
    id: "node-nj-02",
    label: "NJ · 02",
    region: "New Jersey, US",
    cpuPct: 57,
    memoryPct: 73,
    diskPct: 49,
    databaseCount: 27,
    capacityStatus: "watch",
  },
];

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
