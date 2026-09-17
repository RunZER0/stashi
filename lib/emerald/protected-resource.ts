import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getPublicJwks } from "../auth/jwks";

export const EMERALD_RESOURCE_IDENTIFIER = "https://emerald.ynai.co.ke/mcp";

export interface TokenVerificationResult {
  valid: boolean;
  error?: "unauthorized" | "invalid_token" | "insufficient_scope" | "wrong_audience" | "expired_token";
  message?: string;
  payload?: JWTPayload;
  scopes?: string[];
}

let cachedRemoteJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let lastRemoteJwksUrl = "";

function getRemoteJWKS(jwksUrl: string) {
  if (!cachedRemoteJWKS || lastRemoteJwksUrl !== jwksUrl) {
    cachedRemoteJWKS = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: 3600000, // 1 hour
      cooldownDuration: 30000, // 30 seconds
    });
    lastRemoteJwksUrl = jwksUrl;
  }
  return cachedRemoteJWKS;
}

export function getEmeraldProtectedResourceMetadata(issuer: string) {
  return {
    resource: EMERALD_RESOURCE_IDENTIFIER,
    authorization_servers: [issuer],
    scopes_supported: ["openid", "profile", "email", "emerald:search", "emerald:read"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://mystashi.online/docs/auth/protect-an-mcp-server",
  };
}

export function getWwwAuthenticateHeader(options: {
  issuer: string;
  error?: "invalid_token" | "insufficient_scope";
  errorDescription?: string;
  scope?: string;
}): string {
  const parts = [
    `Bearer realm="Emerald MCP"`,
    `resource="${EMERALD_RESOURCE_IDENTIFIER}"`,
    `authorization_server="${options.issuer}"`,
  ];
  if (options.error) {
    parts.push(`error="${options.error}"`);
  }
  if (options.errorDescription) {
    parts.push(`error_description="${encodeURIComponent(options.errorDescription)}"`);
  }
  if (options.scope) {
    parts.push(`scope="${options.scope}"`);
  }
  return parts.join(", ");
}

/**
 * Validates a Bearer access token presented to Emerald.
 * Cryptographically verifies signature using Stashi Auth JWKS,
 * checks issuer, audience/resource, expiration, and required scopes.
 */
export async function verifyEmeraldToken(
  token: string,
  options: {
    issuer: string;
    requiredScope?: "emerald:search" | "emerald:read";
    jwksUrl?: string;
  }
): Promise<TokenVerificationResult> {
  if (!token || typeof token !== "string") {
    return { valid: false, error: "unauthorized", message: "Missing token" };
  }

  try {
    const jwksUrl = options.jwksUrl || `${options.issuer}/.well-known/jwks.json`;

    // Local in-process JWKS verification fallback for same-process test execution
    let payload: JWTPayload;
    try {
      const remoteJwks = getRemoteJWKS(jwksUrl);
      const res = await jwtVerify(token, remoteJwks, {
        issuer: options.issuer,
      });
      payload = res.payload;
    } catch (innerErr: unknown) {
      const errObj = innerErr as { code?: string; name?: string };
      // If the error is an actual JWT verification failure (expired, signature failure, etc.), rethrow
      if (
        errObj?.code === "ERR_JWT_EXPIRED" ||
        errObj?.name === "JWTExpired" ||
        errObj?.code?.startsWith("ERR_JWT_") ||
        errObj?.code?.startsWith("ERR_JWS_")
      ) {
        throw innerErr;
      }

      // Fallback: verify against local in-process jwks table if remote URL isn't responding (e.g. unit tests)
      const localJwks = await getPublicJwks();
      const matchingKey = localJwks.keys[0];
      if (!matchingKey) {
        return { valid: false, error: "invalid_token", message: "No signing keys available" };
      }
      const keySet = createRemoteJWKSet(new URL(`data:application/json,${JSON.stringify(localJwks)}`));
      const res = await jwtVerify(token, keySet, {
        issuer: options.issuer,
      });
      payload = res.payload;
    }

    // 1. Audience / Resource Validation
    const aud = payload.aud;
    const resources = (payload as Record<string, unknown>).resource || (payload as Record<string, unknown>).resources;
    const hasCorrectAudience =
      (typeof aud === "string" && aud === EMERALD_RESOURCE_IDENTIFIER) ||
      (Array.isArray(aud) && aud.includes(EMERALD_RESOURCE_IDENTIFIER)) ||
      (typeof resources === "string" && resources === EMERALD_RESOURCE_IDENTIFIER) ||
      (Array.isArray(resources) && resources.includes(EMERALD_RESOURCE_IDENTIFIER));

    if (!hasCorrectAudience) {
      return {
        valid: false,
        error: "wrong_audience",
        message: `Token audience/resource does not match '${EMERALD_RESOURCE_IDENTIFIER}'`,
        payload,
      };
    }

    // 2. Expiration check
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "expired_token", message: "Token has expired", payload };
    }

    // 3. Scopes validation
    const rawScope = (payload.scope as string) || ((payload as Record<string, unknown>).scopes as string) || "";
    const tokenScopes = Array.isArray(rawScope)
      ? rawScope
      : typeof rawScope === "string"
        ? rawScope.split(" ").filter(Boolean)
        : [];

    if (options.requiredScope && !tokenScopes.includes(options.requiredScope)) {
      return {
        valid: false,
        error: "insufficient_scope",
        message: `Token missing required scope '${options.requiredScope}'`,
        payload,
        scopes: tokenScopes,
      };
    }

    return {
      valid: true,
      payload,
      scopes: tokenScopes,
    };
  } catch (err: unknown) {
    const errorObj = err as { code?: string; name?: string; message?: string };
    if (errorObj?.code === "ERR_JWT_EXPIRED" || errorObj?.name === "JWTExpired") {
      return {
        valid: false,
        error: "expired_token",
        message: "Token has expired",
      };
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: "invalid_token",
      message: `Token verification failed: ${errorMsg}`,
    };
  }
}
