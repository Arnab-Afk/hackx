"use client"

import { IsometricViz } from "./IsometricViz"

export function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#030303",
      }}
    >
      {/* Viz full-bleed behind everything */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <IsometricViz />
      </div>

      {/* Very gentle left tint — just enough contrast for text, lets viz bleed through */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(to right, rgba(3,3,3,0.78) 0%, rgba(3,3,3,0.55) 30%, rgba(3,3,3,0.15) 55%, transparent 72%)",
          pointerEvents: "none",
        }}
      />

      {/* Text — left half, above scrim */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "120px 40px 80px 64px",
          maxWidth: "52%",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 100,
            padding: "5px 14px",
            fontSize: 12,
            color: "#888",
            marginBottom: 40,
            letterSpacing: "0.02em",
            width: "fit-content",
            backdropFilter: "blur(4px)",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          Live on Base Sepolia · EAS Attested · x402 Payments
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 4vw, 72px)",
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.04em",
            color: "#fff",
            marginBottom: 24,
          }}
        >
          Every cloud asks you<br />
          to{" "}
          <span style={{ color: "rgba(255,255,255,0.32)" }}>trust them.</span>
        </h1>

        <p style={{ fontSize: 17, color: "#ccc", maxWidth: 420, lineHeight: 1.65, marginBottom: 12 }}>
          We are the only one that proves you cannot.
        </p>
        <p style={{ fontSize: 14, color: "#888", maxWidth: 390, lineHeight: 1.7, marginBottom: 44 }}>
          Describe your stack in plain English. An AI agent deploys it in under 60 seconds with LUKS-encrypted containers, per-provider EAS attestation, and x402 micropayments.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="https://app.comput3.xyz"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "#fff",
              color: "#000",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 26px",
              borderRadius: 8,
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            Launch App
          </a>
          <a
            href="https://github.com/Arnab-Afk/hackx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#ccc",
              fontSize: 14,
              fontWeight: 500,
              padding: "12px 26px",
              borderRadius: 8,
              textDecoration: "none",
              backdropFilter: "blur(4px)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"
              ;(e.currentTarget as HTMLElement).style.color = "#fff"
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"
              ;(e.currentTarget as HTMLElement).style.color = "#ccc"
            }}
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
