"use client"

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer style={{ background: "#030303", overflow: "hidden" }}>
      {/* Top info row */}
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "64px 40px 48px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 40,
          alignItems: "start",
        }}
      >
        {/* Tagline */}
        <div>
          <p style={{ fontSize: 15, color: "#999", lineHeight: 1.9, fontWeight: 400, margin: 0 }}>
            Deploy trustlessly.<br />
            Verify on-chain.<br />
            Trust nobody.
          </p>
        </div>

        {/* Center links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "GitHub", href: "https://github.com/Arnab-Afk/hackx" },
            { label: "Architecture", href: "https://github.com/Arnab-Afk/hackx#architecture" },
            { label: "Smart Contracts", href: "https://github.com/Arnab-Afk/hackx/tree/main/contracts" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 15, color: "#999", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#999")}
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "EAS Attestations", href: "https://attest.org" },
            { label: "x402 Protocol", href: "https://github.com/coinbase/x402" },
            { label: "BaseScan", href: "https://sepolia.basescan.org" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 15, color: "#999", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fff")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#999")}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* Giant wordmark — left-aligned, bleeds off bottom like WISP reference */}
      <div
        style={{
          padding: "0 20px",
          lineHeight: 0.82,
          userSelect: "none",
          overflow: "hidden",
          marginBottom: -24,
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: "clamp(120px, 22vw, 320px)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: "#fff",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          COMPUT
          <span style={{ display: "inline-block", transform: "scaleX(-1)" }}>E</span>
        </span>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "20px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#444",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          © {year} COMPUT3. All rights reserved.
        </span>
        <span style={{ fontSize: 12, color: "#444" }}>
          Made with ♥ by{" "}
          <a
            href="https://github.com/Arnab-Afk/hackx"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}
          >
            Team Big(O)
          </a>
        </span>
      </div>
    </footer>
  )
}
