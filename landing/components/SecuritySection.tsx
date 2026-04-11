const items = [
  {
    n: "01",
    emoji: "🔐",
    title: "Every Container Encrypted",
    desc: "LUKS full-disk encryption with a per-session key, rotated on each deployment. Provider nodes never access plaintext data — keys are ephemeral.",
  },
  {
    n: "02",
    emoji: "⛓",
    title: "Every Payment On-Chain",
    desc: "Funds are locked in DeploymentEscrow before provisioning begins. Streaming release at the agreed ratePerSecond — no custodians, no escrow companies.",
  },
  {
    n: "03",
    emoji: "✅",
    title: "Every Execution Attested",
    desc: "An EAS attestation is submitted by the provider's own wallet after session completion — cryptographically bound to that node, not to COMPUT3.",
  },
  {
    n: "04",
    emoji: "⚖️",
    title: "Every Provider Accountable",
    desc: "ProviderRegistry tracks slashCount and jobsCompleted on-chain. Bad actors are slashed automatically. Reputation is public and immutable.",
  },
]

export function SecuritySection() {
  return (
    <section className="py-24 px-6 bg-zinc-950/50 border-t border-zinc-800/60">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left — sticky heading */}
          <div className="lg:sticky lg:top-28">
            <span className="text-xs text-violet-400 font-medium uppercase tracking-widest">
              Security
            </span>
            <h2 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              <span className="text-white">Enterprise-Grade</span>
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-500 bg-clip-text text-transparent">
                Security for AI Compute
              </span>
            </h2>
            <p className="mt-5 text-zinc-400 leading-relaxed max-w-sm">
              COMPUT3 brings zero-trust security standards to AI infrastructure.
              Every layer is cryptographically verifiable — no exceptions.
            </p>
            {/* Glow ornament */}
            <div className="mt-10 w-40 h-40 rounded-full bg-violet-600/15 blur-[60px] pointer-events-none" />
          </div>

          {/* Right — numbered list */}
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.n}
                className="group flex gap-5 p-5 rounded-2xl hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800 transition-all duration-200"
              >
                <div className="shrink-0 w-8 pt-0.5">
                  <span className="text-xs font-mono text-zinc-600 group-hover:text-violet-400 transition-colors">
                    {item.n}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1.5 flex items-center gap-2">
                    <span>{item.emoji}</span>
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
