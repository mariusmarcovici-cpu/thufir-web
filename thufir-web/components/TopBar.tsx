"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

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
        <span className="brand-mark">T</span>
        <span>Thufir</span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <span className="muted" style={{ fontSize: 13 }}>{user?.display_name}</span>
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
