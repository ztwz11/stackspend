import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "StackSpend Local Dashboard",
  description: "Local-first cloud and SaaS usage, health, and expected billing dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
