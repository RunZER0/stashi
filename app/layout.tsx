import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "./marketing.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Stashi — Low-cost, agentic-tuned PostgreSQL from $1/month",
    template: "%s — Stashi",
  },
  description: "Low-cost, agentic-tuned managed PostgreSQL with TLS, PgBouncer pooling, MCP support, and fixed monthly plans from $1/month.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body>{children}</body>
    </html>
  );
}
