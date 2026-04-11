"use client"

const ROTATING_A = ["DeFi dashboard", "hackathon project", "ML pipeline", "full-stack app", "AI agent backend"]
const ROTATING_B = ["60 seconds", "on-chain proof", "zero trust", "Base Sepolia", "encrypted storage"]

const USE_CASES = [
  {
    name: "DeFi Analytics",
    desc: "React + FastAPI + PostgreSQL. Agent provisions all three containers, configures internal networking, and attests the deployment.",
    icon: "📊",
    tag: "Finance",
  },
  {
    name: "Hackathon Infra",
    desc: "Organizers provide each team a private encrypted cloud environment. No team can see another's code — cryptographically guaranteed.",
    icon: "🏆",
    tag: "Events",
  },
  {
    name: "ML Training Run",
    desc: "Python + CUDA container with attached encrypted storage. Payment streams per-second via x402 — stop anytime.",
    icon: "🧠",
    tag: "AI / ML",
  },
  {
    name: "Web3 Backend",
    desc: "Node.js API + Redis + contract deployment scripts. Agent selects cheapest provider from ProviderRegistry.sol automatically.",
    icon: "⛓",
    tag: "Web3",
  },
  {
    name: "Privacy-Sensitive App",
    desc: "Healthcare or legal data processing. LUKS encryption ensures even the host operator cannot access patient or client data.",
    icon: "🔒",
    tag: "Compliance",
  },
  {
    name: "Rapid Prototype",
    desc: "No Docker knowledge required. Describe your stack in English, get a running environment with VS Code IDE in under a minute.",
    icon: "⚡",
    tag: "DevEx",
  },
]

export function PlatformOverview() {
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1180, margin: "0 auto" }}>
      {/* Animated headline */}
      <div style={{ marginBottom: 64 }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: 16 }}>
          Use Cases
        </p>
        <h2
          style={{
            fontSize: "clamp(30px, 4vw, 54px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#fff",
            lineHeight: 1.15,
          }}
        >
          Deploy your{" "}
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              height: "1.15em",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                animation: "wordSlide 12.5s steps(1) infinite",
                color: "rgba(255,255,255,0.35)",
                whiteSpace: "nowrap",
              }}
            >
              {ROTATING_A[0]}
            </span>
          </span>
          {" "}with{" "}
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              height: "1.15em",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                animation: "wordSlide 12.5s steps(1) infinite 0.2s",
                color: "rgba(255,255,255,0.35)",
                whiteSpace: "nowrap",
              }}
            >
              {ROTATING_B[0]}
            </span>
          </span>
          .
        </h2>
        <p style={{ fontSize: 15, color: "#444", maxWidth: 440, lineHeight: 1.6, marginTop: 16 }}>
          Any stack. Any workload. Verified on-chain. Operator-proof encryption. No trust required.
        </p>
      </div>

      {/* Use case cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 14,
        }}
      >
        {USE_CASES.map((t) => (
          <div
            key={t.name}
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14,
              padding: "28px 24px",
              cursor: "default",
              transition: "border-color 0.15s, background 0.15s",
              position: "relative",
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)"
              ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"
              ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                fontSize: 10,
                color: "#333",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 100,
                padding: "2px 9px",
                letterSpacing: "0.04em",
              }}
            >
              {t.tag}
            </div>

            <div style={{ fontSize: 28, marginBottom: 16 }}>{t.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#ccc", marginBottom: 8 }}>{t.name}</div>
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.65, margin: 0 }}>{t.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
