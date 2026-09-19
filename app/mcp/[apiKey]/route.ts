import { mcpMethodNotAllowed, mcpOptions, mcpPost } from "@/lib/mcp-handler";

// URL-embedded key endpoint for clients that do not support custom request headers.
// The key in the path acts as the credential, identical to a scoped or primary API key.
export const runtime = "nodejs";

export const OPTIONS = mcpOptions;
export const GET = mcpMethodNotAllowed;

export async function POST(request: Request, context: { params: Promise<{ apiKey: string }> }) {
  const { apiKey } = await context.params;
  return mcpPost(request, apiKey);
}
