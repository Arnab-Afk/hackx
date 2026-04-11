const CODE_SAMPLE = `import zkloud

client = zkloud.Client(api_key="zk_live_...")

# Natural language deployment
job = await client.deploy("""
  React frontend, FastAPI backend with pandas,
  PostgreSQL 16 — all connected internally
""")

# Agent runs: generate_keypair, select_provider,
# create_container ×3, install_packages ×2,
# configure_network, setup_ide, attach_storage

# Every action is logged and attested on-chain
async for step in job.stream():
    print(step.tool, "→", step.status)

# Verify nothing extra ran
attestation = await job.get_attestation()
print(attestation.eas_uid)   # on Base Sepolia
print(attestation.merkle_root)  # recompute locally`

const STATS = [
  {
    label: "Deployment time",
    value: "< 60s",
    desc: "From natural language description to running encrypted containers",
  },
  {
    label: "Payment model",
    value: "x402",
    desc: "HTTP-native per-request micropayments — no central gatekeeper",
  },
  {
    label: "On-chain proof",
    value: "EAS",
    desc: "Per-provider EAS attestation on Base Sepolia — signed by the provider, not us",
  },
  {
    label: "Data privacy",
    value: "LUKS",
    desc: "Filesystem encrypted with your key. Even the host operator cannot read inside",
  },
]

const TOOLS = [
  "analyze_repo",
  "select_provider",
  "create_container",
  "install_packages",
  "configure_network",
  "attach_storage",
  "setup_ide",
  "setup_database",
  "generate_keypair",
  "health_check",
  "get_logs",
  "destroy_container",
]

export function FeaturesGrid() {
  return (
    <section id="features" style={{ padding: "100px 24px", maxWidth: 1180, margin: "0 auto" }}>
      {/* Section label */}
      <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#555", marginBottom: 16 }}>
        Agentic Deployment SDK
      </p>

      {/* Headline */}
      <h2
        style={{
          fontSize: "clamp(30px, 4vw, 52px)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#fff",
          lineHeight: 1.1,
          maxWidth: 580,
          marginBottom: 12,
        }}
      >
        Describe your stack.<br />
        <span style={{ color: "rgba(255,255,255,0.3)" }}>The agent handles everything.</span>
      </h2>
      <p style={{ fontSize: 14, color: "#444", maxWidth: 480, lineHeight: 1.6, marginBottom: 48 }}>
        The agent uses Claude with a fixed set of constrained tools. It can never run arbitrary shell commands. Every call is logged — and the merkle root of that log is attested on-chain.
      </p>

      {/* Tool pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 40 }}>
        {TOOLS.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: "#555",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 6,
              padding: "4px 10px",
              letterSpacing: "0.01em",
            }}
          >
            {t}()
          </span>
        ))}
      </div>

      {/* Code block */}
      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "0 20px",
          }}
        >
          {["Python", "Node.js", "Go", "REST"].map((tab, i) => (
            <div
              key={tab}
              style={{
                fontSize: 12,
                color: i === 0 ? "#fff" : "#444",
                padding: "12px 16px",
                borderBottom: i === 0 ? "1px solid #fff" : "1px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Code */}
        <pre
          style={{
            margin: 0,
            padding: "28px 28px",
            fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: 13,
            lineHeight: 1.75,
            color: "#777",
            overflowX: "auto",
          }}
        >
          <code>
            {CODE_SAMPLE.split("\n").map((line, i) => (
              <span key={i} style={{ display: "block" }}>
                <span style={{ color: "#2a2a2a", userSelect: "none", marginRight: 20, fontSize: 11 }}>
                  {String(i + 1).padStart(2, " ")}
                </span>
                <span style={{
                  color: line.trimStart().startsWith("#") ? "#3a3a3a"
                    : line.includes("await") || line.includes("async") || line.includes("import") || line.includes("print") ? "#aaa"
                    : line.includes('"""') ? "#666"
                    : "#777"
                }}>
                  {line}
                </span>
                {"\n"}
              </span>
            ))}
          </code>
        </pre>
      </div>

      {/* Stat cards 2×2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {STATS.map((s) => (
          <div
            key={s.label}
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "24px 24px",
            }}
          >
            <div
              style={{
                fontSize: "clamp(26px, 3.5vw, 38px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#fff",
                marginBottom: 6,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.55 }}>
              <span style={{ color: "#888", display: "block", marginBottom: 3 }}>{s.label}</span>
              {s.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
