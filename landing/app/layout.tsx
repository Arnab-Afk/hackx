import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COMPUT3 — Trustless AI Compute",
  description:
    "Deploy any repo to verified provider nodes with streaming on-chain payment and EAS attestation on Base Sepolia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
