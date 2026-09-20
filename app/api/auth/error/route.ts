import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const error = searchParams.get("error") || "auth_error";
  const errorDescription = searchParams.get("error_description");

  const destination = new URL("/sign-in", req.url);
  destination.searchParams.set("error", error);
  if (errorDescription) {
    destination.searchParams.set("error_description", errorDescription);
  }

  return NextResponse.redirect(destination);
}
