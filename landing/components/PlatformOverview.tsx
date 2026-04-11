"use client"

const USE_CASES = [
  {
    tag: "Finance",
    name: "DeFi Analytics",
    desc: "React, FastAPI, and PostgreSQL. Agent provisions three containers, configures internal networking, and submits an EAS attestation for the full deployment.",
  },
  {
    tag: "Events",
    name: "Hackathon Infrastructure",
    desc: "Each team receives a private encrypted environment. No team can read another's code. Cryptographically guaranteed, not just policy.",
  },
  {
    tag: "AI / ML",
    name: "Model Training",
    desc: "Python and CUDA container with attached encrypted storage. Payments stream per-second via x402. Stop anytime and pay only what you used.",
  },
  {
    tag: "Web3",
    name: "Smart Contract Backend",
    desc: "Node.js API with Redis and deployment scripts. The agent selects the cheapest available provider from ProviderRegistry.sol automatically.",
  },
  {
    tag: "Compliance",
    name: "Privacy-Sensitive Workload",
    desc: "Healthcare or legal data processing. LUKS encryption ensures the host operator cannot access patient or client data under any circumstances.",
  },
  {
    tag: "DevEx",
    name: "Rapid Prototype",
    desc: "No Docker knowledge required. Describe your stack in plain English, receive a running environment with a web IDE in under sixty seconds.",
  },
]

// Duplicate for seamless infinite loop (marquee scrolls -50%)
const DOUBLED = [...USE_CASES, ...USE_CASES]

export function PlatformOverview() {
  return (
    <section style={{ background: "#030303", padding: "100px 0 110px" }}>
      {/* Heading block */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", marginBottom: 56 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#555",
            marginBottom: 18,
          }}
        >
          Use Cases
        </p>
        <h2
          style={{
            fontSize: "clamp(30px, 4vw, 54px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          Deploy any workload.
          <br />
          <span style={{ color: "rgba(255,255,255,0.28)" }}>Any stack. In seconds.</span>
        </h2>
        <p style={{ fontSize: 15, color: "#666", maxWidth: 400, lineHeight: 1.65 }}>
          Verified on-chain. Operator-proof encryption. No trust required.
        </p>
      </div>

      {/* Infinite marquee strip */}
      <div
        style={{
          overflow: "hidden",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            width: "max-content",
            animation: "marquee 38s linear infinite",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.animationPlayState = "paused")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.animationPlayState = "running")
          }
        >
          {DOUBLED.map((t, i) => (
            <div
              key={i}
              style={{
                width: 300,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "28px 24px 26px",
                flexShrink: 0,
                position: "relative",
              }}
            >
              {/* Tag pill */}
              <div
                style={{
                  position: "absolute",
                  top: 18,
                  right: 18,
                  fontSize: 10,
                  color: "#666",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 100,
                  padding: "2px 9px",
                  letterSpacing: "0.05em",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {t.tag}
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#e8e8e8",
                  marginBottom: 10,
                  lineHeight: 1.3,
                  paddingRight: 60,
                }}
              >
                {t.name}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: "#777",
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
