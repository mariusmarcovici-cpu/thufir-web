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

function Mood({ m }: { m: string }) {
  return <span style={{ fontSize: 11, fontWeight: 500, color: moodColor(m), background: moodBg(m), padding: "2px 8px", borderRadius: 10 }}>{m}</span>;
}

export default function ProjectDetailPage() {
  const { user, loading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [disc, setDisc] = useState<any>({ topics: [], domains: [], pages: [] });
  const [ana, setAna] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [scouting, setScouting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState("https://stluciatimes.com/feed/\n");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [velo, setVelo] = useState<any>(null);
  const [reproc, setReproc] = useState(false);

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
      const [p, d, v] = await Promise.all([
        call(`/projects/${id}`, "GET"),
        call(`/projects/${id}/discovered`, "GET").catch(() => ({ topics: [], domains: [], pages: [] })),
        call(`/projects/${id}/velocity/topics?window=30d`, "GET").catch(() => null),
      ]);
      setProject(p);
      setDisc({ topics: d.topics || [], domains: d.domains || [], pages: d.pages || [] });
      setVelo(v);
    } catch { setError("Couldn't load this project."); }
  }, [id]);

  useEffect(() => { if (user) { loadMeta(); analyze(); } }, [user, loadMeta, analyze]);

  useEffect(() => {
    const ps = ana?.page_series || [];
    if (ps.length && picked.size === 0) setPicked(new Set(ps.slice(0, 3).map((p: any) => p.entity_id)));
  }, [ana, picked.size]);

  function togglePick(eid: string) {
    setPicked((cur) => { const n = new Set(cur); n.has(eid) ? n.delete(eid) : n.add(eid); return n; });
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

  async function rebuildIndex() {
    setReproc(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/reprocess`, "POST");
      if (r.error) setError(`Reprocess: ${r.error}`);
      else setMsg(`Semantic index rebuilt: ${r.posts_reprocessed} posts -> ${r.clusters} topics (${r.embedding_provider} embeddings, ${r.vector_store} store).`);
      await loadMeta();
    } catch (e: any) { setError(e.message || "Reprocess failed."); }
    finally { setReproc(false); }
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
  const maxEng = Math.max(1, ...(ana?.leaderboard || []).map((e: any) => e.engagement || 0));

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 900 }}>
        <button className="btn btn-quiet" style={{ marginBottom: 14 }} onClick={() => router.push("/projects")}>&larr; Projects</button>

        {project && (
          <div className="spread" style={{ marginBottom: 12, alignItems: "flex-start" }}>
            <div>
              <h1 style={{ fontSize: 20, marginBottom: 4 }}>{project.project.name}</h1>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="chip">{project.project.region_label}</span>
                {(project.project.languages || []).map((l: string) => <span key={l} className="chip">{l}</span>)}
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

        {s && (
          <>
            {/* Summary */}
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

            {/* Timeline */}
            {ana.timeline?.length > 1 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 10 }}>Engagement over time</div>
                <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer>
                    <AreaChart data={ana.timeline} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted)" }} tickFormatter={(d) => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="eng" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.12} name="engagement" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {ana.leaderboard?.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>Who&apos;s winning attention</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Pages ranked by engagement (reactions + shares) on their recent posts, with tone.</div>
                <div className="stack" style={{ gap: 10 }}>
                  {ana.leaderboard.map((e: any, i: number) => (
                    <div key={e.page}>
                      <div className="spread" style={{ fontSize: 13, marginBottom: 3 }}>
                        <span style={{ fontWeight: 500 }}>{i + 1}. {e.page} &nbsp;<Mood m={e.mood} /></span>
                        <span className="muted">{e.engagement.toLocaleString()} eng · {(ana.summary?.total_engagement ? (e.engagement / ana.summary.total_engagement * 100) : 0).toFixed(1)}% SoV</span>
                      </div>
                      <div style={{ height: 8, background: "var(--border-soft)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((e.engagement / maxEng) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                      </div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{e.likes.toLocaleString()} reactions · {e.shares.toLocaleString()} shares · {e.views.toLocaleString()} views</div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Compare pages */}
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
                  <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Pick pages to put head-to-head on engagement over time.</div>
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
                  {chosen.length > 0 && (
                    <div className="stack" style={{ gap: 7, marginTop: 12 }}>
                      {chosen.map((p: any, i: number) => (
                        <div key={p.entity_id} className="spread" style={{ fontSize: 13, borderBottom: "0.5px solid var(--border-soft)", paddingBottom: 5 }}>
                          <span style={{ fontWeight: 500, color: LINE_COLORS[i % LINE_COLORS.length] }}>{p.page} &nbsp;<Mood m={p.mood} /></span>
                          <span className="muted">{p.engagement.toLocaleString()} eng · {(ana.summary?.total_engagement ? (p.engagement / ana.summary.total_engagement * 100) : 0).toFixed(1)}% share of voice</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Semantic topics (velocity engine) */}
            {velo?.topics?.length > 0 ? (
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="spread" style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>What the market is talking about</span>
                  <span className="chip" title="authentic vs raw volume across the window">
                    Network integrity {Math.round((velo.network_integrity || 0) * 100)}%
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Semantic clusters from the velocity engine ({velo.window}, {velo.source}). Arrows show change vs the previous window.</div>
                <div className="stack" style={{ gap: 8 }}>
                  {velo.topics.slice(0, 12).map((t: any) => (
                    <div key={t.topic_cluster_id} style={{ borderBottom: "0.5px solid var(--border-soft)", paddingBottom: 6 }}>
                      <div className="spread" style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 500 }}>{t.label}
                          {t.velocity_delta_pct != null && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: t.velocity_delta_pct >= 0 ? "#1D9E75" : "#D85A30" }}>
                              {t.velocity_delta_pct >= 0 ? "▲" : "▼"} {Math.abs(t.velocity_delta_pct)}%
                            </span>
                          )}
                        </span>
                        <span className="muted">{t.raw_volume} raw · {Math.round(t.authenticity_ratio * 100)}% authentic</span>
                      </div>
                      <div style={{ height: 5, background: "var(--border-soft)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                        <div style={{ width: `${Math.round(t.authenticity_ratio * 100)}%`, height: "100%", background: "#1D9E75" }} />
                      </div>
                      {t.top_terms && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{t.top_terms}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ) : ana.topics?.length > 0 && (
              <div className="card" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>What the market is talking about</div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>Hashtag grouping (fallback). Click "Rebuild semantic index" above to switch to semantic clusters.</div>
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
                        <span className="muted">{p.engagement.toLocaleString()} eng · {p.day.slice(5)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2, #444)" }}>{p.text || <span className="muted">(no text)</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Market scout */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="spread" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Market scout</span>
            <button className="btn" disabled={scouting} onClick={scout}>{scouting ? "Scouting…" : "Scout the market"}</button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: disc.topics.length || disc.pages.length ? 12 : 0 }}>Maps topics and sources from your anchors. Finding brand-new pages needs Apify credit.</div>
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
      </div>
    </>
  );
}
