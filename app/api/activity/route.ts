import { NextResponse } from "next/server";
import { listActivity } from "@/lib/store";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ activity: await listActivity(email) });
}
