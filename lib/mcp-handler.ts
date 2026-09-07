import { NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { resolveAccessByApiKey } from "@/lib/auth";
import { registerAccountTools, registerDatabaseTools } from "@/lib/mcp-tools";

// Shared implementation behind both MCP routes:
//   app/mcp/route.ts            -- Authorization: Bearer <key> header
//   app/mcp/[apiKey]/route.ts   -- key embedded in the URL path instead
//
// The second one exists because ChatGPT's "New Plugin" connector dialog
// only offers "No Auth" or "OAuth" -- there's no field for a static
// Bearer/API-key header at all. With "No Auth" selected it sends every
// request with no Authorization header whatsoever, so the only way to
// identify which database a request is for is to put the key in the URL
// itself, the same way a webhook secret would be. Both routes end up
// here with whatever key they found; the header takes priority if both
// happen to be present.

// ChatGPT's connector-creation step (and likely the tool-call path too, at
// least in part) runs as a direct browser fetch from chatgpt.com to this
// URL, not purely server-to-server -- without these headers the browser
// blocks the request after preflight and the failure shows up client-side
// as an opaque "Something went wrong", with nothing useful in the response
// body to diagnose from. Wide open (`*`) rather than an origin allowlist
// since every credential here is the key itself, not a cookie -- there's
// no session for a third-party page to ride on.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function withCors(response: NextResponse) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// Minimal Transport implementation: one JSON-RPC message in, wait for the
// one response the Server emits via send(), return it. Good enough for the
// request/response tool-call pattern every tool here uses -- none of them
// stream partial results or send server-initiated notifications mid-call.
class OneShotTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sessionId?: string;

  private resolveResponse: ((msg: JSONRPCMessage) => void) | null = null;

  async start() {}
  async close() {
    this.onclose?.();
  }
  async send(message: JSONRPCMessage) {
    this.resolveResponse?.(message);
    this.resolveResponse = null;
  }

  handle(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    if (!("id" in message)) {
      this.onmessage?.(message);
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.resolveResponse = resolve;
      this.onmessage?.(message);
    });
  }
}

function unauthorized() {
  return withCors(
    NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid Stashi API key" }, id: null },
      { status: 401 }
    )
  );
}

export async function mcpOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function mcpMethodNotAllowed() {
  return withCors(
    NextResponse.json(
      { error: "This endpoint only accepts POST (MCP Streamable HTTP, non-streaming)." },
      { status: 405 }
    )
  );
}

export async function mcpPost(request: Request, pathApiKey: string | null): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const headerApiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const apiKey = headerApiKey || pathApiKey;
  if (!apiKey) return unauthorized();

  const access = await resolveAccessByApiKey(apiKey);
  if (!access) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) {
    return withCors(
      NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
        { status: 400 }
      )
    );
  }

  const origin = new URL(request.url).origin;
  const server = new McpServer(
    { name: "stashi", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );
  if (access.kind === "account") {
    registerAccountTools(server, { origin, apiKey });
  } else {
    registerDatabaseTools(server, { origin, apiKey, databaseId: access.databaseId });
  }

  const transport = new OneShotTransport();
  await server.connect(transport as never);

  const messages: JSONRPCMessage[] = Array.isArray(body) ? body : [body];
  const responses: JSONRPCMessage[] = [];
  for (const message of messages) {
    const response = await transport.handle(message);
    if (response) responses.push(response);
  }

  await server.close();

  if (responses.length === 0) {
    // Pure notification(s), nothing to report back.
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  return withCors(NextResponse.json(Array.isArray(body) ? responses : responses[0]));
}
