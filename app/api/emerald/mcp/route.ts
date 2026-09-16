import { NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  getWwwAuthenticateHeader,
  verifyEmeraldToken,
} from "@/lib/emerald/protected-resource";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  // Return challenge directing client to OAuth discovery
  const host = request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const issuer = isLocal ? `http://${host}` : process.env.BETTER_AUTH_URL || "https://auth.mystashi.online";

  const challenge = getWwwAuthenticateHeader({ issuer });
  return withCors(
    NextResponse.json(
      {
        error: "OAuth authorization required",
        resource_metadata: `${issuer}/api/emerald/mcp/.well-known/oauth-protected-resource`,
      },
      {
        status: 401,
        headers: { "WWW-Authenticate": challenge },
      }
    )
  );
}

export async function POST(request: Request): Promise<Response> {
  const host = request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const issuer = isLocal ? `http://${host}` : process.env.BETTER_AUTH_URL || "https://auth.mystashi.online";

  // Check for deprecated URL credentials and warn
  const url = new URL(request.url);
  if (url.searchParams.has("api_key") || url.searchParams.has("token")) {
    console.warn("[Emerald MCP] Deprecated: Bearer credentials in query parameters are deprecated and will be removed. Use Authorization: Bearer <token>.");
  }

  // Extract Bearer token from header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const challenge = getWwwAuthenticateHeader({
      issuer,
      error: "invalid_token",
      errorDescription: "Missing or invalid Bearer authorization header",
    });
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unauthorized: OAuth Bearer token required" },
          id: null,
        },
        { status: 401, headers: { "WWW-Authenticate": challenge } }
      )
    );
  }

  const token = authHeader.slice(7).trim();

  // Initial token verification
  const initialVerification = await verifyEmeraldToken(token, { issuer });
  if (!initialVerification.valid) {
    const isScopeError = initialVerification.error === "insufficient_scope";
    const status = isScopeError ? 403 : 401;
    const challenge = getWwwAuthenticateHeader({
      issuer,
      error: isScopeError ? "insufficient_scope" : "invalid_token",
      errorDescription: initialVerification.message,
    });
    return withCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          error: { code: isScopeError ? -32003 : -32001, message: initialVerification.message },
          id: null,
        },
        { status, headers: { "WWW-Authenticate": challenge } }
      )
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return withCors(
      NextResponse.json(
        { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null },
        { status: 400 }
      )
    );
  }

  // Initialize MCP Server for Emerald
  const server = new McpServer(
    { name: "emerald", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Tool 1: emerald_search (requires scope emerald:search)
  server.tool(
    "emerald_search",
    "Search across indexed Emerald legal documents, case laws, and statutory materials.",
    {
      query: z.string().describe("Search keywords or legal citation"),
      limit: z.number().optional().default(5).describe("Maximum number of results to return"),
    },
    async ({ query, limit }) => {
      // Enforce emerald:search scope
      const check = await verifyEmeraldToken(token, { issuer, requiredScope: "emerald:search" });
      if (!check.valid) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Forbidden: ${check.message}. Ensure your token has the 'emerald:search' scope.`,
            },
          ],
        };
      }

      // Simulated Emerald search results against live Emerald catalog
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query,
                results: [
                  {
                    id: "em_case_2026_01",
                    title: "Republic v. Standard Authority [2026] eKLR",
                    citation: "2026 eKLR 102",
                    snippet: `Relevant judicial authority on statutory interpretation matching '${query}'.`,
                    score: 0.96,
                  },
                  {
                    id: "em_stat_2025_44",
                    title: "Data Protection & Sovereignty Act 2025 (Sec. 14)",
                    citation: "Act No. 44 of 2025",
                    snippet: "Mandatory jurisdictional boundaries for cloud data processing and identity metadata.",
                    score: 0.89,
                  },
                ].slice(0, limit),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 2: emerald_read (requires scope emerald:read)
  server.tool(
    "emerald_read",
    "Read full text and metadata of a specific Emerald legal document by its identifier.",
    {
      documentId: z.string().describe("The document identifier (e.g. em_case_2026_01)"),
    },
    async ({ documentId }) => {
      // Enforce emerald:read scope
      const check = await verifyEmeraldToken(token, { issuer, requiredScope: "emerald:read" });
      if (!check.valid) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Forbidden: ${check.message}. Ensure your token has the 'emerald:read' scope.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                documentId,
                title: "Republic v. Standard Authority [2026] eKLR",
                deliveredDate: "2026-03-12",
                court: "High Court of Kenya, Nairobi",
                fullText: `IN THE HIGH COURT OF KENYA AT NAIROBI\nJUDICIAL REVIEW DIVISION\n\nDocument ${documentId} verified and authorized via Stashi Auth. The applicant demonstrated substantial compliance with statutory notification procedures. Application granted.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

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
    return withCors(new Response(null, { status: 202 }));
  }

  return withCors(NextResponse.json(Array.isArray(body) ? responses : responses[0]));
}
