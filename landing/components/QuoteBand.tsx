const quotes = [
  {
    text: "COMPUT3 turns my idle server into a revenue-generating compute node. The on-chain stake model means I never worry about getting stiffed — payment is locked in escrow before work starts.",
    name: "Alex Chen",
    title: "Provider Node Operator",
    badge: "Node #7",
  },
  {
    text: "I pasted a GitHub URL and had verified, attested containers running in under 3 minutes. No AWS account, no billing dashboard, no trust required.",
    name: "Maria Santos",
    title: "Web3 Developer",
    badge: "Base Sepolia",
  },
]

export function QuoteBand() {
  return (
    <section className="border-y border-zinc-800/60 bg-zinc-950/50 py-12 px-6">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
        {quotes.map((q) => (
          <div key={q.name} className="flex flex-col gap-5">
            <p className="text-base text-zinc-300 leading-relaxed italic">
              &ldquo;{q.text}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-300 shrink-0">
                {q.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{q.name}</p>
                <p className="text-xs text-zinc-500">{q.title}</p>
              </div>
              <span className="ml-auto text-xs bg-zinc-900 border border-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full shrink-0">
                {q.badge}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
