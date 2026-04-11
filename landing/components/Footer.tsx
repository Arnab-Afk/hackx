"use client"

import { Wordmark } from "./Wordmark"

const LINKS = {
  Product: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Features", href: "#features" },
    { label: "Use Cases", href: "#providers" },
    { label: "Launch App", href: "http://localhost:3001" },
  ],
  Resources: [
    { label: "GitHub", href: "https://github.com/Arnab-Afk/hackx" },
    { label: "Architecture", href: "https://github.com/Arnab-Afk/hackx#architecture" },
    { label: "Smart Contracts", href: "https://github.com/Arnab-Afk/hackx/tree/main/contracts" },
    { label: "README", href: "https://github.com/Arnab-Afk/hackx/blob/main/README.md" },
  ],
  Technology: [
    { label: "EAS on Base Sepolia", href: "https://attest.org" },
    { label: "x402 Protocol", href: "https://github.com/coinbase/x402" },
    { label: "LUKS Encryption", href: "https://gitlab.com/cryptsetup/cryptsetup" },
    { label: "gVisor Sandbox", href: "https://gvisor.dev" },
  ],
  Connect: [
    { label: "Twitter / X", href: "https://x.com" },
    { label: "Discord", href: "#" },
    { label: "HackX Repo", href: "https://github.com/Arnab-Afk/hackx" },
    { label: "BaseScan", href: "https://sepolia.basescan.org" },
  ],
}

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "64px 24px 40px",
        maxWidth: 1180,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr repeat(4, 1fr)",
          gap: 40,
          marginBottom: 60,
        }}
      >
        {/* Brand */}
        <div>
          <Wordmark className="text-base" />
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginTop: 12, maxWidth: 220 }}>
            Trustless cloud infrastructure. Agentic deployment. Cryptographic proof that nobody — including us — can access your data.
          </p>
        </div>

        {/* Link columns */}
        {Object.entries(LINKS).map(([col, links]) => (
          <div key={col}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#444",
                marginBottom: 16,
              }}
            >
              {col}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {links.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{
                    fontSize: 13,
                    color: "#555",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#fff")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#555")}
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span style={{ fontSize: 12, color: "#333" }}>
          © {new Date().getFullYear()} Zkloud. Built for HackX 2025. &ldquo;Every cloud asks you to trust them. We prove you don&apos;t have to.&rdquo;
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: "#444",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 100,
            padding: "4px 12px",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          All systems operational
        </div>
      </div>
    </footer>
  )
}
