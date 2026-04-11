const COMPETITORS = [
  {
    name: "AWS / GCP / Azure",
    verdict: "trust-based",
    missing: ["No confidential compute", "No on-chain attestation", "Manual infrastructure config"],
    note: "They ask you to trust them. There is no way to verify what runs.",
  },
  {
    name: "Replit Agent",
    verdict: "no privacy",
    missing: ["Centralized", "Replit can see everything", "No action log or attestation"],
    note: "Great agentic UX — but trust-based. They can read every file in your project.",
  },
  {
    name: "Fluence",
    verdict: "no agentic UX",
    missing: ["No confidential compute (R&D roadmap only)", "Requires DevOps knowledge", "Targets enterprise AI, not prototyping"],
    note: "Decentralized AWS — general-purpose marketplace. Missing the agentic and privacy layers.",
  },
  {
    name: "Phala Network",
    verdict: "no agentic UX",
    missing: ["TEE-based, not general purpose", "Requires learning their SDK", "No natural language deployment"],
    note: "Closest in privacy, but no conversational interface and targets specific compute types.",
  },
  {
    name: "Akash Network",
    verdict: "no privacy",
    missing: ["Zero confidentiality guarantees", "Cheapest-price-wins marketplace", "No attestation"],
    note: "Pure compute marketplace. Even Akash-sponsored hackathons leave teams with no IP protection.",
  },
]

export function Testimonials() {
  return (
    <section
      id="providers"
      style={{ padding: "100px 24px", maxWidth: 1180, margin: "0 auto" }}
    >
      <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: 16 }}>
        Competitive Landscape
      </p>

      <h2
        style={{
          fontSize: "clamp(28px, 4vw, 52px)",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          color: "#fff",
          lineHeight: 1.1,
          marginBottom: 12,
        }}
      >
        Nobody else does<br />
        <span style={{ color: "rgba(255,255,255,0.3)" }}>all four.</span>
      </h2>
      <p style={{ fontSize: 15, color: "#444", maxWidth: 500, lineHeight: 1.6, marginBottom: 16 }}>
        Every competitor is missing at least one of: agentic deployment, verifiable confidentiality, per-provider on-chain attestation, or an open permissionless network.
      </p>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginBottom: 48, flexWrap: "wrap" }}>
        {[
          { label: "Agentic UX", col: "#fff" },
          { label: "Confidential Compute", col: "#fff" },
          { label: "On-Chain Attestation", col: "#fff" },
          { label: "Open Provider Network", col: "#fff" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#444" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Comparison cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr auto",
            padding: "14px 24px",
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span style={{ fontSize: 11, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Platform</span>
          <span style={{ fontSize: 11, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>What&apos;s missing</span>
          <span style={{ fontSize: 11, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em" }}>Verdict</span>
        </div>

        {COMPETITORS.map((c, i) => (
          <div
            key={c.name}
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr auto",
              padding: "20px 24px",
              gap: 20,
              borderBottom: i < COMPETITORS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              alignItems: "start",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#888", marginBottom: 4 }}>{c.name}</div>
            </div>
            <div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {c.missing.map((m) => (
                  <li key={m} style={{ fontSize: 13, color: "#3a3a3a", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#2a2a2a" }}>✕</span> {m}
                  </li>
                ))}
              </ul>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#333", lineHeight: 1.5 }}>{c.note}</p>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#444",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 100,
                padding: "3px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {c.verdict}
            </div>
          </div>
        ))}

        {/* Zkloud row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr auto",
            padding: "20px 24px",
            gap: 20,
            background: "rgba(255,255,255,0.03)",
            alignItems: "start",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Zkloud</div>
          </div>
          <div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                "Agentic deployment via constrained Claude tools",
                "LUKS encryption — operator literally cannot decrypt",
                "Per-provider EAS attestation on Base Sepolia",
                "Permissionless provider network via ProviderRegistry.sol",
              ].map((m) => (
                <li key={m} style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#4ade80" }}>✓</span> {m}
                </li>
              ))}
            </ul>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#4ade80",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 100,
              padding: "3px 10px",
              whiteSpace: "nowrap",
            }}
          >
            all four ✓
          </div>
        </div>
      </div>
    </section>
  )
}
