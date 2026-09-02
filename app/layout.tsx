import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stashi — PostgreSQL without surprise bills",
  description: "Fixed-price managed PostgreSQL for developers who want boring bills and production-grade defaults.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
