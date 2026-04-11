"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"

const faqs = [
  {
    q: "What chains does COMPUT3 support?",
    a: "COMPUT3 uses Base Sepolia testnet for all smart contract operations — payments, attestations, and provider registry. Compute nodes run on any Linux server worldwide; only the proof layer is on-chain.",
  },
  {
    q: "How does the streaming payment work?",
    a: "When a session starts, 20% of the deposit goes to the provider upfront via DeploymentEscrow.startSession(). The remaining 80% is held in the contract and released per second at the agreed ratePerSecond. You can stop the session any time to reclaim unused funds.",
  },
  {
    q: "Who can run a provider node?",
    a: "Anyone with a Linux server and Docker installed. Run setup-provider.sh, fund your wallet with at least 0.01 ETH, and call ProviderRegistry.stake(). Once active, your node appears in the provider marketplace and the agent can route jobs to it.",
  },
  {
    q: "Is my code private on the provider node?",
    a: "Yes. Every container filesystem is encrypted with a per-session LUKS key generated at session start. The key is rotated on each deployment and never persisted on the provider node after the session ends.",
  },
  {
    q: "What happens if a provider misbehaves?",
    a: "The DeploymentEscrow contract includes a slashProvider() function callable by the proof authority. It refunds the user's remaining balance and calls ProviderRegistry.slash() on-chain — permanently recording the violation and reducing the provider's stake.",
  },
  {
    q: "Do I need a crypto wallet to deploy?",
    a: "Yes, a Base Sepolia wallet is required to fund the escrow. For testing, grab free testnet ETH from the Base Sepolia faucet. Connect with any EIP-1193 wallet (MetaMask, Coinbase Wallet, etc.) via the frontend.",
  },
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-24 px-6 border-t border-zinc-800/60">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <span className="text-xs text-violet-400 font-medium uppercase tracking-widest">
            FAQ
          </span>
        </div>
        <h2 className="text-center text-4xl font-bold text-white mb-12">
          Frequently Asked Questions
        </h2>

        <div className="flex flex-col">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-zinc-800">
              <button
                className="w-full flex items-center justify-between py-5 text-left gap-6"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    open === i ? "text-white" : "text-zinc-300"
                  }`}
                >
                  {faq.q}
                </span>
                <span className="shrink-0 text-zinc-500">
                  {open === i ? <Minus size={14} /> : <Plus size={14} />}
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  open === i ? "max-h-64 pb-5" : "max-h-0"
                }`}
              >
                <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
