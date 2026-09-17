/**
 * Stashi Auth — Standalone TypeScript Integration Example
 * Demonstrates a third-party OAuth 2.1 client integrating with Stashi Auth
 * using purely standard Web APIs (fetch, crypto) without proprietary SDKs.
 */

import { createHash, randomBytes } from "node:crypto";

const STASHI_AUTH_ISSUER = process.env.STASHI_AUTH_URL || "https://mystashi.online";
const EMERALD_MCP_RESOURCE = "https://emerald.ynai.co.ke/mcp";

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

async function runDemo() {
  console.log("=== Stashi Auth Integration Demo ===");

  // 1. Discover authorization server metadata
  console.log(`\n1. Fetching OIDC discovery from: ${STASHI_AUTH_ISSUER}/.well-known/openid-configuration`);
  const discoveryRes = await fetch(`${STASHI_AUTH_ISSUER}/.well-known/openid-configuration`);
  if (!discoveryRes.ok) {
    throw new Error(`Failed to fetch discovery document: ${discoveryRes.statusText}`);
  }
  const discovery = (await discoveryRes.json()) as OidcDiscovery;
  console.log("Discovered endpoints:");
  console.log("  Authorize:", discovery.authorization_endpoint);
  console.log("  Token:    ", discovery.token_endpoint);
  console.log("  JWKS:     ", discovery.jwks_uri);

  // 2. Prepare PKCE (S256) parameters
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");

  const clientId = process.env.STASHI_CLIENT_ID || "demo_client_id";
  const redirectUri = process.env.STASHI_REDIRECT_URI || "http://127.0.0.1:8080/callback";

  // 3. Build Authorization URL
  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid profile email offline_access emerald:search emerald:read");
  authUrl.searchParams.set("resource", EMERALD_MCP_RESOURCE);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  console.log("\n2. Direct user to authorization URL:");
  console.log(authUrl.toString());

  console.log("\n3. Once the user approves consent and redirects with ?code=<auth_code>:");
  console.log(`
  // Exchange authorization code for tokens:
  const tokenRes = await fetch('${discovery.token_endpoint}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: '${clientId}',
      code: '<CODE_FROM_CALLBACK>',
      redirect_uri: '${redirectUri}',
      code_verifier: '${codeVerifier}',
    }),
  });
  const tokens = await tokenRes.json();
  `);

  console.log("4. Call protected Emerald MCP tools using the access token:");
  console.log(`
  // Call Emerald MCP endpoint
  const mcpRes = await fetch('${EMERALD_MCP_RESOURCE}', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + tokens.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'emerald_search',
        arguments: { query: 'data privacy compliance' },
      },
    }),
  });
  const result = await mcpRes.json();
  console.log(result);
  `);
}

runDemo().catch(console.error);
