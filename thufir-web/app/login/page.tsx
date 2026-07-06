"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/projects");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      router.replace("/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="stack" style={{ width: 360, gap: 20 }}>
        <div className="stack" style={{ gap: 8, alignItems: "center" }}>
          <span className="brand-mark" style={{ width: 40, height: 40, fontSize: 18 }}>T</span>
          <h1 style={{ fontSize: 20 }}>Thufir</h1>
          <span className="muted" style={{ fontSize: 13 }}>hyper-local research workspace</span>
        </div>

        <div className="card stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="pill-toggle"
              data-on={mode === "login"}
              onClick={() => setMode("login")}
              type="button"
            >
              Sign in
            </button>
            <button
              className="pill-toggle"
              data-on={mode === "register"}
              onClick={() => setMode("register")}
              type="button"
            >
              Create account
            </button>
          </div>

          <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
            {mode === "register" && (
              <div>
                <label className="field">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="field">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                required
              />
            </div>
            <div>
              <label className="field">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "at least 10 characters" : ""}
                required
              />
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <button className="btn btn-primary" style={{ justifyContent: "center" }} disabled={busy}>
              {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
