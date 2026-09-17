# Protect an API using Stashi Auth

Resource servers can protect their API routes by validating Stashi Auth access tokens without holding private signing keys.

## Architecture

Stashi tokens are cryptographically signed using asymmetric key pairs (`EdDSA` / `ES256`). Public keys are exposed at:

```text
https://mystashi.online/.well-known/jwks.json
```

## Validation Checklist

A secure protected resource MUST verify:
1. **Signature**: Cryptographically verify against Stashi Auth's JWKS.
2. **Issuer (`iss`)**: Must equal `https://mystashi.online`.
3. **Audience / Resource (`aud` or `resource`)**: Must match your resource URI.
4. **Expiration (`exp`)**: Reject tokens where `exp < current_time`.
5. **Required Scopes (`scope`)**: Check that the token grants the specific capability needed for the endpoint.

---

## TypeScript / Node.js Middleware Example

Using the standard `jose` library:

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = "https://mystashi.online";
const JWKS_URL = new URL("https://mystashi.online/.well-known/jwks.json");
const EXPECTED_RESOURCE = "https://api.my-service.com";

// Cached JWKS set with rotation support
const JWKS = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 3600000,   // 1 hour cache
  cooldownDuration: 30000 // 30s rate limit on re-fetching on unknown kid
});

export async function authenticateRequest(request: Request, requiredScope?: string) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }

  const token = authHeader.slice(7).trim();

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
    });

    // Validate resource/audience
    const aud = payload.aud;
    const resources = (payload as any).resource || (payload as any).resources;
    const matchesResource =
      (typeof aud === "string" && aud === EXPECTED_RESOURCE) ||
      (Array.isArray(aud) && aud.includes(EXPECTED_RESOURCE)) ||
      (typeof resources === "string" && resources === EXPECTED_RESOURCE) ||
      (Array.isArray(resources) && resources.includes(EXPECTED_RESOURCE));

    if (!matchesResource) {
      return { ok: false, status: 403, error: "Token not intended for this resource" };
    }

    // Validate scope
    if (requiredScope) {
      const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
      if (!scopes.includes(requiredScope)) {
        return {
          ok: false,
          status: 403,
          error: `Insufficient scope: requires '${requiredScope}'`,
        };
      }
    }

    return { ok: true, principal: payload };
  } catch (err: any) {
    return { ok: false, status: 401, error: `Invalid token: ${err.message}` };
  }
}
```
