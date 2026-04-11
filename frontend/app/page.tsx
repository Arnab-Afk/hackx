import Link from "next/link";

const deployments = [
  {
    name: "aws-dev-01",
    stack: "React · Node · Postgres",
    status: "running",
    uptime: "3h 14m",
    url: "team42.zkloud.xyz",
    attested: true,
    cloud: "AWS",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" />
      </svg>
    ),
  },
  {
    name: "gcp-prod-main",
    stack: "FastAPI · Redis · MongoDB",
    status: "running",
    uptime: "1d 6h",
    url: "team01.zkloud.xyz",
    attested: true,
    cloud: "GCP",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2" /><rect width="20" height="8" x="2" y="14" rx="2" />
        <line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
      </svg>
    ),
  },
  {
    name: "az-sec-audit",
    stack: "Next.js · Prisma · PostgreSQL",
    status: "stopped",
    uptime: "Idle",
    url: "team07.zkloud.xyz",
    attested: true,
    cloud: "Azure",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    name: "aws-stg-04",
    stack: "Django · Celery · RabbitMQ",
    status: "running",
    uptime: "22m",
    url: "team99.zkloud.xyz",
    attested: false,
    cloud: "AWS",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
    ),
  },
];

const attestations = [
  { id: "0x4a2f…e91c", event: "Container created", env: "aws-dev-01", time: "3h ago" },
  { id: "0x91bc…44fa", event: "Agent deployment", env: "gcp-prod-main", time: "1d ago" },
  { id: "0x003e…7b12", event: "Key derivation proof", env: "az-sec-audit", time: "2d ago" },
];

