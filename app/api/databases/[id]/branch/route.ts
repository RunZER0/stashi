import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { createBranch } from "@/lib/store";

// Allowed via API key (not just session) on purpose: this is the endpoint
// the MCP server's create_branch tool calls, so an agent can spin up a test
// branch of its own database mid-conversation. A read-only key can't --
// creating a new billable resource isn't a read.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.scope === "readonly") {
    return NextResponse.json({ error: "This API key is read-only and can't create a branch." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string; ttlHours?: number };

  try {
    const { database, job } = await createBranch(access.email, id, body.name || "branch", body.ttlHours);
    return NextResponse.json({ database, job }, { status: 201 });
  } catch (err: any) {
    const status = err.message === "not_found" ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
