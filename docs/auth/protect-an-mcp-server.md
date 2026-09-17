# Protect an MCP Server using Stashi Auth

This guide explains how to secure a Model Context Protocol (MCP) server using RFC 9728 Protected Resource Metadata and Stashi Auth OAuth 2.1 tokens.

## Architecture

Legacy MCP connections relied on API keys embedded directly into the connector URL (e.g. `https://server.com/mcp?key=...`).

The current MCP standard replaces URL keys with standard OAuth 2.1 Bearer tokens:

```text
MCP Client
    │
    │ Connects to https://emerald.ynai.co.ke/mcp
    ▼
Emerald replies with 401 + WWW-Authenticate
    │
    │ Client reads /.well-known/oauth-protected-resource
    ▼
Client discovers https://mystashi.online
    │
    │ Client identifies via CIMD (Client ID Metadata Document)
    ▼
PKCE Authorization + Consent
    │
    │ Stashi Auth issues resource-bound access token
    ▼
Client calls https://emerald.ynai.co.ke/mcp with Authorization: Bearer <token>
    │
    ▼
MCP Server executes tool calls
```

---

## 1. Expose Protected Resource Metadata (RFC 9728)

Expose `/.well-known/oauth-protected-resource`:

```json
{
  "resource": "https://emerald.ynai.co.ke/mcp",
  "authorization_servers": [
    "https://mystashi.online"
  ],
  "scopes_supported": [
    "openid",
    "profile",
    "email",
    "emerald:search",
    "emerald:read"
  ],
  "bearer_methods_supported": ["header"]
}
```

---

## 2. Issue `WWW-Authenticate` Challenges

When an unauthenticated request arrives at `/mcp`:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="Emerald MCP", resource="https://emerald.ynai.co.ke/mcp", authorization_server="https://mystashi.online"
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Unauthorized: OAuth Bearer token required"
  },
  "id": null
}
```

---

## 3. Client Identity with CIMD

Modern MCP clients identify themselves by passing a Client ID Metadata Document (CIMD) URL as `client_id` (e.g. `https://my-client.app/.well-known/oauth-client.json`).

Stashi Auth enforces the `mcp-2026-07-28` profile with built-in SSRF protection (blocking loopback, RFC 1918, and internal IPs).

---

## 4. Validating Tokens at the MCP Server

The MCP server validates incoming tokens using Stashi Auth's JWKS:

```ts
import { verifyEmeraldToken } from "@/lib/emerald/protected-resource";

const result = await verifyEmeraldToken(token, {
  issuer: "https://mystashi.online",
  requiredScope: "emerald:search",
});

if (!result.valid) {
  // Return JSON-RPC error with appropriate 401 / 403 status
}
```
