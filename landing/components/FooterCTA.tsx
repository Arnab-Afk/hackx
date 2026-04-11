import { ArrowRight } from "lucide-react"
import { Wordmark } from "./Wordmark"

export function FooterCTA() {
  return (
    <section className="py-28 px-6 border-t border-zinc-800/60 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[350px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <Wordmark />

        <h2 className="text-4xl sm:text-5xl font-bold text-white mt-8 leading-tight">
          Your agents deserve
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-purple-500 bg-clip-text text-transparent">
            trustless infrastructure.
          </span>
        </h2>

        <p className="mt-6 text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
          Paste a GitHub URL. Get verified, encrypted containers running on a
          decentralized compute network — attested on-chain in minutes.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="http://localhost:3001"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3.5 rounded-full transition-colors text-sm"
          >
            Paste a repo URL <ArrowRight size={16} />
          </a>

          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live on Base Sepolia
            </span>
            <span>·</span>
            <span>EAS Attested</span>
            <span>·</span>
            <span>Open source</span>
          </div>
        </div>
      </div>
    </section>
  )
}
