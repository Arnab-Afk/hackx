"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarMode = "user" | "provider";

const ACCENT = "#7c45ff";
const ACCENT_BG = "rgba(124,69,255,0.1)";

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="7.5" cy="15.5" r="4.5"/>
      <path d="M21 2l-9.6 9.6M15.5 7.5l2 2"/>
    </svg>
  );
}
function IconAttestation() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconPayment() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 1 1 .5 4M3 16v-5h5"/>
    </svg>
  );
}
function IconServer() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
}
function IconRegister() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  );
}
function IconRentals() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function IconEarnings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconSwitch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}

const USER_NAV = [
  { label: "Dashboard",    icon: <IconDashboard />,   href: "/" },
  { label: "Pipelines",    icon: <IconPipeline />,    href: "/deploy" },
  { label: "Secrets",      icon: <IconKey />,         href: "/secrets" },
  { label: "Attestations", icon: <IconAttestation />, href: "/attestations" },
  { label: "Payments",     icon: <IconPayment />,     href: "/payments" },
  { label: "Audit Trails", icon: <IconHistory />,     href: "/audit" },
];

const PROVIDER_NAV = [
  { label: "Overview",     icon: <IconServer />,      href: "/provider" },
  { label: "Register",     icon: <IconRegister />,    href: "/provider/register" },
  { label: "Rentals",      icon: <IconRentals />,     href: "/provider/rentals" },
  { label: "Earnings",     icon: <IconEarnings />,    href: "/provider/earnings" },
  { label: "Attestations", icon: <IconAttestation />, href: "/provider/attestations" },
];

export function Sidebar({ mode }: { mode: SidebarMode }) {
  const pathname = usePathname();
  const navItems = mode === "user" ? USER_NAV : PROVIDER_NAV;

  function isActive(href: string) {
    if (href === "/" || href === "/provider") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex-shrink-0 w-64 flex flex-col justify-between p-4" style={{ background: "#101012" }}>
      <div className="flex flex-col gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 py-2">
          <span
            className="text-base font-semibold tracking-tight text-white select-none"
            style={{ letterSpacing: "-0.01em" }}
          >
            COMPUT<span style={{ display: "inline-block", transform: "scaleX(-1)" }}>E</span>
          </span>
          <span className="text-xs leading-tight ml-1" style={{ color: "#6B7280" }}>
            {mode === "provider" ? "/ provider" : "/ app"}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 mt-1">
          {navItems.map(({ label, icon, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  color: active ? ACCENT : "#9CA3AF",
                  background: active ? ACCENT_BG : "transparent",
                  textDecoration: "none",
                }}
              >
                {icon}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-1">
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "#9CA3AF", textDecoration: "none" }}
        >
          <IconSettings />
          Settings
        </Link>
        <Link
          href={mode === "user" ? "/provider" : "/"}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: ACCENT, background: ACCENT_BG, textDecoration: "none", marginTop: "4px" }}
        >
          <IconSwitch />
          {mode === "user" ? "Switch to Provider" : "Switch to User"}
        </Link>
      </div>
    </aside>
  );
}
