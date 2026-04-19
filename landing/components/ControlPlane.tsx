const MARQUEE_ITEMS = [
  "Confidential Containers",
  "Agentic Deployment",
  "On-Chain Attestation",
  "LUKS Encryption",
  "EAS on Base Sepolia",
  "x402 Micropayments",
  "ProviderRegistry.sol",
  "Permissionless Network",
  "gVisor Sandboxing",
  "Merkle Action Log",
  "Claude Function Calling",
  "Zero Root Access",
]

const PILLARS = [
  {
    index: "01",
    title: "Confidential Containers",
    desc: "Every container runs with LUKS2 filesystem encryption. The key is derived from your keypair, generated in-browser, never sent to the server. Even with root access on the host machine, the operator cannot read your data.",
  },
  {
    index: "02",
    title: "Agentic Deployment",
    desc: "Describe your stack in plain English. The agent calls a constrained set of tools with no raw shell access and no filesystem access outside your mounted volumes. It cannot do anything you did not ask for.",
  },
  {
    index: "03",
    title: "On-Chain Verification",
    desc: "Every tool call is appended to an immutable action log. The merkle root of all action hashes is attested on-chain via EAS, signed by the provider wallet, not ours. Recompute the root yourself to verify nothing extra ran.",
  },
]

export function ControlPlane() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

  return (
    <section
      id="how-it-works"
      style={{
        background: "#030303",
        padding: "100px 0",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", marginBottom: 64 }}>
        {/* Label */}
        <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: 16 }}>
          Three Pillars
        </p>

        {/* Headline */}
        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 52px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#fff",
            lineHeight: 1.1,
            maxWidth: 640,
            marginBottom: 16,
          }}
        >
          Trust is not assumed.<br />
          <span style={{ color: "rgba(255,255,255,0.3)" }}>It is proven.</span>
        </h2>
        <p style={{ fontSize: 15, color: "#888", maxWidth: 480, lineHeight: 1.6, marginBottom: 48 }}>
          Zkloud combines three properties no existing platform has together: agentic UX, verifiable confidentiality, and per-provider on-chain attestation.
        </p>

        {/* Pillars */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 1,
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {PILLARS.map((p) => (
            <div
              key={p.index}
              style={{
                padding: "32px 28px",
                borderRight: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.015)",
              }}
            >
              <div style={{ fontSize: 11, color: "#555", fontFamily: "monospace", marginBottom: 14, letterSpacing: "0.04em" }}>
                {p.index}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#ccc", marginBottom: 10 }}>
                {p.title}
              </div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, margin: 0 }}>
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
          <a
            href="https://app.comput3.xyz"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#000",
              background: "#fff",
              padding: "8px 18px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Deploy Now
          </a>
          <a
            href="https://github.com/Arnab-Afk/hackx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: "#555",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "8px 18px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Read Architecture
          </a>
        </div>
      </div>

      {/* Marquee */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            animation: "marquee 36s linear infinite",
            width: "max-content",
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 13,
                color: "#444",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
