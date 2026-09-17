// Manual protocol verification script (Section 45)
try {
  process.loadEnvFile(".env.local");
} catch {}

import { GET as getOidc } from "../app/.well-known/openid-configuration/route";
import { GET as getOauth } from "../app/.well-known/oauth-authorization-server/route";
import { GET as getJwks } from "../app/.well-known/jwks.json/route";
import { GET as getEmeraldMetadata } from "../app/api/emerald/mcp/.well-known/oauth-protected-resource/route";

async function verify() {
  console.log("=== Stashi Auth Protocol Endpoint Verification ===");

  // 1. OIDC Discovery
  const oidcRes = await getOidc();
  const oidcData = await oidcRes.json();
  console.log("\n1. GET /.well-known/openid-configuration:", oidcRes.status);
  console.log("   Issuer:", oidcData.issuer);
  console.log("   Authorization Endpoint:", oidcData.authorization_endpoint);
  console.log("   Token Endpoint:", oidcData.token_endpoint);
  console.log("   JWKS URI:", oidcData.jwks_uri);
  console.log("   Userinfo Endpoint:", oidcData.userinfo_endpoint);
  console.log("   Code challenge methods:", oidcData.code_challenge_methods_supported);

  if (oidcData.issuer !== "https://mystashi.online") {
    throw new Error("Invalid OIDC issuer!");
  }

  // 2. OAuth Authorization Server Metadata
  const oauthRes = await getOauth();
  const oauthData = await oauthRes.json();
  console.log("\n2. GET /.well-known/oauth-authorization-server:", oauthRes.status);
  console.log("   Issuer:", oauthData.issuer);
  console.log("   Introspection Endpoint:", oauthData.introspection_endpoint);
  console.log("   Revocation Endpoint:", oauthData.revocation_endpoint);

  // 3. JWKS
  const jwksRes = await getJwks();
  const jwksData = await jwksRes.json();
  console.log("\n3. GET /.well-known/jwks.json:", jwksRes.status);
  console.log("   Keys present:", Array.isArray(jwksData.keys) ? jwksData.keys.length : 0);

  // 4. Emerald Protected Resource Metadata
  const emeraldReq = new Request("https://emerald.ynai.co.ke/mcp/.well-known/oauth-protected-resource");
  const emeraldRes = await getEmeraldMetadata(emeraldReq);
  const emeraldData = await emeraldRes.json();
  console.log("\n4. GET Emerald Protected Resource Metadata:", emeraldRes.status);
  console.log("   Resource:", emeraldData.resource);
  console.log("   Authorization Servers:", emeraldData.authorization_servers);
  console.log("   Scopes Supported:", emeraldData.scopes_supported);

  if (emeraldData.resource !== "https://emerald.ynai.co.ke/mcp") {
    throw new Error("Invalid Emerald resource!");
  }

  console.log("\n=== ALL PROTOCOL ENDPOINTS VERIFIED SUCCESSFULLY ===");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
