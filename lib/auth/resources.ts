export interface ProtectedResourceConfig {
  identifier: string;
  name: string;
  description: string;
  scopes: string[];
  scopeDescriptions: Record<string, string>;
  accessTokenTtlSeconds?: number;
}

export const PROTECTED_RESOURCES: Record<string, ProtectedResourceConfig> = {
  emerald: {
    identifier: "https://emerald.ynai.co.ke/mcp",
    name: "Emerald MCP Server",
    description: "Emerald legal materials, case documents, and legal search tools.",
    scopes: ["emerald:search", "emerald:read"],
    scopeDescriptions: {
      "emerald:search": "Search across indexed Emerald legal documents and judgments",
      "emerald:read": "Read full text and metadata of Emerald legal resources",
    },
    accessTokenTtlSeconds: 900, // 15 minutes
  },
  stashiApi: {
    identifier: "https://api.mystashi.online",
    name: "Stashi Public & Database API",
    description: "Management and query access for Stashi databases and projects.",
    scopes: [
      "stashi:projects:read",
      "stashi:database:read",
      "stashi:database:write",
      "stashi:database:admin",
      "stashi:api-keys:manage",
    ],
    scopeDescriptions: {
      "stashi:projects:read": "View your Stashi projects and workspaces",
      "stashi:database:read": "Execute read-only queries against your Stashi databases",
      "stashi:database:write": "Execute read and write queries against your Stashi databases",
      "stashi:database:admin": "Manage database provisioning, plans, and branch lifecycle",
      "stashi:api-keys:manage": "Create, list, and revoke database and account API keys",
    },
    accessTokenTtlSeconds: 900,
  },
};

export const STANDARD_OIDC_SCOPES: Record<string, string> = {
  openid: "Verify your identity using OpenID Connect",
  profile: "Read basic profile information (name, avatar)",
  email: "Read your verified email address",
  offline_access: "Retain access and refresh tokens offline without re-prompting",
};

export function getAllConfiguredResources(): ProtectedResourceConfig[] {
  return Object.values(PROTECTED_RESOURCES);
}

export function getAllResourceIdentifiers(): string[] {
  return Object.values(PROTECTED_RESOURCES).map((r) => r.identifier);
}

export function getAllSupportedScopes(): string[] {
  const scopes = new Set<string>(Object.keys(STANDARD_OIDC_SCOPES));
  for (const resource of Object.values(PROTECTED_RESOURCES)) {
    for (const scope of resource.scopes) {
      scopes.add(scope);
    }
  }
  return Array.from(scopes);
}

export function getHumanReadableScopeDescription(scope: string): string {
  if (STANDARD_OIDC_SCOPES[scope]) {
    return STANDARD_OIDC_SCOPES[scope];
  }
  for (const resource of Object.values(PROTECTED_RESOURCES)) {
    if (resource.scopeDescriptions[scope]) {
      return resource.scopeDescriptions[scope];
    }
  }
  return `Access permission: ${scope}`;
}
