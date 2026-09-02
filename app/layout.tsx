import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: {
    default: "Stashi — Low-cost, agentic-tuned PostgreSQL from $1/month",
    template: "%s — Stashi",
  },
  description: "Low-cost, agentic-tuned managed PostgreSQL with TLS, PgBouncer pooling, MCP support, and fixed monthly plans from $1/month.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
