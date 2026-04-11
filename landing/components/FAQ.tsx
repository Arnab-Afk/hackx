"use client"

import { useState } from "react"

const FAQS = [
  {
    q: "What is COMPUT3?",
    a: "COMPUT3 is a trustless cloud infrastructure platform where developers deploy full-stack environments using natural language, with cryptographic proof that nobody including us can access their code or data.",
  },
  {
    q: "How is this different from AWS or GCP?",
    a: "AWS asks you to trust them. COMPUT3 proves trustlessness with on-chain attestations signed by the provider that ran your workload. You also deploy by describing your stack in plain English instead of configuring infrastructure manually.",
  },
  {
    q: "How do you guarantee you cannot see my data?",
    a: "Your container filesystem is encrypted with LUKS2. The encryption key is derived from your keypair, which is generated in your browser and never sent to our server. We physically cannot decrypt your volume. This is proven on-chain via a key derivation attestation.",
  },
  {
    q: "What if the agent does something unexpected?",
    a: "Every action the agent takes is logged in a signed action log. The merkle root of this log is attested on-chain. You can download the full log, recompute the root, and verify it matches the on-chain value. The agent also operates under strict constraints with no raw shell access and no filesystem access outside your mounted volume.",
  },
  {
    q: "What blockchain does COMPUT3 use?",
    a: "We deploy on Base, an Ethereum L2, for low gas costs and fast finality. Attestations cost fractions of a cent. The ProviderRegistry.sol contract handles provider registration and USDC staking.",
  },
  {
    q: "Can anyone run a compute provider node?",
    a: "Yes. Any server owner can join the network by running setup-provider.sh and staking USDC in ProviderRegistry.sol on Base Sepolia. No central approval is needed. The agent automatically routes deployments to the best available provider based on on-chain data.",
  },
  {
    q: "What happens if a provider node goes down?",
    a: "Your data is encrypted on disk on that node and persists across reboots. Attestations are permanent on-chain. The provider registry shows each node status and the agent can redeploy your workload to a different available provider.",
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section style={{ background: "#f5f5f5", padding: "100px 24px" }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 80,
          alignItems: "start",
        }}
      >
        {/* Left sticky header */}
        <div style={{ position: "sticky", top: 88 }}>
          <h2
            style={{
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#111",
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            Frequently Asked Questions
          </h2>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>
            More questions?{" "}
            <a
              href="https://github.com/Arnab-Afk/hackx"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#555", textDecoration: "underline" }}
            >
              Open an issue on GitHub
            </a>
            .
          </p>
        </div>

        {/* Accordion */}
        <div>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{ borderBottom: "1px solid #e0e0e0" }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  padding: "22px 0",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: "#222", lineHeight: 1.4 }}>
                  {faq.q}
                </span>
                <span
                  style={{
                    fontSize: 20,
                    color: open === i ? "#111" : "#aaa",
                    flexShrink: 0,
                    width: 20,
                    textAlign: "center",
                    transition: "color 0.15s",
                    fontWeight: 300,
                  }}
                >
                  {open === i ? "×" : "+"}
                </span>
              </button>
              {open === i && (
                <p
                  style={{
                    fontSize: 14,
                    color: "#666",
                    lineHeight: 1.75,
                    paddingBottom: 22,
                    margin: 0,
                    maxWidth: 600,
                  }}
                >
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
