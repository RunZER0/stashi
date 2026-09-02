import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email || !email.includes("@")) return NextResponse.redirect(new URL("/login", request.url), 303);

  const response = NextResponse.redirect(new URL("/console", request.url), 303);
  response.cookies.set("stashi_session", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
