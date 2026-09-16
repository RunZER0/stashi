import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS, type StashiRole, type StashiPermission } from "@/lib/auth/permissions";
import { authorize } from "@/lib/auth/authorize";

describe("Permissions and Role-Based Access Control", () => {
  it("grants owners all administrative and database permissions", () => {
    const allPerms: StashiPermission[] = [
      "project.read",
      "project.update",
      "database.read",
      "database.write",
      "database.admin",
      "api_key.create",
      "api_key.read",
      "api_key.revoke",
      "oauth_client.create",
      "oauth_client.read",
      "oauth_client.update",
      "oauth_client.delete",
      "member.read",
      "member.invite",
      "member.update",
      "member.remove",
    ];

    for (const perm of allPerms) {
      expect(hasPermission("owner", perm)).toBe(true);
    }
  });

  it("restricts members from administrative actions", () => {
    expect(hasPermission("member", "database.read")).toBe(true);
    expect(hasPermission("member", "database.write")).toBe(true);
    expect(hasPermission("member", "api_key.read")).toBe(true);

    // Administrative actions denied
    expect(hasPermission("member", "database.admin")).toBe(false);
    expect(hasPermission("member", "project.update")).toBe(false);
    expect(hasPermission("member", "member.remove")).toBe(false);
    expect(hasPermission("member", "oauth_client.create")).toBe(false);
  });

  it("restricts viewers to read-only capabilities", () => {
    expect(hasPermission("viewer", "database.read")).toBe(true);
    expect(hasPermission("viewer", "project.read")).toBe(true);

    // Write & admin actions denied
    expect(hasPermission("viewer", "database.write")).toBe(false);
    expect(hasPermission("viewer", "database.admin")).toBe(false);
    expect(hasPermission("viewer", "api_key.create")).toBe(false);
  });
});

describe("Cross-Project Tenant Boundary Enforcement", () => {
  it("rejects principals when project or database does not exist", async () => {
    const res = await authorize({
      principal: { type: "session", email: "unauthorized@example.com" },
      projectId: "nonexistent_project_id",
      permission: "database.read",
    });

    expect(res.authorized).toBe(false);
  });

  it("blocks readonly API keys from performing database write operations", async () => {
    // When an API key with readonly scope attempts a database.write
    const apiKeyPrincipal = {
      type: "apiKey" as const,
      email: "agent@example.com",
      keyId: "ack_test_readonly",
      scope: "readonly" as const,
    };

    // Attempting a mutating action
    const writeAttempt = await authorize({
      principal: apiKeyPrincipal,
      projectId: "proj_sample",
      permission: "database.write",
    });

    // Must be rejected
    expect(writeAttempt.authorized).toBe(false);
    expect(writeAttempt.reason).toContain("read-only");
  });

  it("blocks database-scoped API keys from touching a different database", async () => {
    const scopedKeyPrincipal = {
      type: "apiKey" as const,
      email: "agent@example.com",
      keyId: "scp_test_1",
      scope: "full" as const,
      databaseId: "database_alpha",
    };

    // Attempting to act on database_beta with key scoped to database_alpha
    const crossDbAttempt = await authorize({
      principal: scopedKeyPrincipal,
      databaseId: "database_beta",
      permission: "database.read",
    });

    expect(crossDbAttempt.authorized).toBe(false);
    expect(crossDbAttempt.reason).toContain("different database");
  });
});
