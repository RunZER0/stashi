import { randomBytes } from "node:crypto";
import { ensureSchema, getPool } from "../db";

export type AuditEventName =
  | "user.created"
  | "user.login.success"
  | "user.login.failure"
  | "user.logout"
  | "user.email.verified"
  | "user.password.changed"
  | "oauth.client.created"
  | "oauth.client.updated"
  | "oauth.client.deleted"
  | "oauth.authorization.approved"
  | "oauth.authorization.denied"
  | "oauth.token.issued"
  | "oauth.refresh.used"
  | "oauth.token.revoked"
  | "oauth.consent.revoked"
  | "api_key.created"
  | "api_key.revoked"
  | "project.member.added"
  | "project.member.role_changed"
  | "project.member.removed"
  | "security.rate_limit"
  | "security.invalid_redirect_uri"
  | "security.invalid_resource"
  | "security.invalid_scope";

export interface AuditEventInput {
  event: AuditEventName;
  outcome: "success" | "failure" | "denied" | "blocked";
  userId?: string;
  userEmail?: string;
  projectId?: string;
  clientId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

// Redact any sensitive field from audit details
function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> {
  if (!details) return {};
  const sensitiveKeys = new Set([
    "password",
    "token",
    "access_token",
    "refresh_token",
    "client_secret",
    "api_key",
    "authorization",
    "cookie",
    "code",
    "secret",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (sensitiveKeys.has(k.toLowerCase())) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeDetails(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await ensureSchema();
    const pool = getPool();
    const id = `aud_${randomBytes(12).toString("hex")}`;
    const requestId = input.requestId || `req_${randomBytes(8).toString("hex")}`;
    const sanitizedDetails = sanitizeDetails(input.details);

    // Write to auth_audit_events
    await pool.query(
      `INSERT INTO auth_audit_events (id, timestamp, request_id, user_id, project_id, client_id, event, outcome, ip, user_agent, details)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        requestId,
        input.userId || input.userEmail || null,
        input.projectId || null,
        input.clientId || null,
        input.event,
        input.outcome,
        input.ip || null,
        input.userAgent ? input.userAgent.slice(0, 256) : null,
        JSON.stringify(sanitizedDetails),
      ]
    );

    // Also write to user activity if user email is known
    if (input.userEmail) {
      const actId = `act_${randomBytes(8).toString("hex")}`;
      await pool.query(
        `INSERT INTO activity (id, owner_email, actor, action, target, created_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT DO NOTHING`,
        [actId, input.userEmail, input.clientId ? `oauth:${input.clientId}` : "auth", input.event, input.outcome]
      ).catch(() => {});
    }
  } catch (err) {
    console.error("[Audit Logger] Failed to record event:", err);
  }
}
