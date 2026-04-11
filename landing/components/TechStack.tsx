const tech = [
  { name: "Base Sepolia", category: "Chain" },
  { name: "Ethereum", category: "Chain" },
  { name: "Docker", category: "Compute" },
  { name: "Claude", category: "AI" },
  { name: "EAS", category: "Attestation" },
  { name: "OpenZeppelin", category: "Contracts" },
  { name: "Hardhat", category: "Tooling" },
  { name: "LUKS", category: "Encryption" },
  { name: "wagmi", category: "Frontend" },
  { name: "ethers.js", category: "SDK" },
  { name: "Go", category: "Backend" },
  { name: "PostgreSQL", category: "Database" },
]

export function TechStack() {
  return (
    <section className="py-20 px-6 border-t border-zinc-800/60">
      <div className="max-w-7xl mx-auto text-center">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">
          Natively integrates with your stack
        </span>
        <h2 className="mt-3 text-3xl font-bold text-white">
          Built on battle-tested infrastructure
        </h2>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {tech.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-full px-4 py-2.5 transition-colors group cursor-default"
            >
              <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">
                {t.name}
              </span>
              <span className="text-xs text-zinc-600 group-hover:text-zinc-500 transition-colors">
                {t.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
