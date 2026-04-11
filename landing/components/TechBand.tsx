const INPUTS: { top: string; bot: string }[] = [
  { top: "AI Agent", bot: "any client" },
  { top: "Claude", bot: "Anthropic" },
  { top: "Python SDK", bot: "3.10+" },
  { top: "REST API", bot: "HTTP/2" },
  { top: "CLI", bot: "terminal" },
  { top: "Web UI", bot: "browser" },
]

const OUTPUTS: { top: string; bot: string }[] = [
  { top: "Docker", bot: "runtime" },
  { top: "LUKS2", bot: "encrypted" },
  { top: "Base L2", bot: "Ethereum" },
  { top: "EAS", bot: "attestation" },
  { top: "x402", bot: "payments" },
  { top: "gVisor", bot: "sandbox" },
]

function Tile({ top, bot }: { top: string; bot: string }) {
  return (
    <div
      style={{
        width: 82,
        height: 90,
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        flexShrink: 0,
        padding: "0 8px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#999",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {top}
      </div>
      <div style={{ fontSize: 10, color: "#666", textAlign: "center" }}>{bot}</div>
    </div>
  )
}

export function TechBand() {
  return (
    <section
      style={{
        background: "#030303",
        padding: "100px 0",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 24px",
          textAlign: "center",
          marginBottom: 56,
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#444",
            marginBottom: 18,
          }}
        >
          Ecosystem
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 3.5vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            color: "#fff",
            lineHeight: 1.1,
            marginBottom: 14,
          }}
        >
          Connect any agent
          <br />
          <span style={{ color: "rgba(255,255,255,0.25)" }}>to any verified provider.</span>
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#777",
            maxWidth: 440,
            margin: "0 auto",
            lineHeight: 1.7,
          }}
        >
          COMPUT3 sits between AI agents and compute infrastructure, handling payments, encryption, and attestation transparently.
        </p>
      </div>

      {/* Icon row with left/right fade edges */}
      <div
        style={{
          position: "relative",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "16px 48px",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          {/* Input tiles */}
          {INPUTS.map((t) => (
            <Tile key={t.top} top={t.top} bot={t.bot} />
          ))}

          {/* COMPUT3 center tile — violet glow like Runlayer's hub */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              background: "#0b0b0b",
              border: "1px solid rgba(120,80,255,0.65)",
              boxShadow:
                "0 0 28px rgba(120,80,255,0.4), 0 0 72px rgba(120,80,255,0.15), inset 0 0 20px rgba(120,80,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              zIndex: 1,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.01em",
                userSelect: "none",
              }}
            >
              COMPUT
              <span style={{ display: "inline-block", transform: "scaleX(-1)" }}>E</span>
            </span>
          </div>

          {/* Output tiles */}
          {OUTPUTS.map((t) => (
            <Tile key={t.top} top={t.top} bot={t.bot} />
          ))}
        </div>
      </div>

      {/* Stat row */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 48,
          marginTop: 56,
          padding: "0 24px",
          flexWrap: "wrap",
        }}
      >
        {[
          { n: "3", label: "active providers" },
          { n: "< 60s", label: "average deploy" },
          { n: "1 tx", label: "per attestation" },
          { n: "0.01 USDC", label: "compute per minute" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "clamp(22px, 2.5vw, 32px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {s.n}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
