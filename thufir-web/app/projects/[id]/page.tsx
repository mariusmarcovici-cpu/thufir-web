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
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
  const [urls, setUrls] = useState("https://stluciatimes.com/feed/\n");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      const [p, v] = await Promise.all([
        call(`/projects/${id}`, "GET"),
        call(`/projects/${id}/velocity/topics?window=30d`, "GET"),
      ]);
      setProject(p);
      setVelocity(v);
    } catch {
      setError("Couldn't load this project.");
    }
  }, [id]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  function summarise(r: any): string {
    const news = r?.news?.new_items ?? 0;
    const fb = r?.facebook?.new_items ?? 0;
    const fbNote = r?.facebook?.error
      ? ` (Facebook: ${r.facebook.error})`
      : r?.facebook?.skipped
      ? ` (Facebook: ${r.facebook.skipped})`
      : "";
    return `Collected ${news} news item${news === 1 ? "" : "s"} and ${fb} Facebook post${fb === 1 ? "" : "s"}.${fbNote}`;
  }

  async function addAndCollect() {
    setBusy(true); setError(null); setResult(null);
    try {
      const list = urls.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("http"));
      const r = await call(`/projects/${id}/sources`, "POST", { urls: list });
      setResult(summarise(r));
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Collection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function collectNow() {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await call(`/projects/${id}/collect`, "POST");
      setResult(summarise(r));
      await loadAll();
    } catch (e: any) {
      setError(e.message || "Collection failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  }

  const topics = (velocity?.topics ?? []) as any[];
  const totalVolume = topics.reduce((s, t) => s + (t.raw_volume || 0), 0);
  const chartData = topics
    .slice()
    .sort((a, b) => (b.raw_volume || 0) - (a.raw_volume || 0))
    .slice(0, 8)
    .map((t, i) => ({ name: `Topic ${i + 1}`, volume: t.raw_volume || 0 }));

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 900 }}>
        <button className="btn btn-quiet" style={{ marginBottom: 14 }} onClick={() => router.push("/projects")}>
          &larr; Projects
        </button>

        {project && (
          <>
            <div className="spread" style={{ marginBottom: 6, alignItems: "flex-start" }}>
              <h1 style={{ fontSize: 20 }}>{project.project.name}</h1>
              <span className={project.project.status === "collecting" ? "chip chip-ok" : "chip"}>
                {project.project.status}
              </span>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              <span className="chip">{project.project.region_label}</span>
              {(project.project.languages || []).length > 0 && (
                <span className="chip">{project.project.languages.join(" · ")}</span>
              )}
            </div>
          </>
        )}

        <div className="card" style={{ marginBottom: 14 }}>
          <div className="spread" style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Coverage volume · last 30 days</span>
            <button className="btn" disabled={busy} onClick={collectNow}>{busy ? "Collecting…" : "Collect now"}</button>
          </div>
          <div style={{ fontFamily: "var(--font-voice)", fontSize: 40, fontWeight: 500, lineHeight: 1 }}>
            {totalVolume.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4, marginBottom: 12 }}>items collected across all topics</div>
          {chartData.length > 0 ? (
            <div style={{ width: "100%", height: 220 }}>
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
          ) : (
            <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>
              No data yet — add your sources below and collect.
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Sources</div>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>
            One URL per line. News/RSS feeds and public Facebook page URLs
            (https://www.facebook.com/…). Facebook uses your Apify credits.
          </p>
          <textarea
            className="input"
            style={{ minHeight: 110, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
          <div className="row" style={{ gap: 9, marginTop: 10 }}>
            <button className="btn btn-primary" disabled={busy} onClick={addAndCollect}>
              {busy ? "Collecting…" : "Add sources & collect"}
            </button>
          </div>

          {result && (
            <div className="alert" style={{ background: "var(--success-bg)", color: "var(--success-text)", marginTop: 12 }}>{result}</div>
          )}
          {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    </>
  );
}
