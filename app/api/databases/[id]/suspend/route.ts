import { NextResponse } from "next/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { suspended?: boolean };
  return NextResponse.json({ id, status: body.suspended === false ? "healthy" : "suspended" });
}
