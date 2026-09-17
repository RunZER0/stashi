import { ensureSchema, getPool } from "../db";
import { hasPermission, type StashiPermission, type StashiRole } from "./permissions";

export type Principal =
  | { type: "session"; email: string; userId?: string }
  | { type: "oauth"; userId: string; email?: string; scopes: string[]; clientId: string; resource?: string }
  | { type: "apiKey"; email: string; keyId: string; scope: "full" | "readonly"; projectId?: string; databaseId?: string }
  | { type: "agent"; agentId: string };

export interface AuthorizeInput {
  principal: Principal;
  permission: StashiPermission;
  projectId?: string;
  databaseId?: string;
  ownerEmail?: string;
}

export interface AuthorizeResult {
  authorized: boolean;
  reason?: string;
  role?: StashiRole;
  projectId?: string;
  userEmail?: string;
}

/**
 * Resolves the target project ID from input options.
 */
async function resolveTargetProjectId(input: AuthorizeInput): Promise<{ projectId: string; ownerEmail?: string } | null> {
  if (!process.env.CONTROL_PLANE_DATABASE_URL) {
    return null;
  }

  try {
    await ensureSchema();
    const pool = getPool();

    if (input.projectId) {
      const { rows } = await pool.query(`SELECT id FROM projects WHERE id = $1`, [input.projectId]);
      if (rows[0]) return { projectId: rows[0].id };
    }

    if (input.databaseId) {
      const { rows } = await pool.query(`SELECT project_id, owner_email FROM databases WHERE id = $1`, [input.databaseId]);
      if (rows[0]) {
        if (rows[0].project_id) return { projectId: rows[0].project_id, ownerEmail: rows[0].owner_email };
        // Fallback to default project for owner_email
        const pRows = await pool.query(
          `SELECT project_id FROM project_members WHERE user_email = $1 LIMIT 1`,
          [rows[0].owner_email]
        );
        if (pRows.rows[0]) return { projectId: pRows.rows[0].project_id, ownerEmail: rows[0].owner_email };
      }
    }

    if (input.ownerEmail) {
      const { rows } = await pool.query(
        `SELECT project_id FROM project_members WHERE user_email = $1 LIMIT 1`,
        [input.ownerEmail]
      );
      if (rows[0]) return { projectId: rows[0].project_id, ownerEmail: input.ownerEmail };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Centralized authorization engine.
 * Derives permission from project membership server-side.
 */
export async function authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
  const { principal, permission } = input;

  // Fast-path boundary checks for API Keys
  if (principal.type === "apiKey") {
    // Database-scoped key boundary check
    if (principal.databaseId && input.databaseId && principal.databaseId !== input.databaseId) {
      return { authorized: false, reason: "API key is scoped to a different database" };
    }

    // Readonly scope boundary
    if (principal.scope === "readonly") {
      const isReadOnlyPerm = permission === "database.read" || permission === "project.read" || permission === "api_key.read";
      if (!isReadOnlyPerm) {
        return { authorized: false, reason: "read-only API key cannot perform mutating actions" };
      }
    }
  }

  // Fast-path boundary checks for OAuth scopes
  if (principal.type === "oauth") {
    const scopeAllowed = isScopePermittedForPermission(principal.scopes, permission);
    if (!scopeAllowed) {
      return {
        authorized: false,
        reason: `OAuth access token scopes [${principal.scopes.join(" ")}] do not grant '${permission}'`,
      };
    }
  }

  const target = await resolveTargetProjectId(input);
  if (!target) {
    return { authorized: false, reason: "Target project or database not found" };
  }

  const { projectId } = target;
  await ensureSchema();
  const pool = getPool();

  // 1. Session User Principal
  if (principal.type === "session") {
    const { email } = principal;
    const { rows } = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_email = $2`,
      [projectId, email]
    );
    if (!rows[0]) {
      return { authorized: false, reason: "User is not a member of this project", projectId, userEmail: email };
    }
    const role = rows[0].role as StashiRole;
    const allowed = hasPermission(role, permission);
    return {
      authorized: allowed,
      reason: allowed ? undefined : `Role '${role}' does not have permission '${permission}'`,
      role,
      projectId,
      userEmail: email,
    };
  }

  // 2. OAuth Delegated Principal
  if (principal.type === "oauth") {
    // Check if OAuth scopes permit this operation
    const scopeAllowed = isScopePermittedForPermission(principal.scopes, permission);
    if (!scopeAllowed) {
      return {
        authorized: false,
        reason: `OAuth access token scopes [${principal.scopes.join(" ")}] do not grant '${permission}'`,
        projectId,
      };
    }

    // Resolve user email if not in principal
    let email = principal.email;
    if (!email && principal.userId) {
      const uRes = await pool.query(`SELECT email FROM "user" WHERE id = $1`, [principal.userId]);
      if (uRes.rows[0]) email = uRes.rows[0].email;
    }

    if (!email) {
      return { authorized: false, reason: "Unable to resolve identity for OAuth principal", projectId };
    }

    // Check membership in project
    const { rows } = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_email = $2`,
      [projectId, email]
    );
    if (!rows[0]) {
      return { authorized: false, reason: "OAuth user is not a member of this project", projectId, userEmail: email };
    }

    const role = rows[0].role as StashiRole;
    const allowed = hasPermission(role, permission);
    return {
      authorized: allowed,
      reason: allowed ? undefined : `Role '${role}' does not have permission '${permission}'`,
      role,
      projectId,
      userEmail: email,
    };
  }

  // 3. API Key Principal
  if (principal.type === "apiKey") {
    // Database-scoped key boundary check
    if (principal.databaseId && input.databaseId && principal.databaseId !== input.databaseId) {
      return { authorized: false, reason: "API key is scoped to a different database", projectId };
    }

    // Readonly scope boundary
    if (principal.scope === "readonly") {
      const isReadOnlyPerm = permission === "database.read" || permission === "project.read" || permission === "api_key.read";
      if (!isReadOnlyPerm) {
        return { authorized: false, reason: "Read-only API key cannot perform mutating actions", projectId };
      }
    }

    // Check key owner's membership
    const { rows } = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_email = $2`,
      [projectId, principal.email]
    );
    if (!rows[0]) {
      return { authorized: false, reason: "API key owner is not a member of this project", projectId };
    }
    const role = rows[0].role as StashiRole;
    const allowed = hasPermission(role, permission);
    return {
      authorized: allowed,
      reason: allowed ? undefined : `Key owner role '${role}' does not have permission '${permission}'`,
      role,
      projectId,
      userEmail: principal.email,
    };
  }

  // 4. Agent Principal
  if (principal.type === "agent") {
    return { authorized: true, role: "admin", projectId };
  }

  return { authorized: false, reason: "Unsupported principal type" };
}

function isScopePermittedForPermission(scopes: string[], permission: StashiPermission): boolean {
  if (scopes.includes("stashi:database:admin")) return true;
  if (permission.startsWith("database.write") && (scopes.includes("stashi:database:write") || scopes.includes("stashi:database:admin"))) return true;
  if (permission.startsWith("database.read") && (scopes.includes("stashi:database:read") || scopes.includes("stashi:database:write") || scopes.includes("stashi:database:admin"))) return true;
  if (permission.startsWith("project.") && scopes.includes("stashi:projects:read")) return true;
  if (permission.startsWith("api_key.") && scopes.includes("stashi:api-keys:manage")) return true;
  return false;
}
