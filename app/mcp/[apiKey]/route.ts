import { mcpMethodNotAllowed, mcpOptions, mcpPost } from "@/lib/mcp-handler";

// URL-embedded-key variant of the remote MCP endpoint, for clients that
// can't send a custom Authorization header on their connector config --
// ChatGPT's "New Plugin" dialog only offers "No Auth" or full OAuth, so
// with "No Auth" selected it sends zero auth headers on every request.
// The key in the path plays the same role a webhook secret does: the URL
// itself is the credential. Treat it the same as the primary API key or a
// scoped key everywhere else -- rotating it here is exactly rotating the
// key shown in the console.
export const runtime = "nodejs";

export const OPTIONS = mcpOptions;
export const GET = mcpMethodNotAllowed;

export async function POST(request: Request, context: { params: Promise<{ apiKey: string }> }) {
  const { apiKey } = await context.params;
  return mcpPost(request, apiKey);
}
