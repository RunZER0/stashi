import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listActivity } from "@/lib/store";

export async function GET() {
  const email = (await cookies()).get("stashi_session")?.value;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ activity: await listActivity(email) });
}
