"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRequireAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";
import TopBar from "@/components/TopBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function call(path: string, method: "GET" | "POST", body?: any) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || "Request failed");
  }
  return res.json();
}

export default function ProjectDetailPage() {
  const { user, loading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [velocity, setVelocity] = useState<any>(null);
  const [board, setBoard] = useState<any[]>([]);
  const [urls, setUrls] = useState("https://stluciatimes.com/feed/\n");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const [p, v, b] = await Promise.all([
        call(`/projects/${id}`, "GET"),
        call(`/projects/${id}/velocity/topics?window=30d`, "GET"),
        call(`/projects/${id}/entities/leaderboard`, "GET").catch(() => ({ entities: [] })),
      ]);
      setProject(p);
      setVelocity(v);
      setBoard(b.entities || []);
    } catch {
      setError("Couldn't load this project.");
    }
  }, [id]);

  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  function summarise(r: any): string {
    const news = r?.news?.new_items ?? 0;
    const fb = r?.facebook?.new_items ?? 0;
    const realPosts = r?.facebook?.real_posts;
    const fbNote = r?.facebook?.error ? ` (Facebook: ${r.facebook.error})` : r?.facebook?.skipped ? ` (Facebook: ${r.facebook.skipped})` : "";
    const seen = realPosts != null ? ` (${realPosts} posts scanned)` : "";
    return `Collected ${news} new news item${news === 1 ? "" : "s"} and ${fb} new Facebook post${fb === 1 ? "" : "s"}${seen}.${fbNote}`;
  }

  async function run(path: string, body?: any) {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await call(path, "POST", body);
      setResult(summarise(r));
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Collection failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;

  const topics = (velocity?.topics ?? []) as any[];
  const totalVolume = topics.reduce((s, t) => s + (t.raw_volume || 0), 0);
  const chartData = topics.slice().sort((a, b) => (b.raw_volume || 0) - (a.raw_volume || 0)).slice(0, 8)
    .map((t, i) => ({ name: `Topic ${i + 1}`, volume: t.raw_volume || 0 }));
  const maxEng = Math.max(1, ...board.map((e) => e.engagement || 0));

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 900 }}>
        <button className="btn btn-quiet" style={{ marginBottom: 14 }} onClick={() => router.push("/projects")}>&larr; Projects</button>

        {project && (
          <>
            <div className="spread" style={{ marginBottom: 6, alignItems: "flex-start" }}>
              <h1 style={{ fontSize: 20 }}>{project.project.name}</h1>
              <span className={project.project.status === "collecting" ? "chip chip-ok" : "chip"}>{project.project.status}</span>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              <span className="chip">{project.project.region_label}</span>
              {(project.project.languages || []).length > 0 && <span className="chip">{project.project.languages.join(" · ")}</span>}
            </div>
          </>
        )}

        {/* Engagement leaderboard */}
        {board.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>Who&apos;s winning attention</div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Public pages ranked by engagement on their recent posts (reactions + shares).</div>
            <div className="stack" style={{ gap: 10 }}>
              {board.map((e, i) => (
                <div key={e.entity_id}>
                  <div className="spread" style={{ fontSize: 13, marginBottom: 3 }}>
                    <span style={{ fontWeight: 500 }}>{i + 1}. {e.display_name}</span>
                    <span className="muted">{e.engagement.toLocaleString()} eng · {e.posts} posts</span>
                  </div>
                  <div style={{ height: 8, background: "var(--border-soft)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((e.engagement / maxEng) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                    {e.likes.toLocaleString()} reactions · {e.shares.toLocaleString()} shares · {e.views.toLocaleString()} views
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coverage volume */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="spread" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Coverage volume · last 30 days</span>
            <button className="btn" disabled={busy} onClick={() => run(`/projects/${id}/collect`)}>{busy ? "Collecting…" : "Collect now"}</button>
          </div>
          <div style={{ fontFamily: "var(--font-voice)", fontSize: 40, fontWeight: 500, lineHeight: 1 }}>{totalVolume.toLocaleString()}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 12 }}>items collected across all topics</div>
          {chartData.length > 0 ? (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "var(--border-soft)" }} />
                  <Bar dataKey="volume" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>No data yet — add your sources below and collect.</div>}
        </div>

        {/* Sources */}
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Sources</div>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>One URL per line. News/RSS feeds and public Facebook page URLs. Facebook uses your Apify credits.</p>
          <textarea className="input" style={{ minHeight: 110, fontFamily: "monospace", fontSize: 12, resize: "vertical" }} value={urls} onChange={(e) => setUrls(e.target.value)} />
          <div className="row" style={{ gap: 9, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(`/projects/${id}/sources`, { urls: urls.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("http")) })}>
              {busy ? "Collecting…" : "Add sources & collect"}
            </button>
          </div>
          {result && <div className="alert" style={{ background: "var(--success-bg)", color: "var(--success-text)", marginTop: 12 }}>{result}</div>}
          {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    </>
  );
}