export default function Home() {
  return (
    <div
      className="min-h-screen p-6 overflow-hidden"
      style={{
        background: "#0e0e0e",
        color: "#d1d5db",
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      {/* Top Header */}
      <header
        className="flex justify-between items-center mb-6 pb-4"
        style={{ borderBottom: "1px solid #1f2937" }}
      >
        {/* Logo + Nav */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold tracking-tight" style={{ fontSize: "15px" }}>
              Zkloud
            </span>
          </div>
          <nav className="flex gap-6" style={{ fontSize: "13px" }}>
            {["Dashboard", "Deploy", "Verify", "Docs"].map((item, i) => (
              item === "Deploy" ? (
                <Link
                  key={item}
                  href="/deploy"
                  className="cursor-pointer transition-colors"
                  style={{ color: "#6b7280" }}
                >
                  {item}
                </Link>
              ) : (
                <span
                  key={item}
                  className="cursor-pointer transition-colors"
                  style={{ color: i === 0 ? "#ffffff" : "#6b7280" }}
                >
                  {item}
                </span>
              )
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Network status */}
          <div className="flex items-center gap-2" style={{ fontSize: "12px", color: "#6b7280" }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
              <span>Base Mainnet</span>
            </div>
            <span style={{ color: "#374151" }}>·</span>
            <span>3 providers online</span>
          </div>

          {/* Wallet button */}
          <button
            className="flex items-center gap-2 rounded-sm px-3 py-1.5 transition-colors"
            style={{
              background: "#181818",
              border: "1px solid #2a2a2a",
              color: "#d1d5db",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            <span style={{ fontFamily: "var(--font-space-mono), monospace" }}>0x4f…91bc</span>
          </button>

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: "#374151", border: "1px solid #4b5563" }}
          >
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
              <path d="M18 18C21.3137 18 24 15.3137 24 12C24 8.68629 21.3137 6 18 6C14.6863 6 12 8.68629 12 12C12 15.3137 14.6863 18 18 18Z" fill="#a0a0a0" />
              <path d="M8.5 28C8.5 22.7533 12.7533 18.5 18 18.5C23.2467 18.5 27.5 22.7533 27.5 28" stroke="#a0a0a0" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 110px)" }}>

        {/* ── Column 1: Deploy + Workspaces ── */}
        <div className="flex flex-col gap-4" style={{ width: "25%" }}>

          {/* Quick Deploy CTA — blue */}
          <div
            className="p-5 flex flex-col justify-between rounded-sm"
            style={{ background: "#5c6e8c", color: "#ffffff", height: "28%" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                New deployment
              </p>
              <h2 className="font-semibold leading-snug" style={{ fontSize: "15px" }}>
                Deploy a stack in under 60 seconds
              </h2>
            </div>
            <div>
              <div
                className="flex items-center gap-2 rounded-sm px-3 py-2 mb-3"
                style={{ background: "rgba(0,0,0,0.25)", fontSize: "12px" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-space-mono), monospace" }}>
                  e.g. React + Express + Postgres…
                </span>
              </div>
              <Link
                href="/deploy"
                className="w-full rounded-sm py-2 font-semibold transition-opacity text-sm text-center block"
                style={{ background: "#ffffff", color: "#1e2d3d", fontSize: "13px" }}
              >
                Start deploying →
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3" style={{ height: "14%" }}>
            <div
              className="flex-1 p-4 rounded-sm flex flex-col justify-between"
              style={{ background: "#181818" }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: "#6b7280", fontSize: "10px" }}>Running</p>
              <span className="text-white font-semibold" style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "1.75rem" }}>3</span>
            </div>
            <div
              className="flex-1 p-4 rounded-sm flex flex-col justify-between"
              style={{ background: "#181818" }}
            >
              <p className="text-xs uppercase tracking-widest" style={{ color: "#6b7280", fontSize: "10px" }}>Stopped</p>
              <span className="font-semibold" style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "1.75rem", color: "#6b7280" }}>1</span>
            </div>
          </div>

          {/* Workspaces */}
          <div
            className="p-4 flex flex-col flex-1 rounded-sm"
            style={{ background: "#181818", overflow: "hidden" }}
          >
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280", fontSize: "10px" }}>
                My workspaces
              </p>
              <span className="text-xs cursor-pointer" style={{ color: "#5c6e8c", fontSize: "11px" }}>View all</span>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {deployments.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center gap-3 p-2.5 rounded-sm cursor-pointer hover:bg-[#222222] transition-colors"
                  style={{ background: "#1e1e1e" }}
                >
                  <div
                    className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0"
                    style={{ background: "#2a2a2a", color: d.status === "running" ? "#5c6e8c" : "#4b5563" }}
                  >
                    {d.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate" style={{ fontSize: "12px" }}>{d.name}</p>
                    <p className="truncate" style={{ fontSize: "10px", color: "#6b7280" }}>{d.stack}</p>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: d.status === "running" ? "#22c55e" : "#4b5563" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Column 2: Credits + Feature card ── */}
        <div className="flex flex-col gap-4" style={{ width: "22%" }}>

          {/* Credits / Tokens */}
          <div
            className="p-5 flex flex-col justify-between rounded-sm"
            style={{ background: "#181818", height: "32%" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#6b7280", fontSize: "10px" }}>
                Compute credits
              </p>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-white font-semibold" style={{ fontFamily: "var(--font-space-mono), monospace", fontSize: "2.5rem", letterSpacing: "-0.03em" }}>
                  24
                </span>
                <span style={{ color: "#6b7280", fontSize: "13px" }}>/ 32 tokens</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5" style={{ fontSize: "11px" }}>
                <span style={{ color: "#9ca3af" }}>Used this month</span>
                <span className="text-white">$6,000 / $12,000</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                <div className="h-full rounded-full" style={{ width: "50%", background: "#5c6e8c" }} />
              </div>
              <p className="mt-2" style={{ fontSize: "10px", color: "#4b5563" }}>Resets in 18 days</p>
            </div>
          </div>

          {/* Feature card */}
          <div
            className="p-6 flex flex-col justify-end flex-1 rounded-sm relative overflow-hidden"
            style={{ background: "#5c6e8c", color: "#ffffff" }}
          >
            <svg
              className="absolute top-0 right-0 pointer-events-none"
              style={{ width: "100%", height: "55%", opacity: 0.3 }}
              viewBox="0 0 200 200"
            >
              <path d="M 100 0 L 100 200 M 0 100 L 200 100" stroke="white" strokeWidth="0.5" />
              <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" fill="none" />
              <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="0.5" fill="none" />
              <path d="M 20 20 L 180 180" stroke="white" strokeWidth="0.5" />
            </svg>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px" }}>
              How it works
            </p>
            <h3 className="font-semibold leading-snug mb-3" style={{ fontSize: "16px" }}>
              Trustless by design. Verifiable by anyone.
            </h3>
            <p className="leading-relaxed mb-5" style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>
              Every agent action is hashed and recorded on-chain. Your keys never leave your browser. Not even we can read your containers.
            </p>
            <a className="text-xs font-semibold underline cursor-pointer" style={{ color: "rgba(255,255,255,0.85)", fontSize: "11px" }}>
              Read the attestation docs →
            </a>
          </div>
        </div>

        {/* ── Column 3 & 4: Active deployments + attestations ── */}
        <div className="flex flex-col gap-4 flex-1">

          {/* Active Deployments table */}
          <div
            className="p-5 rounded-sm flex flex-col"
            style={{ background: "#181818", flex: "1 1 55%" }}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-white font-semibold" style={{ fontSize: "14px" }}>Active Deployments</h3>
                <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>4 environments · 3 running</p>
              </div>
              <Link
                href="/deploy"
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-white transition-opacity"
                style={{ background: "#5c6e8c", fontSize: "12px" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                New deployment
              </Link>
            </div>

            {/* Table header */}
            <div
              className="grid gap-4 pb-2 mb-1"
              style={{
                gridTemplateColumns: "1fr 1fr 80px 80px 100px 28px",
                fontSize: "10px",
                color: "#4b5563",
                borderBottom: "1px solid #1f2937",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span>Environment</span>
              <span>Stack</span>
              <span>Cloud</span>
              <span>Uptime</span>
              <span>Attestation</span>
              <span />
            </div>

            {/* Rows */}
            <div className="flex flex-col flex-1">
              {deployments.map((d) => (
                <div
                  key={d.name}
                  className="grid gap-4 py-3 hover:bg-[#1e1e1e] transition-colors rounded-sm cursor-pointer"
                  style={{
                    gridTemplateColumns: "1fr 1fr 80px 80px 100px 28px",
                    borderBottom: "1px solid #161616",
                    alignItems: "center",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: d.status === "running" ? "#22c55e" : "#4b5563" }}
                    />
                    <span className="text-white font-medium truncate" style={{ fontSize: "13px" }}>{d.name}</span>
                  </div>
                  <span className="truncate" style={{ fontSize: "11px", color: "#9ca3af" }}>{d.stack}</span>
                  <span
                    className="inline-flex items-center rounded-sm px-1.5 py-0.5"
                    style={{
                      fontSize: "10px",
                      color: "#9ca3af",
                      background: "#222",
                      letterSpacing: "0.05em",
                      width: "fit-content",
                      fontFamily: "var(--font-space-mono), monospace",
                    }}
                  >
                    {d.cloud}
                  </span>
                  <span style={{ fontSize: "12px", color: d.status === "running" ? "#d1d5db" : "#4b5563", fontFamily: "var(--font-space-mono), monospace" }}>
                    {d.uptime}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {d.attested ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: "11px", color: "#22c55e" }}>Verified</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span style={{ fontSize: "11px", color: "#f59e0b" }}>Pending</span>
                      </>
                    )}
                  </div>
                  <div style={{ color: "#4b5563" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex gap-4" style={{ flex: "0 0 auto", height: "42%" }}>

            {/* On-chain attestations */}
            <div
              className="p-5 rounded-sm flex flex-col"
              style={{ background: "#181818", width: "55%" }}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-semibold" style={{ fontSize: "14px" }}>On-Chain Attestations</h3>
                  <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>Tamper-proof audit trail on Base</p>
                </div>
                <span className="text-xs cursor-pointer" style={{ color: "#5c6e8c", fontSize: "11px" }}>BaseScan →</span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {attestations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2.5 rounded-sm cursor-pointer hover:bg-[#222] transition-colors"
                    style={{ background: "#1e1e1e" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-6 h-6 rounded-sm flex items-center justify-center shrink-0"
                        style={{ background: "#222" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5c6e8c" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white truncate" style={{ fontSize: "12px" }}>{a.event}</p>
                        <p className="truncate" style={{ fontSize: "10px", color: "#6b7280" }}>
                          <span style={{ fontFamily: "var(--font-space-mono), monospace" }}>{a.id}</span> · {a.env}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 ml-3" style={{ fontSize: "10px", color: "#4b5563" }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resource usage + IaC link */}
            <div className="flex flex-col gap-4 flex-1">

              {/* Resource overview */}
              <div
                className="p-5 rounded-sm flex-1"
                style={{ background: "#181818" }}
              >
                <h3 className="text-white font-semibold mb-4" style={{ fontSize: "13px" }}>Resource Usage</h3>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Compute", value: "1.59 TB", pct: 60 },
                    { label: "API calls", value: "5.01 / $18", pct: 28 },
                  ].map((r) => (
                    <div key={r.label}>
                      <div className="flex justify-between mb-1" style={{ fontSize: "11px" }}>
                        <span style={{ color: "#9ca3af" }}>{r.label}</span>
                        <span className="text-white" style={{ fontFamily: "var(--font-space-mono), monospace" }}>{r.value}</span>
                      </div>
                      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#2a2a2a" }}>
                        <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: "#5c6e8c" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IaC Templates — tan */}
              <div
                className="p-5 rounded-sm flex justify-between items-end relative group cursor-pointer"
                style={{ background: "#c2c1b4", color: "#111111", flex: "0 0 auto", height: "42%" }}
              >
                <div
                  className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "#181818", color: "#ffffff" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold leading-snug uppercase tracking-widest" style={{ fontSize: "13px", lineHeight: 1.15 }}>
                    IaC Pipeline<br />Templates
                  </p>
                  <p className="mt-1" style={{ fontSize: "10px", color: "#555" }}>Start from a verified template</p>
                </div>
                <span
                  className="font-bold uppercase tracking-widest"
                  style={{ fontSize: "10px", color: "#333", fontFamily: "var(--font-space-mono), monospace" }}
                >
                  10 / 20
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

