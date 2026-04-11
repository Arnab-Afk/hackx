"use client"

const DEMO_LINES = [
  { role: "user", text: "I need a React frontend, FastAPI backend with pandas, and PostgreSQL." },
  { role: "system", text: "Selecting provider from ProviderRegistry.sol on Base Sepolia..." },
  { role: "system", text: "Attaching X-PAYMENT header · streaming micropayments via x402..." },
  { role: "system", text: "Creating LUKS-encrypted volume with your keypair..." },
  { role: "system", text: "Installing react, vite · fastapi, pandas, uvicorn, psycopg2..." },
  { role: "assistant", text: "Stack ready in 48s. Attestation: basescan.org/tx/0x4a2f...  🔑 Encryption key saved to your browser — never sent to the server." },
]

export function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "120px 24px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* subtle radial glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 700,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(120,80,255,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Eyebrow badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 100,
          padding: "5px 14px",
          fontSize: 12,
          color: "#777",
          marginBottom: 36,
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
        Live on Base Sepolia · EAS Attested · x402 Payments
      </div>

      {/* Main headline */}
      <h1
        style={{
          fontSize: "clamp(42px, 7vw, 88px)",
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.04em",
          color: "#fff",
          maxWidth: 900,
          marginBottom: 28,
        }}
      >
        Every cloud asks you<br />
        to <span style={{ color: "rgba(255,255,255,0.28)" }}>trust them.</span>
      </h1>

      {/* Subtext */}
      <p
        style={{
          fontSize: 17,
          color: "#555",
          maxWidth: 520,
          lineHeight: 1.65,
          marginBottom: 12,
        }}
      >
        We are the only one that proves you cannot.
      </p>
      <p
        style={{
          fontSize: 15,
          color: "#444",
          maxWidth: 480,
          lineHeight: 1.65,
          marginBottom: 44,
        }}
      >
        Describe your stack in plain English. An AI agent deploys it in under 60 seconds with LUKS-encrypted containers, per-provider EAS attestation, and x402 streaming micropayments. No central gatekeeper.
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 80 }}>
        <a
          href="http://localhost:3001"
          style={{
            background: "#fff",
            color: "#000",
            fontSize: 14,
            fontWeight: 600,
            padding: "10px 22px",
            borderRadius: 8,
            textDecoration: "none",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = "1")}
        >
          Launch App
        </a>
        <a
          href="https://github.com/Arnab-Afk/hackx"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#ccc",
            fontSize: 14,
            fontWeight: 500,
            padding: "10px 22px",
            borderRadius: 8,
            textDecoration: "none",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#fff" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "#ccc" }}
        >
          View on GitHub
        </a>
      </div>

      {/* Demo card */}
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          textAlign: "left",
        }}
      >
        {/* Card header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {["#ff5f57", "#ffbd2e", "#27c840"].map((c) => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
          ))}
          <span style={{ fontSize: 12, color: "#444", marginLeft: 8, fontFamily: "monospace" }}>comput3  agent</span>
        </div>

        {/* Messages */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {DEMO_LINES.map((line, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: line.role === "user"
                    ? "rgba(120,80,255,0.18)"
                    : line.role === "assistant"
                    ? "rgba(74,222,128,0.12)"
                    : "rgba(255,255,255,0.05)",
                  color: line.role === "user" ? "#a78bfa" : line.role === "assistant" ? "#4ade80" : "#555",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {line.role === "user" ? "you" : line.role === "assistant" ? "agent" : "sys"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: line.role === "system" ? "#444" : "#ccc",
                  lineHeight: 1.55,
                }}
              >
                {line.text}
                {i === DEMO_LINES.length - 1 && (
                  <span className="animate-blink" style={{ marginLeft: 2, opacity: 0.7 }}>▊</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
