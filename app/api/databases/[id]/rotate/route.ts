import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ id, password: `st_${randomBytes(12).toString("base64url")}`, rotatedAt: new Date().toISOString() });
}
