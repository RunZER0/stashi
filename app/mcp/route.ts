import { mcpMethodNotAllowed, mcpOptions, mcpPost } from "@/lib/mcp-handler";

// Header-based remote MCP endpoint: Authorization: Bearer <STASHI_API_KEY>.
// For clients that support a custom auth header on their connector config
// (the MCP spec's own recommended shape). See app/mcp/[apiKey]/route.ts for
// the URL-embedded-key variant, needed by clients (ChatGPT's "New Plugin"
// dialog, at least as of this writing) whose only auth options are
// "No Auth" or full OAuth, with nothing in between.
export const runtime = "nodejs";

export const OPTIONS = mcpOptions;
export const GET = mcpMethodNotAllowed;

export async function POST(request: Request) {
  return mcpPost(request, null);
}
