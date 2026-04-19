"use client"

import { useState } from "react"

export function FooterCTA() {
  const [email, setEmail] = useState("")

  return (
    <section
      style={{
        background: "#030303",
        padding: "120px 24px 100px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        {/* Left — headline */}
        <div>
          <h2
            style={{
              fontSize: "clamp(38px, 5vw, 68px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#fff",
              lineHeight: 1.05,
              marginBottom: 20,
            }}
          >
            Deploy trustlessly.<br />
            Verify on-chain.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#666",
              lineHeight: 1.65,
              maxWidth: 400,
              margin: 0,
            }}
          >
            COMPUT3 is live on Base Sepolia. Three provider nodes are running. Start deploying in under 60 seconds.
          </p>
        </div>

        {/* Right — form + badges */}
        <div>
          <form
            style={{ display: "flex", maxWidth: 420 }}
            onSubmit={(e) => {
              e.preventDefault()
              window.open("https://app.comput3.xyz", "_blank", "noopener,noreferrer")
            }}
          >
            <input
              type="email"
              placeholder="Enter your email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                flex: 1,
                padding: "14px 20px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRight: "none",
                borderRadius: "100px 0 0 100px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "14px 24px",
                background: "#fff",
                color: "#000",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                borderRadius: "0 100px 100px 0",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#e8e8e8")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#fff")}
            >
              Get Started
            </button>
          </form>

          <div style={{ display: "flex", gap: 20, marginTop: 24, flexWrap: "wrap" }}>
            {["Base Sepolia", "EAS Attested", "x402 Protocol", "LUKS Encrypted", "Open Source"].map((badge) => (
              <span
                key={badge}
                style={{ fontSize: 12, color: "#555", display: "flex", alignItems: "center", gap: 7 }}
              >
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
