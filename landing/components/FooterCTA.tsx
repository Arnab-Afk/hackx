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
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "clamp(38px, 6vw, 70px)",
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
            color: "#555",
            lineHeight: 1.65,
            maxWidth: 400,
            marginBottom: 40,
          }}
        >
          COMPUT3 is live on Base Sepolia. Three provider nodes are running. Start deploying in under 60 seconds.
        </p>

        {/* Email + CTA — pill shaped like Runlayer */}
        <form
          style={{ display: "flex", maxWidth: 400 }}
          onSubmit={(e) => {
            e.preventDefault()
            window.location.href = "http://localhost:3001"
          }}
        >
          <input
            type="email"
            placeholder="Enter your email..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              flex: 1,
              padding: "13px 20px",
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
              padding: "13px 22px",
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

        {/* Trust signals */}
        <div style={{ display: "flex", gap: 24, marginTop: 28, flexWrap: "wrap" }}>
          {[
            "Base Sepolia",
            "EAS Attested",
            "x402 Protocol",
            "LUKS Encrypted",
            "Open Source",
          ].map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: 12,
                color: "#444",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#4ade80",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
