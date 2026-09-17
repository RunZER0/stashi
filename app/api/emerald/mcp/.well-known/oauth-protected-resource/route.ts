import { NextResponse } from "next/server";
import { getEmeraldProtectedResourceMetadata } from "@/lib/emerald/protected-resource";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const host = request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const issuer = isLocal ? `http://${host}` : process.env.BETTER_AUTH_URL || "https://mystashi.online";

  const metadata = getEmeraldProtectedResourceMetadata(issuer);

  return NextResponse.json(metadata, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
