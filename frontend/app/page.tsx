export default function Home() {
  return (
    <div
      className="min-h-screen p-6 overflow-hidden uppercase tracking-wider"
      style={{
        background: "#0e0e0e",
        color: "#d1d5db",
        fontFamily: "var(--font-inter), sans-serif",
        userSelect: "none",
      }}
    >
      {/* Top Header */}
      <header
        className="flex justify-between items-center mb-6 pb-4"
        style={{ borderBottom: "1px solid #1f2937", fontSize: "10px" }}
      >
        <div className="flex items-center gap-10">
          {/* Grid icon */}
          <div className="text-white cursor-pointer transition-colors hover:text-[#5c6e8c]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <line x1="3" x2="21" y1="9" y2="9" />
              <line x1="3" x2="21" y1="15" y2="15" />
              <line x1="9" x2="9" y1="3" y2="21" />
              <line x1="15" x2="15" y1="3" y2="21" />
            </svg>
          </div>

          {/* Stats row */}
          <div
            className="flex gap-10 tracking-widest"
            style={{ fontFamily: "var(--font-space-mono), monospace" }}
          >
            {[
              { label: "AWS ZONE", value: "US-EAST-1" },
              { label: "GCP ZONE", value: "US-CENTRAL1" },
              { label: "AZURE RES", value: "EAST US" },
              { label: "ZKT BALANCE", value: "12,004 ZKT" },
              { label: "ACTIVE NODES", value: "1.59223 K" },
              { label: "1D DEPLOYS", value: "+2.56%", muted: true },
              { label: "7D DEPLOYS", value: "+16.79%", muted: true },
            ].map((item) => (
              <div key={item.label}>
                <span className="block mb-1" style={{ color: "#6b7280" }}>
                  {item.label}
                </span>
                <span style={{ color: item.muted ? "#9ca3af" : "#ffffff" }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="text-right" style={{ fontSize: "10px" }}>
            <span className="block text-white">SYSADMIN</span>
            <span style={{ color: "#6b7280" }}>#4015</span>
          </div>
          <div
            className="w-8 h-8 rounded-full overflow-hidden"
            style={{ background: "#374151", border: "1px solid #4b5563" }}
          >
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 18C21.3137 18 24 15.3137 24 12C24 8.68629 21.3137 6 18 6C14.6863 6 12 8.68629 12 12C12 15.3137 14.6863 18 18 18Z"
                fill="#a0a0a0"
              />
              <path
                d="M8.5 28C8.5 22.7533 12.7533 18.5 18 18.5C23.2467 18.5 27.5 22.7533 27.5 28"
                stroke="#a0a0a0"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 120px)" }}>
        {/* ── Column 1 ── */}
        <div className="flex flex-col gap-4" style={{ width: "25%" }}>
          {/* Active Pipelines — blue */}
          <div
            className="p-5 flex flex-col justify-between rounded-sm"
            style={{ background: "#5c6e8c", color: "#ffffff", height: "22%" }}
          >
            <div
              className="flex justify-between items-start font-semibold"
              style={{ fontSize: "10px", letterSpacing: "0.1em" }}
            >
              <span>ACTIVE PIPELINES</span>
              <span>:</span>
            </div>
            <div
              className="flex items-baseline justify-between"
              style={{ fontFamily: "var(--font-space-mono), monospace" }}
            >
              <span style={{ fontSize: "3rem", letterSpacing: "-0.05em" }}>1.8</span>
              <span style={{ fontSize: "12px" }}>/ 6H</span>
            </div>
          </div>

          {/* Provisioned Envs */}
          <div
            className="p-5 flex flex-col justify-between rounded-sm"
            style={{ background: "#181818", height: "20%" }}
          >
            <div
              className="flex justify-between items-start font-semibold"
              style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#9ca3af" }}
            >
              <span>PROVISIONED ENVS</span>
              <span>:</span>
            </div>
            <div
              className="flex items-baseline justify-between"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#ffffff" }}
            >
              <span style={{ fontSize: "3rem", letterSpacing: "-0.05em" }}>2</span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>/ 5</span>
            </div>
          </div>

          {/* Zero-Trust Logs — tall */}
          <div
            className="p-5 flex flex-col justify-between flex-1 rounded-sm relative group cursor-pointer"
            style={{ background: "#181818" }}
          >
            <div
              className="flex justify-between items-start font-semibold"
              style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#9ca3af" }}
            >
              <span>ZERO-TRUST LOGS</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: "#ffffff", color: "#000000" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17L17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </div>
            </div>

            <div
              className="mt-12 flex items-baseline justify-between"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#ffffff" }}
            >
              <span style={{ fontSize: "3.75rem", letterSpacing: "-0.05em" }}>6.9</span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>/ 15H</span>
            </div>

            <div className="mt-8">
              <span
                className="block font-semibold mb-3"
                style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#6b7280" }}
              >
                LATEST WORKSPACES
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "aws-dev-01",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" x2="20" y1="19" y2="19" />
                      </svg>
                    ),
                  },
                  {
                    label: "gcp-prod-main",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                        <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                        <line x1="6" x2="6.01" y1="6" y2="6" />
                        <line x1="6" x2="6.01" y1="18" y2="18" />
                      </svg>
                    ),
                  },
                  {
                    label: "az-sec-audit",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    ),
                  },
                  {
                    label: "aws-stg-04",
                    icon: (
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                      </svg>
                    ),
                  },
                ].map((ws) => (
                  <div
                    key={ws.label}
                    className="aspect-square rounded-sm flex flex-col items-center justify-center transition-colors cursor-pointer bg-[#222222] text-[#6b7280] hover:bg-[#333333] hover:text-white"
                  >
                    <div className="mb-2">{ws.icon}</div>
                    <span
                      style={{
                        fontSize: "9px",
                        fontFamily: "var(--font-space-mono), monospace",
                      }}
                    >
                      {ws.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2 ── */}
        <div className="flex flex-col gap-4" style={{ width: "25%" }}>
          {/* Ephemeral Tokens */}
          <div
            className="p-5 flex flex-col justify-between rounded-sm"
            style={{ background: "#181818", height: "35%" }}
          >
            <div
              className="flex justify-between items-start font-semibold"
              style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#9ca3af" }}
            >
              <span>EPHEMERAL TOKENS</span>
              <span>:</span>
            </div>
            <div
              className="flex items-baseline justify-between mt-auto mb-4"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#ffffff" }}
            >
              <span style={{ fontSize: "3.75rem", letterSpacing: "-0.05em" }}>24</span>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>/ 32</span>
            </div>
            <div
              className="flex justify-between items-center font-semibold pt-3"
              style={{
                fontSize: "9px",
                color: "#6b7280",
                borderTop: "1px solid #1f2937",
                fontFamily: "var(--font-space-mono), monospace",
              }}
            >
              <span style={{ fontFamily: "var(--font-inter), sans-serif" }}>TOTAL ISSUED</span>
              <span>$6,000 / 12,000</span>
            </div>
          </div>

          {/* Feature Block — blue */}
          <div
            className="p-6 flex flex-col justify-end flex-1 rounded-sm relative overflow-hidden group"
            style={{ background: "#5c6e8c", color: "#ffffff" }}
          >
            {/* Geometric art */}
            <svg
              className="absolute top-0 right-0 pointer-events-none"
              style={{ width: "100%", height: "50%", opacity: 0.4 }}
              viewBox="0 0 200 200"
            >
              <path d="M 100 0 L 100 200 M 0 100 L 200 100" stroke="white" strokeWidth="0.5" />
              <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" fill="none" />
              <path d="M 100 100 L 180 180" stroke="white" strokeWidth="0.5" />
            </svg>

            <h2
              className="font-medium leading-tight mb-4 pr-4"
              style={{ fontSize: "1.5rem", letterSpacing: "0.05em" }}
            >
              ONE-COMMAND <br /> CLOUD BOOTSTRAP
            </h2>
            <p
              className="leading-relaxed mb-6 normal-case"
              style={{
                fontSize: "9px",
                letterSpacing: "0.1em",
                color: "#e5e7eb",
                width: "91.666667%",
                fontFamily: "var(--font-space-mono), monospace",
              }}
            >
              AGENT INHERITS SHELL IDENTITY. CREDENTIALS ARE J.I.T GENERATED
              AND AUTOMATICALLY REVOKED POST-DEPLOYMENT.
            </p>
            <div className="flex gap-2 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }} />
            </div>
          </div>
        </div>

        {/* ── Column 3 & 4 ── */}
        <div className="flex flex-col gap-4" style={{ width: "50%" }}>
          {/* Large Chart Block */}
          <div
            className="p-5 rounded-sm flex-1 relative flex flex-col"
            style={{ background: "#181818" }}
          >
            <div
              className="flex justify-between items-start w-full font-semibold"
              style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#9ca3af" }}
            >
              <span>TOTAL INFRASTRUCTURE (TB)</span>
              <div
                className="flex gap-4"
                style={{ fontSize: "9px", fontFamily: "var(--font-space-mono), monospace" }}
              >
                {["7D", "30D", "5M", "12M"].map((p) => (
                  <span
                    key={p}
                    className="cursor-pointer transition-colors"
                    style={
                      p === "5M"
                        ? {
                            background: "#2a2a2a",
                            color: "#ffffff",
                            padding: "2px 8px",
                            borderRadius: "2px",
                          }
                        : { color: "#9ca3af" }
                    }
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-12 mb-4" style={{ color: "#ffffff" }}>
              <span
                style={{
                  fontSize: "5.5rem",
                  lineHeight: 1,
                  fontFamily: "var(--font-space-mono), monospace",
                  letterSpacing: "-0.05em",
                }}
              >
                1.592
              </span>
            </div>

            {/* Bar Chart */}
            <div
              className="absolute flex items-end gap-1.5"
              style={{ bottom: "24px", right: "24px", height: "144px" }}
            >
              {[
                { h: "30%", color: "#7a7a7a" },
                { h: "45%", color: "#9a9a9a" },
                { h: "90%", color: "#5c6e8c", label: "1.8347", sub: "JAN,2023" },
                { h: "65%", color: "#9a9a9a" },
                { h: "55%", color: "#7a7a7a" },
              ].map((bar, i) => (
                <div
                  key={i}
                  className="w-10 relative"
                  style={{ height: bar.h, background: bar.color }}
                >
                  {bar.label && (
                    <div
                      className="absolute text-center"
                      style={{
                        top: "-32px",
                        left: "50%",
                        transform: "translateX(-50%)",
                      }}
                    >
                      <span
                        className="block text-white leading-none"
                        style={{
                          fontSize: "10px",
                          fontFamily: "var(--font-space-mono), monospace",
                        }}
                      >
                        {bar.label}
                      </span>
                      <span
                        className="block mt-1"
                        style={{
                          fontSize: "8px",
                          color: "#9ca3af",
                          fontFamily: "var(--font-space-mono), monospace",
                        }}
                      >
                        {bar.sub}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Middle row */}
          <div className="flex gap-4" style={{ height: "35%" }}>
            {/* ZkEnv API Usage */}
            <div
              className="p-5 rounded-sm flex flex-col justify-between"
              style={{ background: "#181818", width: "50%" }}
            >
              <div
                className="font-semibold"
                style={{ fontSize: "10px", letterSpacing: "0.1em", color: "#9ca3af" }}
              >
                ZKLOUD API USAGE
              </div>
              <div>
                <div
                  className="flex items-baseline gap-4 mb-4"
                  style={{ color: "#ffffff" }}
                >
                  <span
                    style={{
                      fontSize: "3rem",
                      fontFamily: "var(--font-space-mono), monospace",
                      letterSpacing: "-0.05em",
                    }}
                  >
                    5.01
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "var(--font-space-mono), monospace",
                      color: "#6b7280",
                    }}
                  >
                    / $18.00
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden flex"
                  style={{ background: "#2a2a2a" }}
                >
                  <div
                    className="h-full"
                    style={{ width: "30%", background: "#5c6e8c" }}
                  />
                </div>
              </div>
            </div>

            {/* Cloud Distribution Donut */}
            <div
              className="p-5 rounded-sm flex items-center justify-center relative"
              style={{ background: "#181818", width: "50%" }}
            >
              <svg
                className="absolute inset-0 p-4"
                style={{
                  width: "100%",
                  height: "100%",
                  transform: "rotate(-90deg)",
                }}
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="40" stroke="#2a2a2a" strokeWidth="4" fill="none" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#5c6e8c"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="251.2"
                  strokeDashoffset="100.48"
                  strokeLinecap="round"
                />
              </svg>
              <div
                className="relative z-10 flex flex-col items-center justify-center text-center"
              >
                <span
                  style={{
                    fontSize: "2.25rem",
                    fontFamily: "var(--font-space-mono), monospace",
                    letterSpacing: "-0.05em",
                    color: "#ffffff",
                  }}
                >
                  60%
                </span>
                <span
                  className="font-semibold mt-2 uppercase"
                  style={{ fontSize: "9px", letterSpacing: "0.1em", color: "#9ca3af" }}
                >
                  CLOUD DIST.
                </span>
              </div>
            </div>
          </div>

          {/* IaC Pipeline Templates — tan block */}
          <div
            className="p-6 rounded-sm flex justify-between items-end relative group cursor-pointer"
            style={{ background: "#c2c1b4", color: "#111111", height: "20%" }}
          >
            <div
              className="absolute w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
              style={{
                top: "20px",
                right: "20px",
                background: "#181818",
                color: "#ffffff",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17L17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </div>
            <div
              className="font-semibold leading-tight"
              style={{ fontSize: "1.25rem", letterSpacing: "0.1em", lineHeight: 1.1 }}
            >
              IAC PIPELINE <br /> TEMPLATES
            </div>
            <div
              className="font-bold"
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-space-mono), monospace",
                letterSpacing: "0.1em",
                color: "#333333",
              }}
            >
              10 / 20 TEMPLATES
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
