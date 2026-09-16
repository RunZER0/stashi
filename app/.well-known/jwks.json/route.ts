import { NextResponse } from "next/server";
import { getPublicJwks } from "@/lib/auth/jwks";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const jwks = await getPublicJwks();
  return NextResponse.json(jwks, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
