"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

const CircuitT = () => (
  <svg width="22" height="22" viewBox="0 0 40 40" fill="none" style={{ color: "var(--amber)", flexShrink: 0 }}>
    <path d="M6 8 H34" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    <path d="M20 8 V32" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    <circle cx="6" cy="8" r="2.6" fill="currentColor" />
    <circle cx="34" cy="8" r="2.6" fill="currentColor" />
    <circle cx="20" cy="34" r="2.6" fill="currentColor" />
    <path d="M12 16 H20 M28 22 H20" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="16" r="1.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="30" cy="22" r="1.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const initials = (user?.display_name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="topbar">
      <div className="brand">
        <CircuitT />
        <span>Thufir</span>
        <span className="brand-tag">MENTAT LOGIC · SIGNAL EXTRACTION</span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>{user?.display_name}</span>
        <div className="avatar" title={user?.email}>{initials}</div>
        <button
          className="btn btn-quiet"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
