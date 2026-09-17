import { NextResponse } from "next/server";
import { getAllSupportedScopes } from "@/lib/auth/resources";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request?: Request) {
  const host = request?.headers?.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const issuer = isLocal ? `http://${host}` : process.env.BETTER_AUTH_URL || "https://mystashi.online";

  const config = {
    issuer,
    authorization_endpoint: `${issuer}/api/auth/oauth2/authorize`,
    token_endpoint: `${issuer}/api/auth/oauth2/token`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    revocation_endpoint: `${issuer}/api/auth/oauth2/revoke`,
    introspection_endpoint: `${issuer}/api/auth/oauth2/introspect`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: getAllSupportedScopes(),
  };

  return NextResponse.json(config, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
