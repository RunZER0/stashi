import { NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { resolveAccessByApiKey } from "@/lib/auth";
import { registerStashiTools } from "@/lib/mcp-tools";

// Remote MCP endpoint for clients that can't spawn a local process the way
// Claude Desktop/Cursor/Windsurf do -- ChatGPT's Developer Mode connectors
// chief among them, which require a public HTTPS URL speaking MCP's
// Streamable HTTP transport rather than a `command`/`args` stdio config.
// Lives at the top-level /mcp path (not nested under /api) to match what
// MCP clients conventionally expect and what ChatGPT's connector setup
// asks for. Same tools as mcp-server/index.js (the published stdio
// package), same underlying REST API, different transport.
//
// Stateless by design: every request carries its own Bearer STASHI_API_KEY
// (or scoped key), which is resolved to a database fresh on every call --
// there's no server-side session to hold between the `initialize` handshake
// and a later `tools/call`, so nothing is lost by not keeping one. This
// also sidesteps needing sticky sessions across server instances.
export const runtime = "nodejs";

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

  // Notifications (no `id`) get no response -- resolve immediately so the
  // caller doesn't hang waiting for a send() that will never come.
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

// ChatGPT's connector-creation step (and likely the tool-call path too, at
// least in part) runs as a direct browser fetch from chatgpt.com to this
// URL, not purely server-to-server -- without these headers the browser
// blocks the request after preflight and the failure shows up client-side
// as an opaque "Something went wrong", with nothing useful in the response
// body to diagnose from. Wide open (`*`) rather than an origin allowlist
// since every credential here is the Bearer key itself, not a cookie --
// there's no session for a third-party page to ride on.
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

function unauthorized() {
  return withCors(
    NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid Stashi API key" }, id: null },
      { status: 401 }
    )
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
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
  registerStashiTools(server, { origin, apiKey, databaseId: access.databaseId });

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

export async function GET() {
  return withCors(
    NextResponse.json(
      { error: "This endpoint only accepts POST (MCP Streamable HTTP, non-streaming)." },
      { status: 405 }
    )
  );
}
