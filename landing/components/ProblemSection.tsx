import { AlertTriangle, Eye, CreditCard, ShieldOff } from "lucide-react"

const problems = [
  {
    icon: AlertTriangle,
    title: "Unverifiable Providers",
    desc: "You have no proof your code ran on the hardware you paid for. Traditional cloud is a black box — trust us, bro.",
    tag: "No Proof",
    accent: "text-red-400",
    iconBg: "bg-red-500/10 border-red-500/20",
  },
  {
    icon: Eye,
    title: "Opaque Execution",
    desc: "No on-chain record of what was deployed, when, or how. When an audit hits, there's nothing cryptographic to show.",
    tag: "Zero Observability",
    accent: "text-orange-400",
    iconBg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    icon: CreditCard,
    title: "No Payment Guarantees",
    desc: "Providers can exit with your funds. Clients can refuse to pay after work is done. No arbiter. No trail.",
    tag: "Custodial Risk",
    accent: "text-yellow-400",
    iconBg: "bg-yellow-500/10 border-yellow-500/20",
  },
  {
    icon: ShieldOff,
    title: "Zero Accountability",
    desc: "When something goes wrong, there's no cryptographic trail for auditing. Bad actors face zero on-chain consequences.",
    tag: "No Slashing",
    accent: "text-red-400",
    iconBg: "bg-red-500/10 border-red-500/20",
  },
]

export function ProblemSection() {
  return (
    <section className="py-24 px-6" id="how-it-works">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4">
          <span className="text-xs text-violet-400 font-medium uppercase tracking-widest">
            The Problem
          </span>
        </div>
        <h2 className="text-center text-4xl sm:text-5xl font-bold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Your compute infrastructure
          <br />
          <span className="text-zinc-500">has no proof.</span>
        </h2>
        <p className="text-center text-zinc-400 mt-5 max-w-xl mx-auto leading-relaxed">
          The tools your team uses are unverifiable, un-auditable, and fully
          custodial. It doesn&apos;t have to be this way.
        </p>

        <div className="mt-16 grid sm:grid-cols-2 gap-4">
          {problems.map(({ icon: Icon, title, desc, tag, accent, iconBg }) => (
            <div
              key={title}
              className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-5">
                <div
                  className={`w-10 h-10 rounded-xl ${iconBg} border flex items-center justify-center`}
                >
                  <Icon size={18} className={accent} />
                </div>
                <span className="text-xs bg-zinc-800 text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Solution nudge */}
        <div className="mt-10 flex justify-center">
          <div className="flex items-center gap-2 bg-violet-950/40 border border-violet-500/20 rounded-full px-5 py-2 text-sm text-violet-300">
            <span className="font-semibold">Solution</span>
            <span className="text-violet-500">→</span>
            <span>Cryptographic proof. On-chain payment. EAS attestation.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
