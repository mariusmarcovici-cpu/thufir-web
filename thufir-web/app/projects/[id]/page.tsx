"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AreaChart, Area, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRequireAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";
import TopBar from "@/components/TopBar";
import { TrendIcon, VelocityIcon, NetworkIcon } from "@/components/BrandAssets";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function call(path: string, method: "GET" | "POST" | "PUT", body?: any) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Request failed"); }
  return res.json();
}

const moodColor = (m: string) => m === "positive" ? "#8FBFA6" : m === "negative" ? "#C98A8A" : "#8B949E";
const moodBg = (m: string) => m === "positive" ? "rgba(66,122,91,0.16)" : m === "negative" ? "rgba(158,59,59,0.16)" : "rgba(139,148,158,0.12)";
const LINE_COLORS = ["#C2A34F", "#4A6B8C", "#427A5B", "#B89340", "#9E3B3B", "#8B949E"];
const CAT_COLORS: any = { politics: "#4A6B8C", economy: "#427A5B", "crime/safety": "#9E3B3B", "culture/carnival": "#C2A34F", "weather/disaster": "#B89340", sports: "#6E8CA0", community: "#8B949E" };
const PAGE_COLORS = ["#C2A34F", "#4A6B8C", "#427A5B", "#9E3B3B", "#B89340", "#6E8FB0", "#8B949E", "#A8734F", "#5B8A6E", "#7E6BA8", "#C99A9A", "#9AB0C9"];
const PANEL_HEAD: any = { display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", color: "var(--text-2)" };
const MONO = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const TOOLTIP_STYLE = { contentStyle: { background: "#0D0E12", border: "1px solid #C2A34F", borderRadius: 2, fontFamily: "var(--font-mono)", fontSize: 11, color: "#E4E7EB" }, labelStyle: { color: "#8B949E", fontFamily: "var(--font-mono)" }, itemStyle: { color: "#E4E7EB" } } as const;


const BUBBLE_FILL: any = { positive: "rgba(66,122,91,0.20)", negative: "rgba(158,59,59,0.20)", neutral: "rgba(139,148,158,0.10)" };
const BUBBLE_STROKE: any = { positive: "#427A5B", negative: "#9E3B3B", neutral: "#3A3E47" };
const BUBBLE_TEXT: any = { positive: "#E4E7EB", negative: "#E4E7EB", neutral: "#B8BEC7" };

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
          <circle cx={pos[i].x} cy={pos[i].y} r={b.r} fill={BUBBLE_FILL[b.mood] || BUBBLE_FILL.neutral} stroke={BUBBLE_STROKE[b.mood] || BUBBLE_STROKE.neutral} strokeWidth={1.5} />
          <text x={pos[i].x} y={pos[i].y - 3} textAnchor="middle"
            style={{ fontSize: Math.max(9, b.r / 3.4), fontWeight: 600, fill: BUBBLE_TEXT[b.mood] || "#B8BEC7" }}>
            {b.word.length > Math.floor(b.r / 3.2) ? b.word.slice(0, Math.max(4, Math.floor(b.r / 3.2))) + "…" : b.word}
          </text>
          <text x={pos[i].x} y={pos[i].y + Math.max(10, b.r / 3)} textAnchor="middle"
            style={{ fontSize: Math.max(8, b.r / 4), fill: "#8B949E", fontFamily: "var(--font-mono)" }}>
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
  const idValid = !!id && id !== "undefined" && id !== "null";

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
  const [rosterEdit, setRosterEdit] = useState(false);
  const [rosterDraft, setRosterDraft] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState<string>("");
  const [catEdit, setCatEdit] = useState(false);
  const [kindDraft, setKindDraft] = useState<Record<string, string>>({});

  const analyze = useCallback(async (elena = false, category = "") => {
    if (!idValid) return;
    setAnalyzing(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (elena) q.set("elena", "true");
      if (category) q.set("category", category);
      const r = await call(`/projects/${id}/analyze${q.toString() ? "?" + q.toString() : ""}`, "POST");
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

  useEffect(() => { if (user && idValid) { loadMeta(); analyze(); } }, [user, idValid, loadMeta, analyze]);

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

  async function downloadReport(kind: "page" | "compare") {
    if (!idValid || !duelA) return;
    setMsg(null); setError(null);
    try {
      const token = getToken();
      const path = kind === "page"
        ? `/projects/${id}/report/page?entity_id=${encodeURIComponent(duelA)}`
        : `/projects/${id}/report/compare?a=${encodeURIComponent(duelA)}&b=${encodeURIComponent(duelB)}`;
      const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || "Report failed"); }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const fname = /filename="([^"]+)"/.exec(cd)?.[1] || `thufir-report-${Date.now()}.pdf`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname; a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) { setError(e.message || "Couldn't generate the report."); }
  }

  async function saveKinds() {
    if (!idValid) return;
    try {
      await call(`/projects/${id}/anchor-kinds`, "PUT", { kinds: kindDraft });
      setCatEdit(false);
      setMsg("Source categories saved.");
      await loadMeta();
    } catch (e: any) { setError(e.message || "Couldn't save categories."); }
  }

  async function saveRoster() {
    if (!idValid) return;
    try {
      await call(`/projects/${id}/compare-roster`, "PUT", { entity_ids: Array.from(rosterDraft) });
      setRosterEdit(false);
      await loadMeta();
      setMsg("Comparison set saved.");
    } catch (e: any) { setError(e.message || "Couldn't save the comparison set."); }
  }

  function togglePick(eid: string) {
    setPicked((cur) => { const n = new Set(cur); n.has(eid) ? n.delete(eid) : n.add(eid); return n; });
  }

  async function rebuildIndex() {
    if (!idValid) return;
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
    if (!idValid) return;
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
    if (!idValid) return;
    if (!window.confirm("This runs a fresh paid Apify scrape. The daily scheduler already collects once a day automatically — only collect manually if you need up-to-the-minute data. Continue?")) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/sources`, "POST", { urls: urls.split("\n") });
      const note = r?.facebook?.error ? ` (Facebook: ${r.facebook.error})` : "";
      const src = r?.sources ? ` Sources: ${r.sources.found_in_paste} found, ${r.sources.newly_added} new${r.sources.categorized ? `, ${r.sources.categorized} auto-categorized` : ""}.` : "";
      setMsg(`Collected ${r?.news?.new_items ?? 0} news, ${r?.facebook?.new_items ?? 0} FB posts${note}.${src}`);
      await analyze();
    } catch (e: any) { setError(e.message || "Collection failed."); }
    finally { setBusy(false); }
  }

  if (loading || !user) return <div className="center-screen"><div className="spinner" aria-label="Loading" /></div>;
  if (!idValid) return (
    <><TopBar /><div className="console"><div className="console-body" style={{ maxWidth: 640 }}>
      <div className="panel"><div className="panel-body" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Project not found</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>This link is missing a valid project ID. Head back and pick your project from the list.</div>
        <button className="btn btn-primary" onClick={() => router.push("/projects")}>&larr; BACK TO PROJECTS</button>
      </div></div>
    </div></div></>
  );

  const s = ana?.summary;
  const pulse = ana?.pulse;
  const board = (ana?.leaderboards?.[lbWin] ?? ana?.leaderboard ?? []) as any[];
  const maxEng = Math.max(1, ...board.map((e: any) => e.engagement || 0));
  const allTopics = (velo?.topics ?? []).filter((t: any) => !String(t.label || "").startsWith("(media"));
  const topClusters = allTopics.slice(0, 8);
  const maxClusterEng = Math.max(1, ...topClusters.map((t: any) => t.engagement || 0));
  const A = (ana?.duel || []).find((d: any) => d.entity_id === duelA);
  const B = (ana?.duel || []).find((d: any) => d.entity_id === duelB);
  const pulseVal = pulse ? `${pulse.intensity}${velo?.topics?.[0]?.category ? " · " + velo.topics[0].category : ""}` : null;
  const pulseSwatch = pulse ? (pulse.intensity === "intense" ? "#9E3B3B" : pulse.intensity === "calm" ? "#427A5B" : "#8B949E") : "#8B949E";
  const pageColor = (eid: string) => {
    const idx = (ana?.page_series || []).findIndex((p: any) => p.entity_id === eid);
    return PAGE_COLORS[(idx >= 0 ? idx : 0) % PAGE_COLORS.length];
  };

  return (
    <>
      <TopBar />
      <div className="console">
        {project && (
          <div className="console-head">
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20 }}>{project.project.name}</h1>
              <span className="chip chip-accent">{String(project.project.region_label || "").toUpperCase()}</span>
              {(project.project.languages || []).map((l: string) => <span key={l} className="chip">{l.toUpperCase()}</span>)}
              {pulseVal && (
                <span className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--console)" }}>
                  <span style={{ fontSize: 9, letterSpacing: 1 }}>MARKET PULSE</span>
                  <span style={{ width: 6, height: 6, background: pulseSwatch, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "var(--text)" }}>{pulseVal}</span>
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="seg">
                <button data-on={view === "dash"} onClick={() => setView("dash")}>DASHBOARD</button>
                <button data-on={view === "duel"} onClick={() => setView("duel")}>HEAD-TO-HEAD</button>
              </div>
              <button className="btn btn-primary" disabled={analyzing} onClick={() => analyze(false)}>{analyzing ? "ANALYSING…" : "Re-analyse"}</button>
              <button className="btn" disabled={analyzing} onClick={() => analyze(true)}>Deep tone (Elena)</button>
              <button className="btn" disabled={reproc} onClick={rebuildIndex}>{reproc ? "Rebuilding…" : "Rebuild semantic index"}</button>
            </div>
          </div>
        )}

        <div className="console-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {msg && <div className="alert" style={{ background: "var(--success-bg)", color: "var(--success-text)", borderColor: "rgba(66,122,91,.45)" }}>{msg}</div>}
          {analyzing && !ana && <div className="panel"><div className="panel-body muted" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>Reading collected data and analysing…</div></div>}

          {/* ================= HEAD-TO-HEAD ================= */}
          {view === "duel" && ana?.duel?.length >= 2 && (
            <>
              <div className="ops-row" style={{ alignItems: "center" }}>
                <div className="panel" style={{ flex: 1 }}>
                  <div className="panel-body" style={{ padding: "12px 16px" }}>
                    <div className="stat-label">Page A</div>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ width: 10, height: 10, background: "#C2A34F", flexShrink: 0 }} />
                      <select className="select" style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font)", border: "none", padding: 0, background: "transparent" }} value={duelA} onChange={(e) => setDuelA(e.target.value)}>
                        {ana.duel.map((d: any) => <option key={d.entity_id} value={d.entity_id}>{d.page}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: 2, color: "var(--muted)", padding: "0 4px" }}>VS</div>
                <div className="panel" style={{ flex: 1 }}>
                  <div className="panel-body" style={{ padding: "12px 16px" }}>
                    <div className="stat-label">Page B</div>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ width: 10, height: 10, background: "#4A6B8C", flexShrink: 0 }} />
                      <select className="select" style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font)", border: "none", padding: 0, background: "transparent" }} value={duelB} onChange={(e) => setDuelB(e.target.value)}>
                        {ana.duel.map((d: any) => <option key={d.entity_id} value={d.entity_id}>{d.page}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {A && B && (
                <>
                  <div className="row" style={{ gap: 10 }}>
                    <button className="btn" onClick={() => downloadReport("page")}>EXPORT PAGE A REPORT (PDF)</button>
                    <button className="btn btn-primary" onClick={() => downloadReport("compare")}>EXPORT COMPARISON (PDF)</button>
                  </div>
                  <div className="ops-row">
                    <div className="panel" style={{ flex: 38 }}>
                      <div className="panel-head"><TrendIcon />Parallel metrics</div>
                      <div className="panel-body" style={{ padding: 0 }}>
                        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--carbon)" }}>
                              <th style={{ textAlign: "left", padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1.5, color: "var(--muted)", fontWeight: 500 }}>METRIC</th>
                              <th style={{ textAlign: "right", padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1, color: "#C2A34F", fontWeight: 600 }}><Ext href={A.page_url}>{A.page}</Ext></th>
                              <th style={{ textAlign: "right", padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1, color: "#4A6B8C", fontWeight: 600 }}><Ext href={B.page_url}>{B.page}</Ext></th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["Posts sampled", A.posts, B.posts],
                              ["Reactions", A.likes, B.likes],
                              ["Shares", A.shares, B.shares],
                              ["Video views", A.views, B.views],
                              ["Total engagement", A.engagement, B.engagement],
                              ["Engagement / post", A.eng_per_post, B.eng_per_post],
                            ].map(([label, a, b]: any) => (
                              <tr key={label} style={{ borderBottom: "1px solid var(--rowline)" }}>
                                <td style={{ padding: "9px 16px", fontSize: 12 }}>{label}</td>
                                <td style={{ ...MONO, textAlign: "right", padding: "9px 16px", fontSize: 13, fontWeight: a >= b ? 700 : 400, color: a >= b ? "var(--text)" : "var(--muted)" }}>{Number(a).toLocaleString()}</td>
                                <td style={{ ...MONO, textAlign: "right", padding: "9px 16px", fontSize: 13, fontWeight: b >= a ? 700 : 400, color: b >= a ? "var(--text)" : "var(--muted)" }}>{Number(b).toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr>
                              <td style={{ padding: "9px 16px", fontSize: 12 }}>Tone</td>
                              <td style={{ textAlign: "right", padding: "9px 16px" }}><Mood m={A.mood} /></td>
                              <td style={{ textAlign: "right", padding: "9px 16px" }}><Mood m={B.mood} /></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ flex: 62, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                      <div className="panel">
                        <div className="panel-head"><VelocityIcon />Daily engagement
                          <span className="ph-right" style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>
                            <span style={{ color: "#C2A34F" }}>— {A.page}</span><span style={{ color: "#4A6B8C" }}>— {B.page}</span>
                          </span>
                        </div>
                        <div className="panel-body">
                          <div style={{ width: "100%", height: 190 }}>
                            <ResponsiveContainer>
                              <LineChart data={(() => {
                                const days = Array.from(new Set([...A.series, ...B.series].map((x: any) => x.day))).sort();
                                return days.map((day) => ({
                                  day,
                                  [A.page]: A.series.find((x: any) => x.day === day)?.eng ?? 0,
                                  [B.page]: B.series.find((x: any) => x.day === day)?.eng ?? 0,
                                }));
                              })()} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 4" stroke="var(--carbon)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={(d) => d.slice(5)} />
                                <YAxis tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} allowDecimals={false} />
                                <Tooltip {...TOOLTIP_STYLE} />
                                <Line type="monotone" dataKey={A.page} stroke="#C2A34F" strokeWidth={1.6} dot={false} />
                                <Line type="monotone" dataKey={B.page} stroke="#4A6B8C" strokeWidth={1.6} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                      <div className="panel">
                        <div className="panel-head"><VelocityIcon />Follower trend</div>
                        <div className="panel-body">
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
                              <div style={{ width: "100%", height: 160 }}>
                                <ResponsiveContainer>
                                  <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 4" stroke="var(--carbon)" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={(d) => d.slice(5)} />
                                    <YAxis tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} domain={["auto", "auto"]} />
                                    <Tooltip {...TOOLTIP_STYLE} />
                                    <Line type="monotone" dataKey={A.page} stroke="#C2A34F" strokeWidth={1.6} dot connectNulls />
                                    <Line type="monotone" dataKey={B.page} stroke="#4A6B8C" strokeWidth={1.6} dot connectNulls />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ops-row">
                    {[{ P: A, c: "#C2A34F" }, { P: B, c: "#4A6B8C" }].map(({ P, c }) => (
                      <div key={P.entity_id} className="panel" style={{ flex: 1, borderTop: `2px solid ${c}` }}>
                        <div className="panel-head">Best post · {P.page}</div>
                        <div className="panel-body">
                          {P.best_post ? (
                            <>
                              <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>{P.best_post.text || "(no text)"}</div>
                              <div className="spread" style={{ fontSize: 11 }}>
                                <span style={{ ...MONO, color: c }}>{P.best_post.engagement.toLocaleString()} total</span>
                                <Ext href={P.best_post.url}>open post</Ext>
                              </div>
                            </>
                          ) : <div className="muted" style={{ fontSize: 12 }}>—</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ================= DASHBOARD ================= */}
          {view === "dash" && s && (
            <>
              {/* Category filter */}
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {[["", "ALL"], ["media", "MEDIA"], ["group", "GROUPS"], ["politician", "POLITICIANS"], ["government", "GOVERNMENT"], ["institution", "INSTITUTIONS"]].map(([v, lbl]) => (
                  <button key={v} className="seg-chip" data-on={cat === v}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, padding: "5px 12px", cursor: "pointer", borderRadius: 0,
                      border: `1px solid ${cat === v ? "var(--amber)" : "var(--carbon)"}`,
                      background: cat === v ? "var(--accent-bg)" : "transparent",
                      color: cat === v ? "var(--amber)" : "var(--muted)" }}
                    onClick={() => { setCat(v); analyze(false, v); }}>
                    {lbl}
                  </button>
                ))}
                {cat && <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>— leaderboard, posts &amp; stats filtered to this category; topic map stays market-wide</span>}
              </div>

              {/* Row 1 — summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--carbon)", border: "1px solid var(--carbon)" }}>
                  <div style={{ background: "var(--console)", padding: "18px 20px" }}>
                    <div className="stat-label" style={{ marginBottom: 10 }}>Overall mood</div>
                    <div className="stat-value" style={{ color: moodColor(s.overall_mood) }}>{s.overall_mood}</div>
                    <div className="stat-sub">{s.tone_engine === "elena-gemini" ? "Elena · Gemini" : "keyword tone"}</div>
                  </div>
                  <div style={{ background: "var(--console)", padding: "18px 20px" }}>
                    <div className="stat-label" style={{ marginBottom: 10 }}>Posts analysed</div>
                    <div className="stat-value">{s.posts_analysed}</div>
                    <div className="stat-sub">across {s.pages} pages</div>
                  </div>
                  <div style={{ background: "var(--console)", padding: "18px 20px" }}>
                    <div className="stat-label" style={{ marginBottom: 10 }}>Total engagement</div>
                    <div className="stat-value">{s.total_engagement.toLocaleString()}</div>
                    <div className="stat-sub">reactions · shares · views</div>
                  </div>
                  <div style={{ background: "var(--console)", padding: "18px 20px" }}>
                    <div className="stat-label" style={{ marginBottom: 10 }}>Pages · topics</div>
                    <div className="stat-value">{s.pages} · {s.topics}</div>
                    <div className="stat-sub">semantic index</div>
                  </div>
              </div>

              {/* Row 2 — topic map · clusters · scout */}
              <div className="ops-stack">
                <div className="panel" style={{ flex: 40 }}>
                  <div className="panel-head"><TrendIcon />Topic map
                    <span className="ph-right muted" style={{ fontSize: 12, fontFamily: "var(--font)", letterSpacing: 0 }}>What one topic best describes the market?</span>
                  </div>
                  <div className="panel-body" style={{ padding: 8 }}>
                    {allTopics.length > 2 ? <WordBubbles topics={allTopics} /> : <div className="muted" style={{ fontSize: 12 }}>Run &quot;Rebuild semantic index&quot; to build the map.</div>}
                  </div>
                  <div style={{ display: "flex", gap: 18, padding: "10px 16px", borderTop: "1px solid var(--carbon)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: "var(--muted)" }}>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#427A5B", marginRight: 6 }} />POSITIVE</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#9E3B3B", marginRight: 6 }} />NEGATIVE</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#3A3E47", marginRight: 6 }} />NEUTRAL</span>
                  </div>
                </div>

                <div className="panel" style={{ flex: 33 }}>
                  <div className="panel-head"><NetworkIcon />Engagement clusters
                    {velo?.network_integrity != null && <span className="ph-right"><span className="chip" style={{ color: "#8FBFA6" }}>NETWORK INTEGRITY {Math.round(velo.network_integrity * 100)}%</span></span>}
                  </div>
                  <div className="panel-body" style={{ padding: "6px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    {topClusters.map((t: any) => (
                      <div key={t.topic_cluster_id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rowline)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
                            {t.category && <span style={{ ...MONO, fontSize: 9, letterSpacing: 0.5, color: "var(--muted)", border: "1px solid var(--carbon)", padding: "1px 5px", whiteSpace: "nowrap" }}>{t.category}</span>}
                          </div>
                          <span style={{ ...MONO, fontSize: 13, color: "var(--amber)", whiteSpace: "nowrap" }}>{(t.engagement || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ height: 4, background: "var(--void)", marginBottom: 5 }}>
                          <div style={{ width: `${Math.round(((t.engagement || 0) / maxClusterEng) * 100)}%`, height: "100%", background: "var(--amber)" }} />
                        </div>
                        <div style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{t.posts} posts · {t.pages_talking} pages talking</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ flex: 27 }}>
                  <div className="panel-head"><NetworkIcon />Market scout</div>
                  <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button className="btn btn-primary" style={{ width: "100%" }} disabled={scouting} onClick={scout}>{scouting ? "SCOUTING…" : "Scout the market"}</button>
                    <div className="muted" style={{ fontSize: 11 }}>Runs daily · auto-adds pages &amp; hashtags · budget-guarded.</div>
                    {opsEvents.length > 0 && (
                      <div>
                        <div className="stat-label">Ops feed</div>
                        <div style={{ background: "var(--void)", border: "1px solid var(--carbon)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                          {opsEvents.slice(0, 3).map((e: any, i: number) => (
                            <div key={i} className="muted" style={{ ...MONO, fontSize: 10 }}>{e.ts.slice(5, 16).replace("T", " ")} · {e.kind}: {e.detail}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {disc.topics.length > 0 && (
                      <div>
                        <div className="stat-label">Hashtags</div>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{disc.topics.slice(0, 8).map((t: any) => <span key={t.ref} className="chip">#{t.ref} <span style={{ color: "var(--amber)" }}>·{t.co_count}</span></span>)}</div>
                      </div>
                    )}
                    {disc.domains.length > 0 && (
                      <div>
                        <div className="stat-label">Sources</div>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{disc.domains.slice(0, 6).map((d: any) => <span key={d.ref} className="chip" style={{ color: "#6E8FB0" }}>{d.ref} ·{d.co_count}</span>)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3 — leaderboard · compare */}
              <div className="ops-stack">
                <div className="panel" style={{ flex: 58 }}>
                  <div className="panel-head"><TrendIcon />Who&apos;s winning attention
                    <span className="ph-right"><span className="seg seg-sm">
                      {(["day", "week", "month"] as const).map((w) => (
                        <button key={w} data-on={lbWin === w} onClick={() => setLbWin(w)}>{w === "day" ? "TODAY" : w === "week" ? "THIS WEEK" : "THIS MONTH"}</button>
                      ))}
                    </span></span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    {board.map((e: any, i: number) => (
                      <div key={e.entity_id || e.page} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "10px 16px", borderBottom: "1px solid var(--rowline)" }}>
                        <span style={{ ...MONO, fontSize: 14, color: "var(--amber)", width: 22, textAlign: "right", paddingTop: 1, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                            <span style={{ fontSize: 13 }}><Ext href={e.page_url}>{e.page || e.display_name}</Ext></span>
                            <Mood m={e.mood} />
                          </div>
                          <div style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{e.likes.toLocaleString()} reactions · {e.shares.toLocaleString()} shares · {e.views.toLocaleString()} views</div>
                          {e.best_post && (
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                              <span style={{ ...MONO, fontSize: 10, color: "var(--muted)", maxWidth: 340, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>&quot;{e.best_post.text || "(no text)"}&quot;</span>
                              <span style={{ ...MONO, fontSize: 10, color: "var(--amber)" }}>{e.best_post.engagement.toLocaleString()}</span>
                              <span style={{ ...MONO, fontSize: 10 }}><Ext href={e.best_post.url}>open</Ext></span>
                            </div>
                          )}
                        </div>
                        <div style={{ width: 200, paddingTop: 2, flexShrink: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ ...MONO, fontSize: 13 }}>{e.engagement.toLocaleString()}</span>
                            <span style={{ ...MONO, fontSize: 12, color: "#4A6B8C" }}>{(e.share_of_voice_pct ?? 0).toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 5, background: "var(--void)" }}>
                            <div style={{ width: `${Math.round((e.engagement / maxEng) * 100)}%`, height: "100%", background: i === 0 ? "var(--amber)" : "var(--signal)" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ flex: 42 }}>
                  <div className="panel-head"><VelocityIcon />Compare pages
                    <span className="ph-right">
                      <button className="btn" style={{ fontSize: 9, padding: "4px 10px" }}
                        onClick={() => {
                          const cur = (project?.project?.compare_roster || []) as string[];
                          setRosterDraft(new Set(cur.length ? cur : (ana.page_series || []).slice(0, 12).map((p: any) => p.entity_id)));
                          setRosterEdit(!rosterEdit);
                        }}>
                        {rosterEdit ? "CLOSE" : "MANAGE"}
                      </button>
                    </span>
                  </div>
                  <div className="panel-body">
                    {rosterEdit && (
                      <div style={{ border: "1px solid var(--carbon)", background: "var(--void)", padding: 10, marginBottom: 12 }}>
                        <div className="stat-label" style={{ marginBottom: 8 }}>Pick the pages this comparison tracks ({rosterDraft.size})</div>
                        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {(ana.page_series || []).map((p: any) => {
                            const on = rosterDraft.has(p.entity_id);
                            return (
                              <button key={p.entity_id}
                                onClick={() => setRosterDraft((cur) => { const n = new Set(cur); n.has(p.entity_id) ? n.delete(p.entity_id) : n.add(p.entity_id); return n; })}
                                style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 8px", cursor: "pointer",
                                  border: `1px solid ${on ? "var(--amber)" : "var(--carbon)"}`, background: on ? "var(--accent-bg)" : "transparent",
                                  color: on ? "var(--amber)" : "var(--muted)", borderRadius: 0 }}>
                                {p.page}
                              </button>
                            );
                          })}
                        </div>
                        <button className="btn btn-primary" onClick={saveRoster}>Save comparison set</button>
                      </div>
                    )}
                    <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                      {(() => {
                        const roster = (project?.project?.compare_roster || []) as string[];
                        const all = ana.page_series || [];
                        const shown = roster.length ? roster.map((rid) => all.find((p: any) => p.entity_id === rid)).filter(Boolean) : all.slice(0, 12);
                        return shown;
                      })().map((p: any, idx: number) => {
                        const on = picked.has(p.entity_id);
                        const c = PAGE_COLORS[idx % PAGE_COLORS.length];
                        return (
                          <button key={p.entity_id} onClick={() => togglePick(p.entity_id)}
                            style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "4px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                              border: `1px solid ${on ? c : "var(--carbon)"}`, background: on ? "var(--void)" : "transparent", color: on ? "var(--text)" : "var(--muted)", borderRadius: 2 }}>
                            <span style={{ width: 8, height: 8, background: c, flexShrink: 0 }} />{p.page}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" as any, color: "var(--muted)", marginBottom: 6 }}>Daily engagement · by day</div>
                    {(() => {
                      const chosen = (ana.page_series || []).filter((p: any) => picked.has(p.entity_id));
                      const days = Array.from(new Set(chosen.flatMap((p: any) => p.series.map((x: any) => x.day)))).sort() as string[];
                      const data = days.map((day) => {
                        const row: any = { day };
                        chosen.forEach((p: any) => { const pt = p.series.find((x: any) => x.day === day); row[p.page] = pt ? pt.eng : 0; });
                        return row;
                      });
                      if (!chosen.length || data.length < 2) return <div className="muted" style={{ fontSize: 12 }}>Pick pages above to overlay their daily engagement.</div>;
                      return (
                        <div style={{ width: "100%", height: 210 }}>
                          <ResponsiveContainer>
                            <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 4" stroke="var(--carbon)" vertical={false} />
                              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} tickFormatter={(d) => d.slice(5)} />
                              <YAxis tick={{ fontSize: 10, fill: "var(--muted)", fontFamily: "var(--font-mono)" }} allowDecimals={false} />
                              <Tooltip {...TOOLTIP_STYLE} />
                              {chosen.map((p: any) => (
                                <Line key={p.entity_id} type="monotone" dataKey={p.page} stroke={pageColor(p.entity_id)} strokeWidth={1.6} dot={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Row 4 — market talk · top posts · sources */}
              <div className="ops-stack">
                <div className="panel" style={{ flex: 34 }}>
                  <div className="panel-head"><VelocityIcon />What the market is talking about</div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    {allTopics.slice(0, 12).map((t: any) => (
                      <div key={t.topic_cluster_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 16px", borderBottom: "1px solid var(--rowline)" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</div>
                          {t.category && <div style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{t.category}</div>}
                        </div>
                        <span style={{ flexShrink: 0, display: "inline-flex", gap: 12, alignItems: "center", whiteSpace: "nowrap" }}>
                          {t.velocity_delta_pct != null && (
                            <span style={{ ...MONO, fontSize: 11, color: t.velocity_delta_pct >= 0 ? "#427A5B" : "#9E3B3B" }}>
                              {t.velocity_delta_pct >= 0 ? "▲" : "▼"} {Math.abs(t.velocity_delta_pct)}%
                            </span>
                          )}
                          <span className="muted" style={{ ...MONO, fontSize: 10 }}>{t.posts} · {t.pages_talking} · {(t.engagement || 0).toLocaleString()}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ flex: 44 }}>
                  <div className="panel-head"><TrendIcon />Top posts by engagement</div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    {(ana.top_posts || []).slice(0, 5).map((p: any, i: number) => (
                      <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--rowline)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                          <span style={{ fontSize: 13 }}>{p.page}</span>
                          <Mood m={p.mood} />
                          <span style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{p.day.slice(5)}</span>
                          <span style={{ ...MONO, fontSize: 10, marginLeft: "auto" }}><Ext href={p.url}>open post</Ext></span>
                        </div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.5, color: "#B8BEC7" }}>{p.text || <span className="muted">(no text)</span>}</p>
                        <div style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{p.likes.toLocaleString()} reactions · {p.shares.toLocaleString()} shares · {p.views.toLocaleString()} views · {p.engagement.toLocaleString()} total</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ flex: 22 }}>
                  <div className="panel-head"><NetworkIcon />Sources
                    <span className="ph-right">
                      <button className="btn" style={{ fontSize: 9, padding: "4px 10px" }}
                        onClick={() => {
                          const d: Record<string, string> = {};
                          (project?.anchors || []).forEach((a: any) => { d[a.id] = a.kind || "other"; });
                          setKindDraft(d);
                          setCatEdit(!catEdit);
                        }}>
                        {catEdit ? "CLOSE" : "CATEGORIZE"}
                      </button>
                    </span>
                  </div>
                  <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {catEdit && (
                      <div style={{ border: "1px solid var(--carbon)", background: "var(--void)", padding: 10, maxHeight: 260, overflowY: "auto" }}>
                        <div className="stat-label" style={{ marginBottom: 8 }}>Assign each source a category</div>
                        {(project?.anchors || []).map((a: any) => (
                          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--rowline)" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {(a.public_ref || a.label || "").replace("https://www.facebook.com/", "fb/").replace("https://", "")}
                            </span>
                            <select className="select" style={{ width: 120, fontSize: 10, padding: "3px 6px" }}
                              value={kindDraft[a.id] ?? (a.kind || "other")}
                              onChange={(e) => setKindDraft((cur) => ({ ...cur, [a.id]: e.target.value }))}>
                              {["media", "group", "politician", "government", "institution", "other"].map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </div>
                        ))}
                        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={saveKinds}>Save categories</button>
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 11 }}>Paste anything — the app extracts and cleans the links. Organize with headers (MEDIA: / POLITICIANS: / GROUPS: / GOVERNMENT:) and each link below a header is auto-categorized.</div>
                    <textarea className="input" style={{ minHeight: 180, resize: "none", flex: 1 }} value={urls} onChange={(e) => setUrls(e.target.value)} />
                    <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={collect}>{busy ? "COLLECTING…" : "Add sources & collect"}</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
