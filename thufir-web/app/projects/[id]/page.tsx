"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AreaChart, Area, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Request failed"); }
  return res.json();
}

const moodColor = (m: string) => m === "positive" ? "#1D9E75" : m === "negative" ? "#D85A30" : "#888780";
const moodBg = (m: string) => m === "positive" ? "#E1F5EE" : m === "negative" ? "#FAECE7" : "#F1EFE8";
const LINE_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#d4537e", "#7f77dd", "#d85a30"];
const CAT_COLORS: any = { politics: "#2a78d6", economy: "#1baf7a", "crime/safety": "#d85a30", "culture/carnival": "#d4537e", "weather/disaster": "#eda100", sports: "#7f77dd", community: "#888780" };


const BUBBLE_FILL: any = { positive: "#7A9A3C", negative: "#E8952F", neutral: "#D8D4C0" };
const BUBBLE_TEXT: any = { positive: "#1d2a08", negative: "#4a2c00", neutral: "#555248" };

function packBubbles(items: { r: number }[], W: number, H: number) {
  const placed: { x: number; y: number; r: number }[] = [];
  const cx = W / 2, cy = H / 2;
  for (const it of items) {
    let done = false;
    for (let ring = 0; ring < 220 && !done; ring++) {
      const rad = ring * 6;
      const steps = Math.max(1, Math.floor((2 * Math.PI * rad) / 14));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * 2 * Math.PI + ring * 0.5;
        const x = cx + rad * Math.cos(a), y = cy + rad * Math.sin(a) * 0.85;
        if (x - it.r < 4 || x + it.r > W - 4 || y - it.r < 4 || y + it.r > H - 4) continue;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + it.r + 3)) {
          placed.push({ x, y, r: it.r }); done = true; break;
        }
      }
    }
    if (!done) placed.push({ x: cx, y: cy, r: 0 });
  }
  return placed;
}

