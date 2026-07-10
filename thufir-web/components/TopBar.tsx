"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { LOGO } from "@/components/BrandAssets";

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
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Thufir" style={{ height: 34, width: "auto", display: "block" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: 2 }}>THUFIR</span>
          <span className="brand-tag">MENTAT LOGIC · SIGNAL EXTRACTION</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ fontSize: 13 }}>{user?.display_name}</span>
        <div className="avatar" title={user?.email}>{initials}</div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--muted)", cursor: "pointer" }}
          onClick={() => { logout(); router.replace("/login"); }}>
          SIGN OUT
        </span>
      </div>
    </div>
  );
}
