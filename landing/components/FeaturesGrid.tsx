const CODE_SAMPLE = `import comput3

client = comput3.Client(api_key="ck_live_...")

# Natural language deployment
job = await client.deploy("""
  React frontend, FastAPI backend with pandas,
  PostgreSQL 16, all connected on an internal network
""")

# Agent calls: generate_keypair, select_provider,
# create_container x3, install_packages x2,
# configure_network, setup_ide, attach_storage
# Every call is logged and attested on-chain

async for step in job.stream():
    print(step.tool, step.status)

# Verify the full action log
attestation = await job.get_attestation()
print(attestation.eas_uid)       # on Base Sepolia
print(attestation.merkle_root)   # recompute locally`

const STATS = [
  {
    label: "Deployment time",
    value: "< 60s",
    desc: "From natural language to running encrypted containers with access credentials",
  },
  {
    label: "Payment model",
    value: "x402",
    desc: "HTTP-native per-request micropayments. No central gatekeeper, no lock-in",
  },
  {
    label: "On-chain proof",
    value: "EAS",
    desc: "Per-provider attestation on Base Sepolia, signed by the provider wallet, not ours",
  },
  {
    label: "Data privacy",
    value: "LUKS",
    desc: "Filesystem encrypted with your key, generated in your browser, never sent to the server",
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
    <section
      id="features"
      style={{
        background: "#f5f5f5",
        padding: "100px 24px",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginBottom: 16 }}>
          Agentic Deployment SDK
        </p>

        <h2
          style={{
            fontSize: "clamp(30px, 4vw, 52px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#111",
            lineHeight: 1.1,
            maxWidth: 580,
            marginBottom: 12,
          }}
        >
          Describe your stack.<br />
          <span style={{ color: "rgba(0,0,0,0.45)" }}>The agent handles everything.</span>
        </h2>
        <p style={{ fontSize: 14, color: "#777", maxWidth: 480, lineHeight: 1.6, marginBottom: 40 }}>
          The agent uses Claude with a fixed set of constrained tools. No raw shell access. No filesystem access outside your mounted volume. Every call is logged and the merkle root is attested on-chain.
        </p>

        {/* Tool pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 40 }}>
          {TOOLS.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#777",
                background: "#ebebeb",
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "4px 10px",
              }}
            >
              {t}()
            </span>
          ))}
        </div>

        {/* Code block */}
        <div
          style={{
            background: "#ebebeb",
            border: "1px solid #ddd",
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
              borderBottom: "1px solid #ddd",
              padding: "0 20px",
              background: "#e5e5e5",
            }}
          >
            {["Python", "Node.js", "Go", "REST"].map((tab, i) => (
              <div
                key={tab}
                style={{
                  fontSize: 12,
                  color: i === 0 ? "#111" : "#aaa",
                  padding: "12px 16px",
                  borderBottom: i === 0 ? "1px solid #111" : "1px solid transparent",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {tab}
              </div>
            ))}
          </div>

          <pre
            style={{
              margin: 0,
              padding: "28px 28px",
              fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.75,
              color: "#666",
              overflowX: "auto",
            }}
          >
            <code>
              {CODE_SAMPLE.split("\n").map((line, i) => (
                <span key={i} style={{ display: "block" }}>
                  <span style={{ color: "#ccc", userSelect: "none", marginRight: 20, fontSize: 11 }}>
                    {String(i + 1).padStart(2, " ")}
                  </span>
                  <span style={{
                    color: line.trimStart().startsWith("#") ? "#bbb"
                      : line.includes("await") || line.includes("async") || line.includes("import") || line.includes("print") ? "#444"
                      : line.includes('"""') ? "#888"
                      : "#555"
                  }}>
                    {line}
                  </span>
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        </div>

        {/* Stat cards */}
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
                background: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: "24px 24px",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(26px, 3.5vw, 38px)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#111",
                  marginBottom: 6,
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.55 }}>
                <span style={{ color: "#555", display: "block", marginBottom: 3 }}>{s.label}</span>
                {s.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
