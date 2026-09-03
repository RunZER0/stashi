export type PlanId = "dev" | "starter" | "production" | "dedicated";

export type Plan = {
  id: PlanId;
  name: string;
  price: number | null;
  tagline: string;
  storageGb: number;
  connections: number;
  backupRetentionDays: number;
  isolation: string;
  recommended?: boolean;
};

export const plans: Plan[] = [
  {
    id: "dev",
    name: "Dev",
    price: 1,
    tagline: "Personal projects, test environments and prototypes.",
    storageGb: 1,
    connections: 10,
    backupRetentionDays: 1,
    isolation: "Shared pool, schema-isolated",
  },
  {
    id: "starter",
    name: "Starter",
    price: 3,
    tagline: "Small applications with light production traffic.",
    storageGb: 5,
    connections: 30,
    backupRetentionDays: 3,
    isolation: "Own database, shared node",
    recommended: true,
  },
  {
    id: "production",
    name: "Production",
    price: 5,
    tagline: "Higher limits for active production applications.",
    storageGb: 15,
    connections: 75,
    backupRetentionDays: 7,
    isolation: "Own database, priority node",
  },
  {
    id: "dedicated",
    name: "Dedicated",
    price: null,
    tagline: "Reserved node capacity with fixed resources.",
    storageGb: 40,
    connections: 200,
    backupRetentionDays: 14,
    isolation: "Dedicated PostgreSQL node",
  },
];

export const getPlan = (id: PlanId) => plans.find((plan) => plan.id === id) ?? plans[1];
