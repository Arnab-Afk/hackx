const PLATFORMS = ["AWS / GCP", "Replit Agent", "Fluence", "Phala", "Akash", "COMPUT3"]

type CellValue = "Yes" | "No" | "Partial" | "Roadmap" | "Full"

const FEATURES: {
  label: string
  desc: string
  values: Record<string, { v: CellValue; note?: string }>
}[] = [
  {
    label: "Agentic Deployment",
    desc: "Natural language to running infrastructure",
    values: {
      "AWS / GCP":    { v: "No",      note: "Manual CLI and console configuration" },
      "Replit Agent": { v: "Yes",     note: "Conversational but fully trust-based" },
      "Fluence":      { v: "No",      note: "Requires DevOps knowledge" },
      "Phala":        { v: "No",      note: "SDK-based, no natural language interface" },
      "Akash":        { v: "No",      note: "CLI marketplace only" },
      "COMPUT3":      { v: "Yes",     note: "Claude with constrained tool set" },
    },
  },
  {
    label: "Confidential Compute",
    desc: "Operator cannot read your data",
    values: {
      "AWS / GCP":    { v: "No",      note: "Trust-based operator access" },
      "Replit Agent": { v: "No",      note: "Replit reads all project files" },
      "Fluence":      { v: "Roadmap", note: "TEE listed as R&D exploration only" },
      "Phala":        { v: "Partial", note: "TEE for specific workload types" },
      "Akash":        { v: "No",      note: "No confidentiality guarantees" },
      "COMPUT3":      { v: "Yes",     note: "LUKS per-container, key never leaves browser" },
    },
  },
  {
    label: "On-Chain Attestation",
    desc: "Cryptographic proof of what the agent ran",
    values: {
      "AWS / GCP":    { v: "No",      note: "" },
      "Replit Agent": { v: "No",      note: "" },
      "Fluence":      { v: "No",      note: "Billing SLAs only" },
      "Phala":        { v: "Partial", note: "Compute proofs, not full action logs" },
      "Akash":        { v: "No",      note: "SLAs only" },
      "COMPUT3":      { v: "Full",    note: "Per-provider EAS, merkle action log on Base" },
    },
  },
  {
    label: "Open Provider Network",
    desc: "Anyone can join as a compute provider",
    values: {
      "AWS / GCP":    { v: "No",      note: "Closed and centralized" },
      "Replit Agent": { v: "No",      note: "Centralized infrastructure" },
      "Fluence":      { v: "Yes",     note: "Token-gated marketplace" },
      "Phala":        { v: "Partial", note: "TEE hardware requirement" },
      "Akash":        { v: "Yes",     note: "Open marketplace" },
      "COMPUT3":      { v: "Yes",     note: "Stake USDC in ProviderRegistry.sol" },
    },
  },
]

const VALUE_STYLE: Record<CellValue, { color: string; bg?: string }> = {
  Yes:     { color: "#4ade80" },
  Full:    { color: "#4ade80" },
  No:      { color: "#444" },
  Partial: { color: "#f59e0b" },
  Roadmap: { color: "#f59e0b" },
}

export function Testimonials() {
  return (
    <section
      id="providers"
      style={{ background: "#f5f5f5", padding: "100px 24px" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: 16 }}>
          Competitive Landscape
        </p>

        <h2
          style={{
            fontSize: "clamp(28px, 4vw, 52px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#111",
            lineHeight: 1.1,
            marginBottom: 12,
          }}
        >
          Nobody else does<br />
          <span style={{ color: "rgba(0,0,0,0.45)" }}>all four.</span>
        </h2>
        <p style={{ fontSize: 15, color: "#777", maxWidth: 480, lineHeight: 1.6, marginBottom: 48 }}>
          Every competitor is missing at least one of: agentic deployment, verifiable confidentiality, per-provider on-chain attestation, or an open permissionless provider network.
        </p>

        {/* Scrollable table wrapper */}
        <div style={{ overflowX: "auto", borderRadius: 14, border: "1px solid #e0e0e0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            {/* Column headers */}
            <thead>
              <tr>
                <th
                  style={{
                    padding: "16px 20px",
                    textAlign: "left",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#aaa",
                    background: "#ebebeb",
                    borderBottom: "1px solid #e0e0e0",
                    fontWeight: 500,
                    minWidth: 200,
                  }}
                >
                  Feature
                </th>
                {PLATFORMS.map((p) => {
                  const isOurs = p === "COMPUT3"
                  return (
                    <th
                      key={p}
                      style={{
                        padding: "16px 20px",
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: isOurs ? "#fff" : "#666",
                        background: isOurs ? "#111" : "#ebebeb",
                        borderBottom: "1px solid #e0e0e0",
                        borderLeft: "1px solid #e0e0e0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p}
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {FEATURES.map((f, fi) => (
                <tr key={f.label}>
                  {/* Feature label */}
                  <td
                    style={{
                      padding: "20px 20px",
                      borderBottom: fi < FEATURES.length - 1 ? "1px solid #e8e8e8" : "none",
                      background: "#fff",
                      verticalAlign: "top",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>{f.desc}</div>
                  </td>

                  {/* Platform cells */}
                  {PLATFORMS.map((p) => {
                    const isOurs = p === "COMPUT3"
                    const cell = f.values[p]
                    const vstyle = VALUE_STYLE[cell.v]
                    return (
                      <td
                        key={p}
                        style={{
                          padding: "20px 16px",
                          textAlign: "center",
                          borderBottom: fi < FEATURES.length - 1 ? "1px solid #e8e8e8" : "none",
                          borderLeft: "1px solid #e8e8e8",
                          background: isOurs ? "#1a1a1a" : "#fff",
                          verticalAlign: "top",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isOurs ? (vstyle.color) : vstyle.color,
                            marginBottom: cell.note ? 4 : 0,
                          }}
                        >
                          {cell.v}
                        </div>
                        {cell.note && (
                          <div
                            style={{
                              fontSize: 11,
                              color: isOurs ? "#555" : "#bbb",
                              lineHeight: 1.4,
                            }}
                          >
                            {cell.note}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: "#bbb", marginTop: 16 }}>
          COMPUT3 is the only platform combining all four properties.
        </p>
      </div>
    </section>
  )
}
