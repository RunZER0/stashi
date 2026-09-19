import { mcpMethodNotAllowed, mcpOptions, mcpPost } from "@/lib/mcp-handler";

// Header-based remote MCP endpoint: Authorization: Bearer <STASHI_API_KEY>.
// For clients that support custom HTTP authorization headers.
// See app/mcp/[apiKey]/route.ts for the URL-embedded-key variant.
export const runtime = "nodejs";

export const OPTIONS = mcpOptions;
export const GET = mcpMethodNotAllowed;

export async function POST(request: Request) {
  return mcpPost(request, null);
}
