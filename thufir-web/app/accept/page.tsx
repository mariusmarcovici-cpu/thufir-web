"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = { editor: "Operator", viewer: "Observer" };

function AcceptInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const router = useRouter();
  const { user, loading, login, register } = useAuth();

  const [info, setInfo] = useState<any>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) { setInfoErr("No invite token in the link."); return; }
    api.inviteInfo(token)
      .then((d) => { setInfo(d); if (d.email) setEmail(d.email); })
      .catch((e) => setInfoErr(e instanceof ApiError ? e.message : "Couldn't load this invite."));
  }, [token]);

  // once signed in, attach to the project
  async function doAccept() {
    setBusy(true); setError(null);
    try {
      const r = await api.acceptInvite(token);
      setAccepted(true);
      setTimeout(() => router.replace(`/projects/${r.project_id}`), 900);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Couldn't accept the invite.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    // if the user is already logged in when they land here, accept straight away
    if (!loading && user && info && !accepted && !busy) doAccept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, info]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name || email.split("@")[0]);
      // the auth context updates; the effect above will fire doAccept()
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  const box: React.CSSProperties = {
    maxWidth: 420, margin: "8vh auto", padding: 28,
    border: "1px solid var(--carbon, #2A2E37)", borderRadius: 4,
    background: "var(--panel, #16181D)", color: "var(--text, #E6E9EE)",
    fontFamily: "var(--font, system-ui)",
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "9px 11px", marginBottom: 10, borderRadius: 3,
    border: "1px solid var(--carbon, #2A2E37)", background: "var(--void, #0D0E12)",
    color: "inherit", fontSize: 14,
  };

  if (infoErr) return <div style={box}><h3>Invite problem</h3><p className="muted">{infoErr}</p></div>;
  if (!info) return <div style={box}><p className="muted">Loading invite…</p></div>;
  if (info.used) return <div style={box}><h3>Already used</h3><p className="muted">This invite has already been accepted. Ask the project owner for a new one if you need access.</p></div>;
  if (info.expired) return <div style={box}><h3>Invite expired</h3><p className="muted">This invite is no longer valid. Ask the project owner to send a fresh one.</p></div>;

  if (accepted) return <div style={box}><h3>You&apos;re in ✓</h3><p className="muted">Taking you to {info.project_name}…</p></div>;

  return (
    <div style={box}>
      <div style={{ fontSize: 12, letterSpacing: ".08em", color: "var(--muted, #8B949E)", marginBottom: 6 }}>THUFIR · INVITE</div>
      <h2 style={{ margin: "0 0 4px" }}>{info.project_name}</h2>
      <p style={{ marginTop: 0, color: "var(--muted, #8B949E)", fontSize: 14 }}>
        You&apos;ve been invited as <b style={{ color: "var(--amber, #C2A34F)" }}>{ROLE_LABEL[info.role] || info.role}</b>
        {info.role === "viewer" ? " — you can view everything, but actions that cost money are the owner&apos;s." : " — full access to operate the project."}
      </p>

      {user ? (
        <button onClick={doAccept} disabled={busy} style={{ ...input, cursor: "pointer", background: "var(--amber, #C2A34F)", color: "#111", fontWeight: 600, marginTop: 8 }}>
          {busy ? "Joining…" : `Join as ${ROLE_LABEL[info.role] || info.role}`}
        </button>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button type="button" onClick={() => setMode("register")} style={{ flex: 1, padding: "6px 0", borderRadius: 3, border: "1px solid var(--carbon)", background: mode === "register" ? "var(--carbon)" : "transparent", color: "inherit", cursor: "pointer", fontSize: 12 }}>NEW ACCOUNT</button>
            <button type="button" onClick={() => setMode("login")} style={{ flex: 1, padding: "6px 0", borderRadius: 3, border: "1px solid var(--carbon)", background: mode === "login" ? "var(--carbon)" : "transparent", color: "inherit", cursor: "pointer", fontSize: 12 }}>I HAVE ONE</button>
          </div>
          <input style={input} type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {mode === "register" && <input style={input} placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />}
          <input style={input} type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {info.email && email.trim().toLowerCase() !== info.email.trim().toLowerCase() && (
            <div style={{ fontSize: 11, color: "var(--danger, #C25248)", marginBottom: 8 }}>
              This invite is for {info.email} — sign in with that email.
            </div>
          )}
          <button type="submit" disabled={busy} style={{ ...input, cursor: "pointer", background: "var(--amber, #C2A34F)", color: "#111", fontWeight: 600 }}>
            {busy ? "…" : mode === "register" ? "Create account & join" : "Sign in & join"}
          </button>
        </form>
      )}
      {error && <div style={{ color: "var(--danger, #C25248)", fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
}


export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 420, margin: "8vh auto", padding: 28, color: "#8B949E" }}>Loading…</div>}>
      <AcceptInner />
    </Suspense>
  );
}
