import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: {
    default: "Stashi — Managed PostgreSQL from $1/month",
    template: "%s — Stashi",
  },
  description: "Create a PostgreSQL database with TLS, connection pooling and a fixed monthly price.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
