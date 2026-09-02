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
    tagline: "For prototypes and coursework.",
    storageGb: 1,
    connections: 10,
    backupRetentionDays: 1,
    isolation: "Shared node",
  },
  {
    id: "starter",
    name: "Starter",
    price: 3,
    tagline: "For small apps with real users.",
    storageGb: 5,
    connections: 30,
    backupRetentionDays: 3,
    isolation: "Shared node",
    recommended: true,
  },
  {
    id: "production",
    name: "Production",
    price: 5,
    tagline: "For important production workloads.",
    storageGb: 15,
    connections: 75,
    backupRetentionDays: 7,
    isolation: "Priority shared node",
  },
  {
    id: "dedicated",
    name: "Dedicated",
    price: null,
    tagline: "Fixed resources and private capacity.",
    storageGb: 40,
    connections: 200,
    backupRetentionDays: 14,
    isolation: "Dedicated PostgreSQL node",
  },
];

export const getPlan = (id: PlanId) => plans.find((plan) => plan.id === id) ?? plans[1];
