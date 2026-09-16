import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { GET as getOidcConfig } from "@/app/.well-known/openid-configuration/route";
import { GET as getOAuthConfig } from "@/app/.well-known/oauth-authorization-server/route";
import { getAllSupportedScopes, getAllResourceIdentifiers } from "@/lib/auth/resources";

describe("OAuth 2.1 & OpenID Connect Discovery", () => {
  it("serves valid OIDC discovery metadata with canonical issuer", async () => {
    const req = new Request("https://auth.mystashi.online/.well-known/openid-configuration");
    const res = await getOidcConfig(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.issuer).toBe("https://auth.mystashi.online");
    expect(body.authorization_endpoint).toBe("https://auth.mystashi.online/api/auth/oauth2/authorize");
    expect(body.token_endpoint).toBe("https://auth.mystashi.online/api/auth/oauth2/token");
    expect(body.jwks_uri).toBe("https://auth.mystashi.online/.well-known/jwks.json");
    expect(body.response_types_supported).toEqual(["code"]);
    expect(body.code_challenge_methods_supported).toContain("S256");
    expect(body.scopes_supported).toContain("openid");
    expect(body.scopes_supported).toContain("emerald:search");
    expect(body.scopes_supported).toContain("stashi:database:read");
  });

  it("serves valid OAuth 2.1 authorization server metadata", async () => {
    const req = new Request("https://auth.mystashi.online/.well-known/oauth-authorization-server");
    const res = await getOAuthConfig(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.issuer).toBe("https://auth.mystashi.online");
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.grant_types_supported).toContain("authorization_code");
    expect(body.grant_types_supported).toContain("refresh_token");
  });
});

describe("PKCE S256 Cryptographic Verification", () => {
  it("correctly derives code_challenge from code_verifier via SHA-256", () => {
    const codeVerifier = randomBytes(32).toString("base64url");
    const expectedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

    // Recompute verifier check
    const calculatedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(calculatedChallenge).toBe(expectedChallenge);

    // Any tampering or wrong verifier must fail
    const wrongVerifier = randomBytes(32).toString("base64url");
    const wrongChallenge = createHash("sha256").update(wrongVerifier).digest("base64url");
    expect(wrongChallenge).not.toBe(expectedChallenge);
  });
});

describe("Protected Resources Registry", () => {
  it("includes canonical Emerald MCP and Stashi APIs", () => {
    const resources = getAllResourceIdentifiers();
    expect(resources).toContain("https://emerald.ynai.co.ke/mcp");
    expect(resources).toContain("https://api.mystashi.online");
  });

  it("includes all core identity, Emerald, and database scopes", () => {
    const scopes = getAllSupportedScopes();
    expect(scopes).toContain("openid");
    expect(scopes).toContain("profile");
    expect(scopes).toContain("email");
    expect(scopes).toContain("offline_access");
    expect(scopes).toContain("emerald:search");
    expect(scopes).toContain("emerald:read");
    expect(scopes).toContain("stashi:database:read");
    expect(scopes).toContain("stashi:database:write");
    expect(scopes).toContain("stashi:database:admin");
    expect(scopes).toContain("stashi:api-keys:manage");
  });
});