function WordBubbles({ topics }: { topics: any[] }) {
  const W = 860, H = 520;
  const items = topics.slice(0, 24).map((t: any) => ({
    word: String(t.label || "").split(/[\/·]| - /)[0].trim().split(" ").slice(0, 2).join(" ") || "topic",
    full: t.label, n: t.posts || 0, eng: t.engagement || 0,
    mood: t.mood || "neutral", category: t.category,
  }));
  const maxE = Math.max(1, ...items.map((i) => i.eng));
  const sized = items.map((i) => ({ ...i, r: 24 + 52 * Math.sqrt(i.eng / maxE) }))
    .sort((a, b) => b.r - a.r);
  const pos = packBubbles(sized, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {sized.map((b, i) => pos[i].r > 0 && (
        <g key={i}>
          <title>{b.full} — {b.n} posts · {b.eng.toLocaleString()} engagement · {b.mood}</title>
          <circle cx={pos[i].x} cy={pos[i].y} r={b.r} fill={BUBBLE_FILL[b.mood] || BUBBLE_FILL.neutral} opacity={0.92} />
          <text x={pos[i].x} y={pos[i].y - 3} textAnchor="middle"
            style={{ fontSize: Math.max(9, b.r / 3.4), fontWeight: 600, fill: BUBBLE_TEXT[b.mood] || "#444" }}>
            {b.word.length > Math.floor(b.r / 3.2) ? b.word.slice(0, Math.max(4, Math.floor(b.r / 3.2))) + "…" : b.word}
          </text>
          <text x={pos[i].x} y={pos[i].y + Math.max(10, b.r / 3)} textAnchor="middle"
            style={{ fontSize: Math.max(8, b.r / 4), fill: BUBBLE_TEXT[b.mood] || "#444" }}>
            {b.n}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Mood({ m }: { m: string }) {
  return <span style={{ fontSize: 11, fontWeight: 500, color: moodColor(m), background: moodBg(m), padding: "2px 8px", borderRadius: 10 }}>{m}</span>;
}
function Ext({ href, children }: { href: string; children: any }) {
  if (!href) return <span>{children}</span>;
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{children} ↗</a>;
}

export default function ProjectDetailPage() {
  const { user, loading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [view, setView] = useState<"dash" | "duel">("dash");
  const [project, setProject] = useState<any>(null);
  const [disc, setDisc] = useState<any>({ topics: [], domains: [], pages: [] });
  const [velo, setVelo] = useState<any>(null);
  const [ana, setAna] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [scouting, setScouting] = useState(false);
  const [reproc, setReproc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lbWin, setLbWin] = useState<"day" | "week" | "month">("week");
  const [duelA, setDuelA] = useState<string>("");
  const [duelB, setDuelB] = useState<string>("");
  const [urls, setUrls] = useState("https://stluciatimes.com/feed/\n");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [opsEvents, setOpsEvents] = useState<any[]>([]);
  const [folSeries, setFolSeries] = useState<any>(null);

  const analyze = useCallback(async (elena = false) => {
    setAnalyzing(true); setError(null);
    try {
      const r = await call(`/projects/${id}/analyze${elena ? "?elena=true" : ""}`, "POST");
      if (r.error) setError(r.error); else setAna(r);
    } catch (e: any) { setError(e.message || "Analysis failed."); }
    finally { setAnalyzing(false); }
  }, [id]);

  const loadMeta = useCallback(async () => {
    if (!id) return;
    try {
      const [p, d, v, o] = await Promise.all([
        call(`/projects/${id}`, "GET"),
        call(`/projects/${id}/discovered`, "GET").catch(() => ({ topics: [], domains: [], pages: [] })),
        call(`/projects/${id}/velocity/topics?window=30d`, "GET").catch(() => null),
        call(`/projects/${id}/ops?limit=5`, "GET").catch(() => ({ events: [] })),
      ]);
      setProject(p);
      setDisc({ topics: d.topics || [], domains: d.domains || [], pages: d.pages || [] });
      setVelo(v);
      setOpsEvents(o.events || []);
    } catch { setError("Couldn't load this project."); }
  }, [id]);

  useEffect(() => { if (user) { loadMeta(); analyze(); } }, [user, loadMeta, analyze]);

  useEffect(() => {
    const ps = ana?.page_series || [];
    if (ps.length && picked.size === 0) setPicked(new Set(ps.slice(0, 3).map((p: any) => p.entity_id)));
    const dl = ana?.duel || [];
    if (dl.length >= 2 && !duelA) { setDuelA(dl[0].entity_id); setDuelB(dl[1].entity_id); }
  }, [ana, picked.size, duelA]);

  useEffect(() => {
    if (!duelA || !duelB) return;
    call(`/projects/${id}/followers?ids=${encodeURIComponent(duelA)}&ids=${encodeURIComponent(duelB)}`, "GET")
      .then((r) => setFolSeries(r.series || null)).catch(() => setFolSeries(null));
  }, [id, duelA, duelB]);

  function togglePick(eid: string) {
    setPicked((cur) => { const n = new Set(cur); n.has(eid) ? n.delete(eid) : n.add(eid); return n; });
  }

  async function rebuildIndex() {
    setReproc(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/reprocess`, "POST");
      if (r.error) setError(`Reprocess: ${r.error}`);
      else setMsg(`Semantic index rebuilt: ${r.posts_reprocessed} posts → ${r.clusters} topics, ${r.clusters_named ?? 0} named (${r.embedding_provider}).`);
      await loadMeta();
    } catch (e: any) { setError(e.message || "Reprocess failed."); }
    finally { setReproc(false); }
  }

  async function scout() {
    setScouting(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/discover?expand=true`, "POST");
      if (r.error) setError(`Scout: ${r.error}`);
      else { const a = r.assessment || {}; setMsg(`Scout: ${a.topics_found} topics, ${a.domains_found} sources, ${a.pages_discovered} pages (${a.note}).`); }
      await loadMeta();
    } catch (e: any) { setError(e.message || "Scout failed."); }
    finally { setScouting(false); }
  }

  async function collect() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/sources`, "POST", { urls: urls.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("http")) });
      const note = r?.facebook?.error ? ` (Facebook: ${r.facebook.error})` : "";
      setMsg(`Collected ${r?.news?.new_items ?? 0} news, ${r?.facebook?.new_items ?? 0} FB posts${note}.`);
      await analyze();
    } catch (e: any) { setError(e.message || "Collection failed."); }
    finally { setBusy(false); }
  }

  if (loading || !user) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;

  const s = ana?.summary;
  const pulse = ana?.pulse;
  const board = (ana?.leaderboards?.[lbWin] ?? ana?.leaderboard ?? []) as any[];
  const maxEng = Math.max(1, ...board.map((e: any) => e.engagement || 0));
  const topClusters = (velo?.topics ?? []).filter((t: any) => !String(t.label || "").startsWith("(media")).slice(0, 8);
  const maxClusterEng = Math.max(1, ...topClusters.map((t: any) => t.engagement || 0));
  const A = (ana?.duel || []).find((d: any) => d.entity_id === duelA);
  const B = (ana?.duel || []).find((d: any) => d.entity_id === duelB);

  const pulseLabel = pulse ? `${pulse.intensity} day` + (velo?.topics?.[0]?.category ? ` · ${velo.topics[0].category}` : "") : null;

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <button className="btn btn-quiet" onClick={() => router.push("/projects")}>&larr; Projects</button>
          <div className="row" style={{ gap: 6 }}>
            <button className={view === "dash" ? "btn btn-primary" : "btn"} onClick={() => setView("dash")}>Dashboard</button>
            <button className={view === "duel" ? "btn btn-primary" : "btn"} onClick={() => setView("duel")}>Head-to-head</button>
          </div>
        </div>

        {project && (
          <div className="spread" style={{ marginBottom: 12, alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 20, marginBottom: 4 }}>{project.project.name}</h1>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="chip">{project.project.region_label}</span>
                {(project.project.languages || []).map((l: string) => <span key={l} className="chip">{l}</span>)}
                {pulseLabel && <span className="chip" style={{ background: pulse.intensity === "intense" ? "#FAECE7" : pulse.intensity === "calm" ? "#E1F5EE" : undefined, fontWeight: 500 }}>Pulse: {pulseLabel}</span>}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" disabled={analyzing} onClick={() => analyze(false)}>{analyzing ? "Analysing…" : "Re-analyse"}</button>
              <button className="btn btn-primary" disabled={analyzing} onClick={() => analyze(true)}>{analyzing ? "…" : "Deep tone (Elena)"}</button>
              <button className="btn" disabled={reproc} onClick={rebuildIndex}>{reproc ? "Rebuilding…" : "Rebuild semantic index"}</button>
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
        {msg && <div className="alert" style={{ background: "var(--success-bg)", color: "var(--success-text)", marginBottom: 12 }}>{msg}</div>}
        {analyzing && !ana && <div className="card" style={{ marginBottom: 14 }}><div className="muted" style={{ fontSize: 13 }}>Reading collected data and analysing…</div></div>}

        {/* ============ HEAD-TO-HEAD VIEW ============ */}
        {view === "duel" && ana?.duel?.length >= 2 && (
          <>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Head-to-head — all metrics, two pages in parallel</div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <select className="input" style={{ maxWidth: 320 }} value={duelA} onChange={(e) => setDuelA(e.target.value)}>
                  {ana.duel.map((d: any) => <option key={d.entity_id} value={d.entity_id}>{d.page}</option>)}
                </select>
                <span className="muted" style={{ alignSelf: "center" }}>vs</span>
                <select className="input" style={{ maxWidth: 320 }} value={duelB} onChange={(e) => setDuelB(e.target.value)}>
                  {ana.duel.map((d: any) => <option key={d.entity_id} value={d.entity_id}>{d.page}</option>)}
                </select>
              </div>
            </div>

            {A && B && (
              <>
                <div className="card" style={{ marginBottom: 14 }}>
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
                        <th style={{ textAlign: "left", padding: "6px 4px" }} className="muted">Metric</th>
                        <th style={{ textAlign: "right", padding: "6px 4px", color: LINE_COLORS[0] }}><Ext href={A.page_url}>{A.page}</Ext></th>
                        <th style={{ textAlign: "right", padding: "6px 4px", color: LINE_COLORS[3] }}><Ext href={B.page_url}>{B.page}</Ext></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Posts (sampled)", A.posts, B.posts],
                        ["Reactions", A.likes, B.likes],
                        ["Shares", A.shares, B.shares],
                        ["Video views", A.views, B.views],
                        ["Total engagement", A.engagement, B.engagement],
                        ["Engagement / post", A.eng_per_post, B.eng_per_post],
                      ].map(([label, a, b]: any) => (
                        <tr key={label} style={{ borderBottom: "0.5px solid var(--border-soft)" }}>
                          <td style={{ padding: "6px 4px" }}>{label}</td>
                          <td style={{ textAlign: "right", padding: "6px 4px", fontWeight: a >= b ? 600 : 400 }}>{Number(a).toLocaleString()}</td>
                          <td style={{ textAlign: "right", padding: "6px 4px", fontWeight: b >= a ? 600 : 400 }}>{Number(b).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ padding: "6px 4px" }}>Tone</td>
                        <td style={{ textAlign: "right", padding: "6px 4px" }}><Mood m={A.mood} /></td>
                        <td style={{ textAlign: "right", padding: "6px 4px" }}><Mood m={B.mood} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Engagement by day</div>
                  <div style={{ width: "100%", height: 200 }}>
                    <ResponsiveContainer>
                      <LineChart data={(() => {
                        const days = Array.from(new Set([...A.series, ...B.series].map((x: any) => x.day))).sort();
                        return days.map((day) => ({
                          day,
                          [A.page]: A.series.find((x: any) => x.day === day)?.eng ?? 0,
                          [B.page]: B.series.find((x: any) => x.day === day)?.eng ?? 0,
                        }));
                      })()} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(d) => d.slice(5)} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey={A.page} stroke={LINE_COLORS[0]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey={B.page} stroke={LINE_COLORS[3]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[A, B].map((P: any, i: number) => (
                    <div key={P.entity_id} className="card">
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Best post — <span style={{ color: LINE_COLORS[i === 0 ? 0 : 3] }}>{P.page}</span></div>
                      {P.best_post ? (
                        <>
                          <div style={{ fontSize: 13, marginBottom: 6 }}>{P.best_post.text || "(no text)"}</div>
                          <div className="spread" style={{ fontSize: 12 }}>
                            <span className="muted">{P.best_post.engagement.toLocaleString()} eng</span>
                            <Ext href={P.best_post.url}>open post</Ext>
                          </div>
                        </>
                      ) : <div className="muted" style={{ fontSize: 12 }}>—</div>}
                    </div>
                  ))}
                </div>

                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Follower trend</div>
                  {(() => {
                    const sa = folSeries?.[duelA] || [], sb = folSeries?.[duelB] || [];
                    if (sa.length + sb.length === 0) return <div className="muted" style={{ fontSize: 12 }}>Recording begins with the autonomous daily cycle — each day adds a point; the trend appears after the first few days of live collection.</div>;
                    const days = Array.from(new Set([...sa, ...sb].map((x: any) => x.ts.slice(0, 10)))).sort();
                    const data = days.map((day) => ({
                      day,
                      [A.page]: sa.filter((x: any) => x.ts.startsWith(day)).slice(-1)[0]?.followers ?? null,
                      [B.page]: sb.filter((x: any) => x.ts.startsWith(day)).slice(-1)[0]?.followers ?? null,
                    }));
                    return (
                      <div style={{ width: "100%", height: 180 }}>
                        <ResponsiveContainer>
                          <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(d) => d.slice(5)} />
                            <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} domain={["auto", "auto"]} />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey={A.page} stroke={LINE_COLORS[0]} strokeWidth={2} dot connectNulls />
                            <Line type="monotone" dataKey={B.page} stroke={LINE_COLORS[3]} strokeWidth={2} dot connectNulls />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </>
        )}

        {/* ============ DASHBOARD VIEW ============ */}
        {view === "dash" && s && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Overall mood</div>
                <div style={{ fontSize: 22, fontWeight: 500, color: moodColor(s.overall_mood) }}>{s.overall_mood}</div>
                <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{s.tone_engine === "elena-gemini" ? "Elena · Gemini" : "keyword tone"}</div>
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Posts analysed</div>
                <div style={{ fontSize: 22, fontWeight: 500 }}>{s.posts_analysed}</div>
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Total engagement</div>
                <div style={{ fontSize: 22, fontWeight: 500 }}>{s.total_engagement.toLocaleString()}</div>
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Pages · topics</div>
                <div style={{ fontSize: 22, fontWeight: 500 }}>{s.pages} · {s.topics}</div>
              </div>
            </div>

            {/* Topic bubbles */}
            {topClusters.length > 2 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="spread" style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>What one topic best describes the market?</span>
                  <div className="row" style={{ gap: 8, fontSize: 11 }}>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#7A9A3C", marginRight: 4 }} />Positive</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#E8952F", marginRight: 4 }} />Negative</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 5, background: "#D8D4C0", marginRight: 4 }} />Neutral</span>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Bubble size = engagement · number = posts · hover for the full topic.</div>
                <WordBubbles topics={(velo?.topics ?? []).filter((t: any) => !String(t.label || "").startsWith("(media"))} />
              </div>
            )}

            {/* Engagement clusters (replaces engagement-over-time) */}
            {topClusters.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="spread" style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>Engagement clusters</span>
                  {velo?.network_integrity != null && <span className="chip">Network integrity {Math.round(velo.network_integrity * 100)}%</span>}
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>The topics pulling the most engagement right now.</div>
                <div className="stack" style={{ gap: 8 }}>
                  {topClusters.map((t: any) => (
                    <div key={t.topic_cluster_id}>
                      <div className="spread" style={{ fontSize: 13, marginBottom: 2 }}>
                        <span style={{ fontWeight: 500 }}>
                          {t.label}
                          {t.category && <span style={{ marginLeft: 6, fontSize: 10, color: CAT_COLORS[t.category] || "var(--muted)", border: `1px solid ${CAT_COLORS[t.category] || "var(--border-soft)"}`, padding: "1px 6px", borderRadius: 8 }}>{t.category}</span>}
                        </span>
                        <span className="muted">{(t.engagement || 0).toLocaleString()} eng</span>
                      </div>
                      <div style={{ height: 7, background: "var(--border-soft)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round(((t.engagement || 0) / maxClusterEng) * 100)}%`, height: "100%", background: CAT_COLORS[t.category] || "var(--accent)" }} />
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.posts} posts · {t.pages_talking} pages talking</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard with window toggle */}
            {board.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="spread" style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>Who&apos;s winning attention</span>
                  <div className="row" style={{ gap: 4 }}>
                    {(["day", "week", "month"] as const).map((w) => (
                      <button key={w} className={lbWin === w ? "btn btn-primary" : "btn btn-quiet"} style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setLbWin(w)}>{w === "day" ? "Today" : w === "week" ? "This week" : "This month"}</button>
                    ))}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Top 10 pages by engagement in the window, with each page&apos;s best post.</div>
                <div className="stack" style={{ gap: 12 }}>
                  {board.map((e: any, i: number) => (
                    <div key={e.entity_id || e.page}>
                      <div className="spread" style={{ fontSize: 13, marginBottom: 3 }}>
                        <span style={{ fontWeight: 500 }}>{i + 1}. <Ext href={e.page_url}>{e.page || e.display_name}</Ext> &nbsp;<Mood m={e.mood} /></span>
                        <span className="muted">{e.engagement.toLocaleString()} eng · {(e.share_of_voice_pct ?? 0).toFixed(1)}% SoV</span>
                      </div>
                      <div style={{ height: 8, background: "var(--border-soft)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((e.engagement / maxEng) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{e.likes.toLocaleString()} reactions · {e.shares.toLocaleString()} shares · {e.views.toLocaleString()} views</div>
                      {e.best_post && (
                        <div style={{ fontSize: 12, marginTop: 4, paddingLeft: 10, borderLeft: "2px solid var(--border-soft)" }}>
                          <span className="muted">best: </span>{e.best_post.text || "(no text)"} <span className="muted">· {e.best_post.engagement.toLocaleString()} eng · </span><Ext href={e.best_post.url}>open</Ext>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compare pages (multi) */}
            {ana.page_series?.length > 1 && (() => {
              const chosen = ana.page_series.filter((p: any) => picked.has(p.entity_id));
              const days = Array.from(new Set(chosen.flatMap((p: any) => p.series.map((x: any) => x.day)))).sort() as string[];
              const data = days.map((day) => {
                const row: any = { day };
                chosen.forEach((p: any) => { const pt = p.series.find((x: any) => x.day === day); row[p.page] = pt ? pt.eng : 0; });
                return row;
              });
              return (
                <div className="card" style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>Compare pages</div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Pick pages to put head-to-head on engagement over time. For a full two-page duel, use the Head-to-head tab.</div>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {ana.page_series.slice(0, 12).map((p: any) => {
                      const on = picked.has(p.entity_id);
                      const idx = chosen.findIndex((c: any) => c.entity_id === p.entity_id);
                      return (
                        <button key={p.entity_id} onClick={() => togglePick(p.entity_id)}
                          style={{ fontSize: 12, padding: "4px 10px", borderRadius: 14, cursor: "pointer",
                            border: on ? `1.5px solid ${LINE_COLORS[idx % LINE_COLORS.length]}` : "1px solid var(--border-soft)",
                            background: on ? "var(--surface-1, #f7f7f5)" : "transparent",
                            color: on ? LINE_COLORS[idx % LINE_COLORS.length] : "var(--muted)", fontWeight: on ? 500 : 400 }}>
                          {p.page}
                        </button>
                      );
                    })}
                  </div>
                  {chosen.length > 0 && data.length > 1 && (
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(d) => d.slice(5)} />
                          <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {chosen.map((p: any, i: number) => (
                            <Line key={p.entity_id} type="monotone" dataKey={p.page} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* What the market is talking about (named topics + stats) */}
            {velo?.topics?.length > 0 ? (
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>What the market is talking about</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Semantic topics with real names and intensity data.</div>
                <div className="stack" style={{ gap: 8 }}>
                  {velo.topics.slice(0, 12).map((t: any) => (
                    <div key={t.topic_cluster_id} style={{ borderBottom: "0.5px solid var(--border-soft)", paddingBottom: 6 }}>
                      <div className="spread" style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>
                          {t.label}
                          {t.category && <span style={{ marginLeft: 6, fontSize: 10, color: CAT_COLORS[t.category] || "var(--muted)" }}>· {t.category}</span>}
                          {t.velocity_delta_pct != null && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: t.velocity_delta_pct >= 0 ? "#1D9E75" : "#D85A30" }}>
                              {t.velocity_delta_pct >= 0 ? "▲" : "▼"} {Math.abs(t.velocity_delta_pct)}%
                            </span>
                          )}
                        </span>
                        <span className="muted">{t.posts} posts · {t.pages_talking} pages · {(t.engagement || 0).toLocaleString()} eng</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : ana.topics?.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>What the market is talking about</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Hashtag grouping (fallback). Click &quot;Rebuild semantic index&quot; above.</div>
                <div className="stack" style={{ gap: 8 }}>
                  {ana.topics.map((t: any) => (
                    <div key={t.topic} className="spread" style={{ fontSize: 13, borderBottom: "0.5px solid var(--border-soft)", paddingBottom: 6 }}>
                      <span>#{t.topic} &nbsp;<Mood m={t.mood} /></span>
                      <span className="muted">{t.engagement.toLocaleString()} eng</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top posts */}
            {ana.top_posts?.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 10 }}>Top posts by engagement</div>
                <div className="stack" style={{ gap: 12 }}>
                  {ana.top_posts.map((p: any, i: number) => (
                    <div key={i} style={{ borderBottom: "0.5px solid var(--border-soft)", paddingBottom: 10 }}>
                      <div className="spread" style={{ fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{p.page} &nbsp;<Mood m={p.mood} /></span>
                        <span className="muted">{p.day.slice(5)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2, #444)", marginBottom: 4 }}>{p.text || <span className="muted">(no text)</span>}</div>
                      <div className="spread" style={{ fontSize: 11 }}>
                        <span className="muted">{p.likes.toLocaleString()} reactions · {p.shares.toLocaleString()} shares · {p.views.toLocaleString()} views · {p.engagement.toLocaleString()} total</span>
                        <Ext href={p.url}>open post</Ext>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market scout */}
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="spread" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>Market scout</span>
                <button className="btn" disabled={scouting} onClick={scout}>{scouting ? "Scouting…" : "Scout the market"}</button>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Autonomous: runs daily, auto-adds discovered pages and hashtags to the research pool, budget-guarded. Manual run anytime with the button.</div>
              {opsEvents.length > 0 && (
                <div style={{ fontSize: 11, marginBottom: disc.topics.length ? 12 : 0, padding: "6px 10px", background: "var(--surface-1, #f7f7f5)", borderRadius: 6 }}>
                  {opsEvents.slice(0, 3).map((e: any, i: number) => (
                    <div key={i} className="muted">{e.ts.slice(5, 16).replace("T", " ")} · {e.kind}: {e.detail}</div>
                  ))}
                </div>
              )}
              {disc.topics.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Dominant topics</div>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{disc.topics.slice(0, 18).map((t: any) => <span key={t.ref} className="chip">#{t.ref} <span className="muted">· {t.co_count}</span></span>)}</div>
                </div>
              )}
              {disc.domains.length > 0 && (
                <div><div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Shared sources</div>
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{disc.domains.slice(0, 12).map((d: any) => <span key={d.ref} className="chip">{d.ref} <span className="muted">· {d.co_count}</span></span>)}</div>
                </div>
              )}
            </div>

            {/* Sources */}
            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Sources</div>
              <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>News/RSS feeds work anytime. Facebook collection needs Apify credit.</p>
              <textarea className="input" style={{ minHeight: 90, fontFamily: "monospace", fontSize: 12, resize: "vertical" }} value={urls} onChange={(e) => setUrls(e.target.value)} />
              <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={collect}>{busy ? "Collecting…" : "Add sources & collect"}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
