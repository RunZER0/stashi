import { describe, it, expect } from "vitest";
import { generateKeyPair, SignJWT, exportJWK } from "jose";
import { GET as getProtectedResourceMetadata } from "@/app/api/emerald/mcp/.well-known/oauth-protected-resource/route";
import { GET as getEmeraldMcp, POST as postEmeraldMcp } from "@/app/api/emerald/mcp/route";
import { verifyEmeraldToken, EMERALD_RESOURCE_IDENTIFIER } from "@/lib/emerald/protected-resource";

describe("Emerald MCP Protected Resource Server", () => {
  it("exposes valid RFC 9728 protected resource metadata", async () => {
    const req = new Request("https://emerald.ynai.co.ke/mcp/.well-known/oauth-protected-resource");
    const res = await getProtectedResourceMetadata(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.resource).toBe("https://emerald.ynai.co.ke/mcp");
    expect(body.authorization_servers).toContain("https://mystashi.online");
    expect(body.scopes_supported).toContain("emerald:search");
    expect(body.scopes_supported).toContain("emerald:read");
  });

  it("returns 401 and WWW-Authenticate challenge when unauthenticated", async () => {
    const req = new Request("https://emerald.ynai.co.ke/mcp");
    const res = await getEmeraldMcp(req);
    expect(res.status).toBe(401);

    const authHeader = res.headers.get("www-authenticate");
    expect(authHeader).toBeTruthy();
    expect(authHeader).toContain('Bearer realm="Emerald MCP"');
    expect(authHeader).toContain(`resource="${EMERALD_RESOURCE_IDENTIFIER}"`);
  });

  it("rejects MCP POST requests without Authorization header", async () => {
    const req = new Request("https://emerald.ynai.co.ke/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    const res = await postEmeraldMcp(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("error=");
  });
});

describe("Emerald Token Cryptographic & Scope Verification", () => {
  it("verifies signature, audience, expiration, and scopes", async () => {
    const issuer = "https://mystashi.online";
    // Generate an in-memory signing keypair
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test_key_1";
    jwk.alg = "EdDSA";

    const localJwksUrl = `data:application/json,${JSON.stringify({ keys: [jwk] })}`;

    // 1. Valid token with full Emerald permissions
    const validToken = await new SignJWT({
      scope: "openid profile email emerald:search emerald:read",
      resource: EMERALD_RESOURCE_IDENTIFIER,
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test_key_1" })
      .setIssuer(issuer)
      .setAudience(EMERALD_RESOURCE_IDENTIFIER)
      .setSubject("usr_12345")
      .setExpirationTime("15m")
      .setIssuedAt()
      .sign(privateKey);

    const validCheck = await verifyEmeraldToken(validToken, {
      issuer,
      jwksUrl: localJwksUrl,
      requiredScope: "emerald:search",
    });
    expect(validCheck.valid).toBe(true);
    expect(validCheck.scopes).toContain("emerald:search");

    // 2. Token intended for another resource (e.g. Stashi API) must be rejected
    const wrongAudienceToken = await new SignJWT({
      scope: "stashi:database:read emerald:search",
      resource: "https://api.mystashi.online",
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test_key_1" })
      .setIssuer(issuer)
      .setAudience("https://api.mystashi.online")
      .setSubject("usr_12345")
      .setExpirationTime("15m")
      .sign(privateKey);

    const audienceCheck = await verifyEmeraldToken(wrongAudienceToken, {
      issuer,
      jwksUrl: localJwksUrl,
      requiredScope: "emerald:search",
    });
    expect(audienceCheck.valid).toBe(false);
    expect(audienceCheck.error).toBe("wrong_audience");

    // 3. Token missing required scope (e.g. only emerald:read, but emerald:search requested)
    const readOnlyToken = await new SignJWT({
      scope: "openid emerald:read",
      resource: EMERALD_RESOURCE_IDENTIFIER,
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test_key_1" })
      .setIssuer(issuer)
      .setAudience(EMERALD_RESOURCE_IDENTIFIER)
      .setSubject("usr_12345")
      .setExpirationTime("15m")
      .sign(privateKey);

    const scopeCheck = await verifyEmeraldToken(readOnlyToken, {
      issuer,
      jwksUrl: localJwksUrl,
      requiredScope: "emerald:search",
    });
    expect(scopeCheck.valid).toBe(false);
    expect(scopeCheck.error).toBe("insufficient_scope");

    // 4. Expired token must be rejected
    const expiredToken = await new SignJWT({
      scope: "emerald:search emerald:read",
      resource: EMERALD_RESOURCE_IDENTIFIER,
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test_key_1" })
      .setIssuer(issuer)
      .setAudience(EMERALD_RESOURCE_IDENTIFIER)
      .setSubject("usr_12345")
      .setExpirationTime("-10s") // expired
      .sign(privateKey);

    const expiredCheck = await verifyEmeraldToken(expiredToken, {
      issuer,
      jwksUrl: localJwksUrl,
      requiredScope: "emerald:search",
    });
    expect(expiredCheck.valid).toBe(false);
    expect(expiredCheck.error).toBe("expired_token");
  });
});
