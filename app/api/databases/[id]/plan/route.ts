import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestPlanChange } from "@/lib/store";
import type { PlanId } from "@/lib/plans";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { plan?: PlanId };
  if (!body.plan) return NextResponse.json({ error: "plan is required" }, { status: 400 });

  try {
    const { database, job } = await requestPlanChange(email, id, body.plan);
    return NextResponse.json({ database, job });
  } catch (err: any) {
    const status = err.message === "not_found" ? 404 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
