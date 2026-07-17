"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AreaChart, Area, LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRequireAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";
import TopBar from "@/components/TopBar";
import { TrendIcon, VelocityIcon, NetworkIcon } from "@/components/BrandAssets";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function call(path: string, method: "GET" | "POST" | "PUT" | "DELETE", body?: any) {
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
const PAGE_COLORS = ["#C2A34F", "#4A8BC2", "#3FA36B", "#C25248", "#9B6BC9", "#3AA6A0", "#C97E33", "#C462A0", "#9CB03A", "#7B8794", "#6B7FE0", "#B0803A"];
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

function WordBubbles({ topics, onPick }: { topics: any[]; onPick?: (id: string) => void }) {
  const W = 1280, H = 400;
  const items = topics.slice(0, 24).map((t: any) => ({
    id: t.topic_cluster_id,
    word: String(t.label || "").split(/[\/·]| - /)[0].trim().split(" ").slice(0, 4).join(" ") || "topic",
    full: t.label, n: t.posts || 0, eng: t.engagement || 0,
    mood: t.mood || "neutral", category: t.category,
  }));
  const maxE = Math.max(1, ...items.map((i) => i.eng));
  let sized = items.map((i) => ({ ...i, r: 22 + 46 * Math.sqrt(i.eng / maxE) }))
    .sort((a, b) => b.r - a.r);
  let pos = packBubbles(sized, W, H);
  for (let shrink = 0.9; shrink >= 0.6 && pos.some((p) => p.r === 0); shrink -= 0.1) {
    sized = sized.map((b) => ({ ...b, r: Math.max(16, b.r * shrink) }));
    pos = packBubbles(sized, W, H);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: "55vh", display: "block", margin: "0 auto" }}>
      {sized.map((b, i) => pos[i].r > 0 && (
        <g key={i} onClick={() => b.id && onPick?.(b.id)} style={{ cursor: onPick ? "pointer" : "default" }}>
          <title>{b.full} — {b.n} posts · {b.eng.toLocaleString()} engagement · {b.mood}</title>
          <circle cx={pos[i].x} cy={pos[i].y} r={b.r} fill={BUBBLE_FILL[b.mood] || BUBBLE_FILL.neutral} stroke={BUBBLE_STROKE[b.mood] || BUBBLE_STROKE.neutral} strokeWidth={1.5} />
          {(() => {
            const fs = Math.max(9, b.r / 3.6);
            const budget = Math.max(6, Math.floor((b.r * 1.7) / (fs * 0.6)));
            const words = b.word.split(" ");
            let l1 = "", k = 0;
            while (k < words.length && (l1 + " " + words[k]).trim().length <= budget) { l1 = (l1 + " " + words[k]).trim(); k++; }
            if (!l1) { l1 = words[0].slice(0, Math.max(4, budget - 1)) + "…"; k = 1; }
            let l2 = words.slice(k).join(" ");
            if (l2.length > budget) l2 = l2.slice(0, budget - 1) + "…";
            const two = !!l2;
            return (
              <>
                <text x={pos[i].x} y={pos[i].y - (two ? fs * 0.55 : 3)} textAnchor="middle"
                  style={{ fontSize: fs, fontWeight: 600, fill: BUBBLE_TEXT[b.mood] || "#B8BEC7" }}>
                  {l1}
                  {two && <tspan x={pos[i].x} dy={fs * 1.12}>{l2}</tspan>}
                </text>
                <text x={pos[i].x} y={pos[i].y + (two ? fs * 2.05 : Math.max(10, b.r / 3))} textAnchor="middle"
                  style={{ fontSize: Math.max(8, b.r / 4), fill: "#8B949E", fontFamily: "var(--font-mono)" }}>
                  {b.n}
                </text>
              </>
            );
          })()}
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

  const [view, setView] = useState<"dash" | "duel" | "edition" | "setup">("dash");
  const [project, setProject] = useState<any>(null);
  const isAdmin = ["owner", "editor"].includes(project?.role || "");
  const isOwner = (project?.role || "") === "owner";
  const [teamOpen, setTeamOpen] = useState(false);
  const [team, setTeam] = useState<any>(null);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<"editor" | "viewer">("viewer");
  const [invLink, setInvLink] = useState("");
  async function loadTeam() {
    try { const t = await call(`/auth/projects/${id}/members`, "GET"); setTeam(t); } catch { /* noop */ }
  }
  async function sendInvite() {
    if (!invEmail.trim()) return;
    setError(null); setInvLink("");
    try {
      const r = await call(`/auth/projects/${id}/invite`, "POST", { email: invEmail.trim(), role: invRole });
      const link = `${window.location.origin}/accept?token=${r.invite_token}`;
      setInvLink(link);
      setMsg("Invite created — copy the link and send it to them.");
      loadTeam();
    } catch (e: any) { setError(e.message || "Couldn't create the invite."); }
  }
  const [coord, setCoord] = useState<any>(null);
  async function loadCoord() {
    if (!idValid) return;
    const c = null;  // coordination retired 12-Jul (premise rejected)
    if (c) setCoord(c);
  }
  async function runStitch(commit: boolean) {
    if (!idValid) return;
    if (commit && !window.confirm("COMMIT writes narratives to the database. Run a DRY RUN first and read the decisions in the ops feed. Commit now?")) return;
    setStitchBusy(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/narratives/stitch?dry_run=${commit ? "false" : "true"}`, "POST");
      setMsg(r.note || (commit ? "Stitch committed." : "Dry run started — see the ops feed."));
      setTimeout(() => { loadMeta(); loadNarratives(); }, 2500);
    } catch (e: any) { setError(e.message || "Couldn’t start the stitch pass."); }
    finally { setStitchBusy(false); }
  }

  async function resetNarratives() {
    if (!idValid) return;
    if (!window.confirm("RESET deletes every narrative for this project so the spine can be rebuilt clean. Continue?")) return;
    setStitchBusy(true); setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/narratives/reset`, "POST");
      setMsg(`Spine reset — cleared. Run a DRY RUN, read it, then COMMIT.`);
      setTimeout(loadMeta, 1500);
    } catch (e: any) { setError(e.message || "Reset failed."); }
    finally { setStitchBusy(false); }
  }
  const [disc, setDisc] = useState<any>({ topics: [], domains: [], pages: [] });
  const [velo, setVelo] = useState<any>(null);
  async function loadVelo(category = "", win?: string) {
    if (!idValid) return;
    const w = win ?? topicWin;
    const q = `window=${w}${category ? `&category=${category}` : ""}`;
    const v = await call(`/projects/${id}/topics/composed?${q}`, "GET").catch(() => null);
    if (v) setVelo(v);
    if (v?.note) setMsg(v.note);
  }

  async function openTopic(clusterId: string) {
    setTopicDetail({ open: true, loading: true, data: null });
    try {
      const d = await call(`/projects/${id}/topics/${clusterId}/posts${cat ? `?category=${cat}` : ""}`, "GET");
      setTopicDetail({ open: true, loading: false, data: d });
    } catch (e: any) {
      setTopicDetail({ open: false, loading: false, data: null });
      setError(e.message || "Couldn't load the topic's posts.");
    }
  }
  const [ana, setAna] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [scouting, setScouting] = useState(false);
  const [reproc, setReproc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lbWin, setLbWin] = useState<"day" | "week" | "month">("week");
  const [tpWin, setTpWin] = useState<"day" | "week" | "month">("week");
  const [duelA, setDuelA] = useState<string>("");
  const [duelB, setDuelB] = useState<string>("");
  const [urls, setUrls] = useState("https://stluciatimes.com/feed/\n");
  const [dedup, setDedup] = useState<any>(null);        // null = strip closed
  const [dedupBusy, setDedupBusy] = useState(false);
  const [stitchBusy, setStitchBusy] = useState(false);
  const [narratives, setNarratives] = useState<any[]>([]);
  const [factionDraft, setFactionDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [opsEvents, setOpsEvents] = useState<any[]>([]);
  const [folSeries, setFolSeries] = useState<any>(null);
  const [topicWin, setTopicWin] = useState<"day" | "week" | "month">("month");
  const [topicDetail, setTopicDetail] = useState<any>({ open: false, loading: false, data: null });
  const [rosterEdit, setRosterEdit] = useState(false);
  const [rosterDraft, setRosterDraft] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState<string>("");
  const [catEdit, setCatEdit] = useState(false);
  const [edition, setEdition] = useState<any>(null);   // {label, start, end, topics}
  const [editionLoading, setEditionLoading] = useState(false);
  const [spFrom, setSpFrom] = useState("");
  const [spTo, setSpTo] = useState("");
  const [spLabel, setSpLabel] = useState("");
  const [spBusy, setSpBusy] = useState(false);
  const [spReport, setSpReport] = useState<any>(null);      // live preview OR frozen report
  const [spFrozenMeta, setSpFrozenMeta] = useState<any>(null); // set when viewing a saved one
  const [spList, setSpList] = useState<any[]>([]);
  // Background refreshes (loadMeta) must respect what the analyst selected.
  // Hard-coding window=month here once made the map silently swap month data
  // under a DAY chip — the UI claimed "today" while showing three-week-old
  // posts. Refs stay current across renders without re-creating loadMeta.
  const topicWinRef = useRef(topicWin);
  const catRef = useRef(cat);
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

  topicWinRef.current = topicWin;
  catRef.current = cat;

  const loadMeta = useCallback(async () => {
    if (!id) return;
    try {
      const [p, d, v, o] = await Promise.all([
        call(`/projects/${id}`, "GET"),
        call(`/projects/${id}/discovered`, "GET").catch(() => ({ topics: [], domains: [], pages: [] })),
        call(`/projects/${id}/topics/composed?window=${topicWinRef.current}${catRef.current ? `&category=${catRef.current}` : ""}`, "GET").catch(() => null),
        call(`/projects/${id}/ops?limit=5`, "GET").catch(() => ({ events: [] })),
      ]);
      setProject(p);
      loadCoord();
      setDisc({ topics: d.topics || [], domains: d.domains || [], pages: d.pages || [] });
      setVelo(v);
      setOpsEvents(o.events || []);
      loadNarratives();
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

  async function deleteSource(anchorId: string, label: string) {
    if (!idValid) return;
    if (!confirm(`Remove this source?\n\n${label}\n\nAlready-collected posts stay in the corpus; the page just won't be scraped again.`)) return;
    try {
      await call(`/projects/${id}/anchor/${anchorId}`, "DELETE");
      setPicked((cur) => { const n = new Set(cur); n.forEach((x) => x); return n; });
      setMsg("Source removed and blocked — it won't come back, and its data is leaving the views.");
      await loadMeta();
      analyze(false, cat);
      loadVelo(cat);
    } catch (e: any) { setError(e.message || "Couldn't remove the source."); }
  }

  async function loadDedup() {
    if (!idValid) return;
    setDedupBusy(true); setError(null);
    try { setDedup(await call(`/projects/${id}/dedup`, "GET")); }
    catch (e: any) { setError(e.message || "Couldn't scan for duplicates."); }
    finally { setDedupBusy(false); }
  }

  async function dedupBackfill() {
    if (!idValid) return;
    setDedupBusy(true); setError(null);
    try {
      const r = await call(`/projects/${id}/dedup/backfill`, "POST");
      setMsg(r.merged ? `Auto-merged ${r.merged} cosmetic URL variants.` : "No cosmetic variants to merge.");
      await loadDedup(); await loadMeta();
    } catch (e: any) { setError(e.message || "Auto-merge failed."); }
    finally { setDedupBusy(false); }
  }

  async function dedupDecide(eliminate: string[], dismiss: string[], label?: string) {
    if (!idValid) return;
    if (eliminate.length && !confirm(`ELIMINATE this source?\n\n${label || eliminate.length + " sources"}\n\nIt is deleted, its data leaves the views, and it is PERMANENTLY BANNED — the scout and the collectors will never re-admit it. Only pasting it again (with the add-anyway confirmation) can bring it back.`)) return;
    setDedupBusy(true); setError(null);
    try {
      const r = await call(`/projects/${id}/dedup/decide`, "POST", { eliminate, dismiss });
      if (eliminate.length) setMsg(`Eliminated ${r.eliminated?.length || 0} source(s) — permanently banned.`);
      else setMsg("Kept — this proposal won't be raised again.");
      await loadDedup(); await loadMeta();
    } catch (e: any) { setError(e.message || "Couldn't apply the decision."); }
    finally { setDedupBusy(false); }
  }

  function eidOf(ref: string): string {
    const m = String(ref || "").match(/facebook\.com\/([^/?#]+)/);
    return ("fb:" + (m ? m[1].toLowerCase() : "unknown")).slice(0, 32);
  }
  const anchorByEid: Record<string, any> = {};
  (project?.anchors || []).forEach((a: any) => { if (a.public_ref) anchorByEid[eidOf(a.public_ref)] = a; });
  const followerLine = (eid: string) => {
    const a = anchorByEid[eid];
    if (!a || !a.followers) return null;
    const d = Number(a.followers_delta || 0);
    return `${Number(a.followers).toLocaleString()} followers${d ? ` (${d > 0 ? "▲" : "▼"}${Math.abs(d).toLocaleString()}/wk)` : ""}`;
  };

  async function scoutDecide(ref: string, action: "approve" | "reject") {
    if (!idValid) return;
    try {
      await call(`/projects/${id}/scout/${action}`, "POST", { ref });
      setMsg(action === "approve"
        ? "Source approved — it joins the roster and will be scraped from the next collect."
        : "Rejected and blocked — the scout will never propose it again, and its data is leaving the views.");
      const d = await call(`/projects/${id}/discovered`, "GET").catch(() => null);
      if (d) setDisc(d);
      await loadMeta();
      if (action === "reject") { analyze(false, cat); loadVelo(cat); }
    } catch (e: any) { setError(e.message || "Couldn't record the decision."); }
  }

  async function loadEdition() {
    if (!idValid) return;
    setEditionLoading(true);
    try {
      const v = await call(`/projects/${id}/topics/composed?window=edition`, "GET");
      setEdition(v);
    } catch (e: any) { setError(e.message || "Couldn't load the edition."); }
    finally { setEditionLoading(false); }
  }

  async function loadSpecials() {
    if (!idValid) return;
    try {
      const v = await call(`/projects/${id}/editions`, "GET");
      setSpList(v.editions || []);
    } catch { /* shelf is optional */ }
  }

  async function extractSpecial() {
    if (!spFrom || !spTo) { setError("Pick both start and end."); return; }
    setSpBusy(true); setError(null); setSpFrozenMeta(null);
    try {
      const qs = `start=${encodeURIComponent(new Date(spFrom).toISOString())}&end=${encodeURIComponent(new Date(spTo).toISOString())}`;
      const v = await call(`/projects/${id}/editions/extract?${qs}`, "GET");
      setSpReport(v);
    } catch (e: any) { setError(e.message || "Extraction failed."); }
    finally { setSpBusy(false); }
  }

  async function freezeSpecial() {
    if (!spFrom || !spTo) return;
    setSpBusy(true); setError(null);
    try {
      const v = await call(`/projects/${id}/editions`, "POST", {
        start: new Date(spFrom).toISOString(), end: new Date(spTo).toISOString(),
        label: spLabel,
      });
      setMsg(`Edition FROZEN: ${v.label}`);
      await loadSpecials();
    } catch (e: any) { setError(e.message || "Freeze failed."); }
    finally { setSpBusy(false); }
  }

  async function openSaved(eid: string) {
    setSpBusy(true); setError(null);
    try {
      const v = await call(`/projects/${id}/editions/${eid}`, "GET");
      setSpReport(v.report);
      setSpFrozenMeta({ label: v.label, created_by: v.created_by, created_at: v.created_at });
    } catch (e: any) { setError(e.message || "Couldn't open the edition."); }
    finally { setSpBusy(false); }
  }

  async function saveKinds() {
    if (!idValid) return;
    try {
      await call(`/projects/${id}/anchor-kinds`, "PUT", { kinds: kindDraft });
      if (Object.keys(factionDraft).length) {
        try {
          await call(`/projects/${id}/anchor-factions`, "PUT", { factions: factionDraft });
        } catch (e: any) {
          // the mass-null guardrail: a save clearing many set factions is
          // usually a stale draft, not intent - make the human decide.
          const msg = String(e.message || "");
          if (msg.includes("would CLEAR") && window.confirm(msg + "\n\nProceed anyway?")) {
            await call(`/projects/${id}/anchor-factions`, "PUT", { factions: factionDraft, force: true });
          } else if (!msg.includes("would CLEAR")) { throw e; }
          else { setMsg("Save cancelled - reload the page to refresh the categorize panel."); return; }
        }
      }
      setCatEdit(false);
      setMsg("Source categories and factions saved.");
      await loadMeta();
    } catch (e: any) { setError(e.message || "Couldn't save categories."); }
  }

  const loadNarratives = useCallback(async () => {
    if (!idValid) return;
    try {
      const r = await call(`/projects/${id}/narratives`, "GET");
      setNarratives(r.narratives || []);
    } catch { setNarratives([]); }
  }, [id, idValid]);

  async function seedFactions() {
    if (!idValid) return;
    setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/anchor-factions/seed`, "POST");
      setMsg(`Factions seeded from the gazetteer \u2014 ${r.seeded} filled, ${r.ambiguous_skipped} ambiguous skipped, ${r.human_set_untouched} human-set untouched, ${r.still_unknown} still unknown (yours to judge).`);
      setTimeout(loadMeta, 1200);
    } catch (e: any) { setError(e.message || "Couldn't seed factions."); }
  }

  async function seedGazetteer() {
    if (!idValid) return;
    setError(null); setMsg(null);
    try {
      const r = await call(`/projects/${id}/gazetteer/seed`, "POST");
      setMsg(`Gazetteer loaded \u2014 ${r.seeded} entries (public figures, communities, organisations).`);
      setTimeout(loadMeta, 1200);
    } catch (e: any) { setError(e.message || "Couldn't load the gazetteer."); }
  }

  async function saveRoster() {
    if (!idValid) return;
    try {
      await call(`/projects/${id}/compare-roster`, "PUT", { entity_ids: Array.from(rosterDraft) });
      setPicked((cur) => new Set(Array.from(cur).filter((eid) => rosterDraft.has(eid))));
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
      else if (r.note) setMsg(r.note);
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
      let r = await call(`/projects/${id}/sources`, "POST", { urls: urls.split("\n") });
      if (r?.banned_matches?.length) {
        const list = r.banned_matches.map((b: any) =>
          `\u2022 ${b.url}${b.banned_at ? ` (eliminated ${String(b.banned_at).slice(0, 10)})` : ""}${b.reason ? ` — ${b.reason}` : ""}`).join("\n");
        if (window.confirm(`These sources were previously ELIMINATED and are permanently banned:\n\n${list}\n\nAdd anyway? This lifts their ban and they become normal sources again.`)) {
          r = await call(`/projects/${id}/sources`, "POST", { urls: urls.split("\n"), override_banned: true });
        }
      }
      const note = r?.facebook?.error ? ` (Facebook: ${r.facebook.error})` : "";
      const merged = r?.sources?.merged_variants ? `, ${r.sources.merged_variants} variants merged` : "";
      const lifted = r?.sources?.bans_lifted ? `, ${r.sources.bans_lifted} bans lifted` : "";
      const skipped = r?.sources?.blocked_skipped ? `, ${r.sources.blocked_skipped} eliminated skipped` : "";
      const src = r?.sources ? ` Sources: ${r.sources.found_in_paste} found, ${r.sources.newly_added} new${r.sources.categorized ? `, ${r.sources.categorized} auto-categorized` : ""}${merged}${lifted}${skipped}.` : "";
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
  const topPostsWindowed = (() => {
    const posts = ((ana?.top_posts || []) as any[]).filter((p) => !p.dateless);
    const days = posts.map((p) => p.day).filter(Boolean).sort();
    if (!days.length) return posts;
    const anchor = new Date(days[days.length - 1] + "T00:00:00Z");
    const span = tpWin === "day" ? 1 : tpWin === "week" ? 7 : 30;
    const cutoff = new Date(anchor.getTime() - (span - 1) * 86400000).toISOString().slice(0, 10);
    return posts.filter((p) => p.day >= cutoff);
  })();
  const maxEng = Math.max(1, ...board.map((e: any) => e.engagement || 0));
  const allTopics = (velo?.topics ?? []).filter((t: any) => !String(t.label || "").startsWith("(media"));
  const topClusters = [...allTopics].sort((x: any, y: any) => (y.engagement || 0) - (x.engagement || 0)).slice(0, 8);
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
                <button data-on={view === "edition"} onClick={() => { setView("edition"); loadEdition(); loadSpecials(); }}>EDITION</button>
              </div>
              <span style={{ width: 14 }} />
              <div className="seg" title="Configuration and maintenance — the technical door">
                <button data-on={view === "setup"} onClick={() => setView("setup")}>SETUP</button>
              </div>
              <button className="btn btn-primary" disabled={analyzing} onClick={() => analyze(false)}>{analyzing ? "ANALYSING…" : "Re-analyse"}</button>
              {isAdmin && (<button className="btn" disabled={analyzing} onClick={() => analyze(true)}>Deep tone (Elena)</button>)}
              {isAdmin && (<button className="btn" disabled={reproc} onClick={rebuildIndex}>{reproc ? "Rebuilding…" : "Rebuild semantic index"}</button>)}
              {isOwner && (<button className="btn" onClick={() => { setTeamOpen(true); loadTeam(); }}>Team</button>)}
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
                    {followerLine(duelA) && <div className="muted" style={{ ...MONO, fontSize: 10, marginTop: 4 }}>{followerLine(duelA)}</div>}
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
                    {followerLine(duelB) && <div className="muted" style={{ ...MONO, fontSize: 10, marginTop: 4 }}>{followerLine(duelB)}</div>}
                    <div style={{ display: "none" }}>
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
                    onClick={() => { setCat(v); analyze(false, v); loadVelo(v, topicWin); }}>
                    {lbl}
                  </button>
                ))}
                {cat && <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>— filtered to this category across stats, leaderboard, posts, and the topic map</span>}
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

              {/* Row 2 — topic map · clusters */}
              <div className="ops-stack">
                <div className="panel" style={{ flex: 55 }}>
                  <div className="panel-head"><TrendIcon />Topic map
                    <span className="ph-right">
                      <span className="muted" style={{ fontSize: 11, fontFamily: "var(--font)", letterSpacing: 0, marginRight: 8 }}>click a bubble to read its posts</span>
                      <span className="seg seg-sm">
                        {(["day", "week", "month"] as const).map((w) => (
                          <button key={w} data-on={topicWin === w} onClick={() => { setTopicWin(w); loadVelo(cat, w); }}>{w.toUpperCase()}</button>
                        ))}
                      </span>
                    </span>
                  </div>
                  <div className="panel-body" style={{ padding: 8 }}>
                    {allTopics.length > 0 ? <WordBubbles topics={allTopics} onPick={openTopic} /> : <div className="muted" style={{ fontSize: 12 }}>{topicWin === "day" ? "No posts in the last 24 hours yet \u2014 the map fills after the next collection run. Try WEEK or MONTH meanwhile." : "No topics in this window \u2014 run \u201cRebuild semantic index\u201d if the corpus has posts."}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 18, padding: "10px 16px", borderTop: "1px solid var(--carbon)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1, color: "var(--muted)" }}>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#427A5B", marginRight: 6 }} />POSITIVE</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#9E3B3B", marginRight: 6 }} />NEGATIVE</span>
                    <span><span style={{ display: "inline-block", width: 9, height: 9, background: "#3A3E47", marginRight: 6 }} />NEUTRAL</span>
                  </div>
                </div>

                <div className="panel" style={{ flex: 45 }}>
                  <div className="panel-head"><NetworkIcon />Engagement clusters
                    {velo?.network_integrity != null && <span className="ph-right"><span className="chip" style={{ color: "#8FBFA6" }}>NETWORK INTEGRITY {Math.round(velo.network_integrity * 100)}%</span></span>}
                  </div>
                  <div className="panel-body" style={{ padding: "6px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    {topClusters.map((t: any) => (
                      <div key={t.topic_cluster_id} onClick={() => openTopic(t.topic_cluster_id)} style={{ padding: "9px 0", borderBottom: "1px solid var(--rowline)", cursor: "pointer" }}>
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
                          <div style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>
                            <span style={{ color: "var(--text-2)" }}>PAGE TOTAL, {lbWin === "day" ? "TODAY" : lbWin === "week" ? "THIS WEEK" : "THIS MONTH"}</span>
                            {" · "}{e.posts ?? 0} post{(e.posts ?? 0) === 1 ? "" : "s"}
                            {" · "}{e.likes.toLocaleString()} reactions · {e.shares.toLocaleString()} shares · {e.views.toLocaleString()} views
                          </div>
                          {e.best_post && (
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--rowline)" }}>
                              <span style={{ ...MONO, fontSize: 9, color: "var(--muted)", letterSpacing: ".06em", flexShrink: 0 }}>TOP POST</span>
                              <span style={{ ...MONO, fontSize: 10, color: "var(--muted)", maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>&quot;{e.best_post.text || "(no text)"}&quot;</span>
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
                      })().map((p: any) => {
                        const on = picked.has(p.entity_id);
                        const c = pageColor(p.entity_id);
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
                      const roster = (project?.project?.compare_roster || []) as string[];
                      const shownIds = new Set((roster.length ? roster : (ana.page_series || []).slice(0, 12).map((p: any) => p.entity_id)));
                      const chosen = (ana.page_series || []).filter((p: any) => picked.has(p.entity_id) && shownIds.has(p.entity_id));
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
                      <div key={t.topic_cluster_id} onClick={() => openTopic(t.topic_cluster_id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 16px", borderBottom: "1px solid var(--rowline)", cursor: "pointer" }}>
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
                  <div className="panel-head"><TrendIcon />Top posts by engagement
                    <span className="ph-right">
                      <span className="seg seg-sm">
                        {(["day", "week", "month"] as const).map((w) => (
                          <button key={w} data-on={tpWin === w} onClick={() => setTpWin(w)}>{w === "day" ? "TODAY" : w === "week" ? "THIS WEEK" : "THIS MONTH"}</button>
                        ))}
                      </span>
                    </span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    {topPostsWindowed.slice(0, 5).map((p: any, i: number) => (
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

              </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-head"><NetworkIcon />Narratives
            <span className="ph-right">
              <span className="muted" style={{ fontSize: 10, letterSpacing: 0, marginRight: 8 }}>
                stitch clusters into durable narratives — dry run reports to the ops feed and writes nothing
              </span>
              {isAdmin && <button className="btn btn-quiet" style={{ fontSize: 11 }} disabled={stitchBusy} onClick={() => runStitch(false)}>DRY RUN</button>}
              {isAdmin && <button className="btn" style={{ fontSize: 11, marginLeft: 6 }} disabled={stitchBusy} onClick={() => runStitch(true)}>COMMIT</button>}

            </span>
          </div>
          <div className="panel-body">
            <div className="muted" style={{ fontSize: 11, fontFamily: "var(--font-mono)", marginBottom: 10 }}>
              {stitchBusy ? "Stitch pass running — decisions land in the ops feed below."
                : narratives.length ? `${narratives.length} durable narratives · PENETRATION = share of engagement that landed OUTSIDE the bloc the story started in`
                : "No narratives yet — run DRY RUN, read the decisions in the ops feed, then COMMIT."}
            </div>
            {narratives.length > 0 && (
              <div>
                {[...narratives].sort((a: any, b: any) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 25).map((n: any) => {
                  const days = n.history || [];
                  const pages = days.reduce((m: number, d: any) => Math.max(m, d.pages || 0), 0);
                  const origin = [...days].reverse().find((d: any) => d.origin_faction)?.origin_faction || null;
                  const pen = n.penetration;
                  const pct = pen === null || pen === undefined ? null : Math.round(pen * 100);
                  const hue = pct === null ? "var(--muted)" : pct >= 50 ? "var(--danger)" : pct >= 20 ? "var(--amber)" : "#427A5B";
                  return (
                    <div key={n.narrative_id} style={{ padding: "8px 0", borderBottom: "1px solid var(--rowline)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ flex: 1, minWidth: 190, fontSize: 13 }}>{n.label || "untitled"}</span>
                        <span style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>
                          {n.posts}p · {pages}pg · {(n.engagement || 0).toLocaleString()} eng · {n.days}d
                        </span>
                        {origin && <span className="chip" style={{ fontSize: 9 }}>{origin}</span>}
                        <span style={{ ...MONO, fontSize: 11, color: hue, width: 44, textAlign: "right" }}>
                          {pct === null ? "—" : `${pct}%`}
                        </span>
                        <span style={{ width: 70, height: 5, background: "var(--rowline)", flexShrink: 0 }}>
                          {pct !== null && <span style={{ display: "block", height: 5, width: `${Math.min(100, pct)}%`, background: hue }} />}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="muted" style={{ fontSize: 10, marginTop: 8, fontFamily: "var(--font-mono)" }}>
                  &mdash; = faction not set on the carrier pages, so penetration is unknown (never guessed).
                  Low % = the story never left its own bloc.
                </div>
              </div>
            )}
          </div>
        </div>

            </>
          )}

        {view === "edition" && (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="panel-head">
                <span className="panel-title">{edition?.edition?.label || "EDITION"}</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  the market&apos;s editorial day &mdash; stable until the next 8AM scan
                </span>
              </div>
              <div className="panel-body" style={{ padding: 8 }}>
                {editionLoading && <div className="muted" style={{ fontSize: 12 }}>Loading the edition&hellip;</div>}
                {!editionLoading && edition && (() => {
                  const tops = (edition.topics ?? []).filter((t: any) => !String(t.label || "").startsWith("(media"));
                  const posts = tops.reduce((a: number, t: any) => a + (t.posts || 0), 0);
                  const eng = tops.reduce((a: number, t: any) => a + (t.engagement || 0), 0);
                  const wEng = { positive: 0, negative: 0, neutral: 0 } as any;
                  tops.forEach((t: any) => { wEng[t.mood || "neutral"] = (wEng[t.mood || "neutral"] || 0) + (t.engagement || 0); });
                  const mood = (Object.entries(wEng) as any[]).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
                  return (
                    <>
                      {(() => {
                        const num = { fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#E4E7EB", lineHeight: 1.1 } as any;
                        const cap = { fontSize: 10, letterSpacing: "0.12em", color: "#8B949E", marginTop: 2 } as any;
                        return (
                          <div className="row" style={{ gap: 28, flexWrap: "wrap", padding: "6px 8px 14px" }}>
                            <div><div style={num}>{posts}</div><div style={cap}>POSTS IN EDITION</div></div>
                            <div><div style={num}>{eng.toLocaleString()}</div><div style={cap}>ENGAGEMENT</div></div>
                            <div><div style={num}>{tops.length}</div><div style={cap}>STORIES</div></div>
                            <div><div style={{ ...num, textTransform: "lowercase" }}>{mood}</div><div style={cap}>EDITION MOOD</div></div>
                          </div>
                        );
                      })()}
                      {tops.length > 0
                        ? <WordBubbles topics={tops} onPick={openTopic} />
                        : <div className="muted" style={{ fontSize: 12 }}>No posts in this edition &mdash; the window is {edition?.edition?.label}. The next edition opens at the 8AM market-local scan.</div>}
                    </>
                  );
                })()}
              </div>
            </div>
        )}
        {view === "edition" && (
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-head">
              <span className="panel-title">SPECIAL EDITIONS</span>
              <span className="muted" style={{ fontSize: 11 }}>
                any window, measured between scans &mdash; frozen editions never change
              </span>
            </div>
            <div className="panel-body" style={{ padding: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
                <label className="muted" style={{ fontSize: 11 }}>FROM<br />
                  <input type="datetime-local" value={spFrom} onChange={(e) => setSpFrom(e.target.value)} disabled={!isAdmin} title={isAdmin ? "" : "Editor access required"} /></label>
                <label className="muted" style={{ fontSize: 11 }}>TO<br />
                  <input type="datetime-local" value={spTo} onChange={(e) => setSpTo(e.target.value)} disabled={!isAdmin} title={isAdmin ? "" : "Editor access required"} /></label>
                <label className="muted" style={{ fontSize: 11 }}>LABEL (optional)<br />
                  <input type="text" placeholder="e.g. Micoud shooting, first 8 hours" value={spLabel} onChange={(e) => setSpLabel(e.target.value)} style={{ width: 260 }} disabled={!isAdmin} /></label>
                <button className="btn" onClick={extractSpecial} disabled={!isAdmin || spBusy} title={isAdmin ? "Compute this window now (not saved)" : "Editor access required"}>{spBusy ? "WORKING…" : "EXTRACT"}</button>
                <button className="btn btn-quiet" onClick={freezeSpecial} disabled={!isAdmin || spBusy || !spReport || !!spFrozenMeta} title={isAdmin ? "Freeze this window as a permanent edition" : "Editor access required"}>FREEZE AS EDITION</button>
              </div>
              <div className="muted" style={{ fontSize: 10, marginBottom: 10 }}>
                times are in your local timezone &middot; engagement shown is what was GAINED inside the window (sighting-to-sighting) &middot; movement before a post&apos;s first scan is attributed to that first scan
              </div>
              {spReport && (() => {
                const t = spReport.totals || {};
                const num = { fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#E4E7EB", lineHeight: 1.1 } as any;
                const cap = { fontSize: 10, letterSpacing: "0.12em", color: "#8B949E", marginTop: 2 } as any;
                return (
                  <div style={{ borderTop: "1px solid #2A2D35", paddingTop: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: "#E4E7EB", fontSize: 13 }}>{spFrozenMeta?.label || spReport.label}</span>
                      {spFrozenMeta
                        ? <span style={{ fontSize: 10, color: "#C2A34F", letterSpacing: "0.1em" }}>FROZEN &middot; saved {new Date(spFrozenMeta.created_at).toLocaleString()} by {spFrozenMeta.created_by}</span>
                        : <span className="muted" style={{ fontSize: 10 }}>live preview &mdash; not saved</span>}
                    </div>
                    <div className="row" style={{ gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
                      <div><div style={num}>{t.posts_new ?? 0}</div><div style={cap}>NEW POSTS</div></div>
                      <div><div style={num}>{t.posts_active ?? 0}</div><div style={cap}>POSTS MOVING</div></div>
                      <div><div style={num}>{(t.eng_delta ?? 0).toLocaleString()}</div><div style={cap}>ENGAGEMENT GAINED</div></div>
                      <div><div style={num}>{t.stories ?? 0}</div><div style={cap}>STORIES</div></div>
                      <div><div style={num}>{t.pages_entering ?? 0}</div><div style={cap}>PAGES ENTERING</div></div>
                    </div>
                    {(spReport.stories || []).slice(0, 12).map((st: any) => (
                      <div key={st.cluster_id || st.name} style={{ borderTop: "1px solid #22252C", padding: "8px 2px" }}>
                        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, color: "#E4E7EB", fontWeight: 600 }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, marginRight: 7,
                              background: st.mood === "positive" ? "#4C9A6E" : st.mood === "negative" ? "#B0524D" : "#5B616E" }} />
                            {st.name}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#C2A34F" }}>+{(st.eng_delta ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                          {st.posts_new} new post{st.posts_new === 1 ? "" : "s"}
                          {st.new_carriers?.length ? <> &middot; entering: {st.new_carriers.join(", ")}</> : null}
                        </div>
                        {(st.top_posts || []).slice(0, 2).map((tp: any, i: number) => (
                          <div key={i} className="muted" style={{ fontSize: 11, marginTop: 2, paddingLeft: 15 }}>
                            &ldquo;{tp.head}&rdquo; &mdash; {tp.page} (+{tp.eng_delta})
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ borderTop: "1px solid #2A2D35", marginTop: 12, paddingTop: 8 }}>
                <div className="muted" style={{ fontSize: 10, letterSpacing: "0.12em", marginBottom: 6 }}>SAVED EDITIONS</div>
                {spList.length === 0 && <div className="muted" style={{ fontSize: 11 }}>None yet &mdash; the first frozen edition will appear here.</div>}
                {spList.map((ed: any) => (
                  <div key={ed.id} className="row" style={{ justifyContent: "space-between", padding: "4px 2px", cursor: "pointer" }}
                       onClick={() => openSaved(ed.id)} title="Open this frozen edition">
                    <span style={{ fontSize: 12, color: "#B8BEC7" }}>{ed.label}</span>
                    <span className="muted" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
                      +{(ed.totals?.eng_delta ?? 0).toLocaleString()} &middot; {new Date(ed.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {view === "setup" && (
          <div className="ops-stack" style={{ flexDirection: "column", gap: 14 }}>
            <div className="muted" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
              Configuration — the roster, the factions, the gazetteer. Set once; the read stays clean.
            </div>
            <div className="panel">
              <div className="panel-head"><NetworkIcon />Narrative machinery</div>
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {isAdmin && <button className="btn btn-quiet" style={{ fontSize: 11 }} onClick={seedGazetteer}>LOAD GAZETTEER</button>}
                  {isAdmin && <button className="btn btn-quiet" style={{ fontSize: 11 }} title="Copies YOUR gazetteer judgments onto pages that resolve to those entities. Empty slots only \u2014 a faction set by hand is never overwritten. Ambiguous matches are skipped." onClick={seedFactions}>SEED FACTIONS</button>}
                  {isAdmin && <button style={{ fontSize: 11, border: "1px solid var(--carbon)", background: "transparent", color: "var(--danger)", cursor: "pointer", padding: "4px 10px" }} disabled={stitchBusy} onClick={resetNarratives}>RESET NARRATIVES</button>}
                </div>
                {(() => {
                  const anchors = (project?.anchors || []) as any[];
                  const unset = anchors.filter((a: any) => !a.faction).length;
                  if (!anchors.length) return null;
                  return (
                    <div className="muted" style={{ ...MONO, fontSize: 11, color: unset ? "var(--amber)" : "var(--muted)" }}>
                      {unset === 0
                        ? `All ${anchors.length} sources have a faction \u2014 penetration is computed for every narrative.`
                        : `${unset} of ${anchors.length} sources have NO faction set \u2014 any narrative they carry reports penetration as \u2014 (unknown, never guessed). Set them in Sources below.`}
                    </div>
                  );
                })()}
              </div>
            </div>
                  <div className="panel" style={{ flex: 22 }}>
                    <div className="panel-head"><NetworkIcon />Sources
                      <span className="ph-right">
                        {isAdmin && (
                          <button className="btn" style={{ fontSize: 9, padding: "4px 10px", marginRight: 6 }}
                            disabled={dedupBusy}
                            onClick={() => { if (dedup) setDedup(null); else loadDedup(); }}>
                            {dedupBusy ? "SCANNING…" : dedup ? "CLOSE" : "HOUSEKEEP"}
                          </button>
                        )}
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
                      {dedup && (
                        <div style={{ border: "1px solid var(--carbon)", background: "var(--void)", padding: 10, maxHeight: 320, overflowY: "auto" }}>
                          <div className="stat-label" style={{ marginBottom: 8 }}>Housekeeping — duplicates &amp; dead sources</div>
                          {(dedup.cosmetic?.length || 0) > 0 && (
                            <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--rowline)" }}>
                              <div style={{ fontSize: 10, color: "var(--text-2)", marginBottom: 6 }}>
                                {dedup.cosmetic.reduce((n: number, g: any) => n + g.merge.length, 0)} cosmetic URL variant(s) of existing sources (http/www/slash only) — safe to merge automatically.
                              </div>
                              {dedup.cosmetic.map((g: any, i: number) => (
                                <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-2)", padding: "2px 0" }}>
                                  {g.merge.map((m: any) => m.public_ref).join(", ")} → <span style={{ color: "var(--amber, #C2A34F)" }}>{g.keep.public_ref}</span>
                                </div>
                              ))}
                              <button className="btn btn-primary" style={{ marginTop: 6, fontSize: 9, padding: "4px 10px" }} disabled={dedupBusy} onClick={dedupBackfill}>Auto-merge variants</button>
                            </div>
                          )}
                          {(dedup.proposals?.length || 0) === 0 && (dedup.cosmetic?.length || 0) === 0 && (
                            <div className="muted" style={{ fontSize: 11 }}>Roster is clean — no duplicates or dead sources found.</div>
                          )}
                          {(dedup.proposals || []).map((g: any, i: number) => (
                            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--rowline)" }}>
                              <div style={{ fontSize: 10, marginBottom: 4 }}>
                                <span style={{ color: g.kind === "dead" ? "var(--danger)" : "var(--amber, #C2A34F)", fontWeight: 600, textTransform: "uppercase", fontSize: 9 }}>{g.kind}</span>
                                <span className="muted" style={{ marginLeft: 8, fontSize: 10 }}>{g.reason}</span>
                              </div>
                              {g.anchors.map((a: any) => (
                                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: a.id === g.suggested_keep ? "var(--amber, #C2A34F)" : "var(--text-2)" }}
                                    title={a.public_ref}>
                                    {(a.public_ref || a.label || "").replace("https://www.facebook.com/", "fb/").replace("https://", "")}
                                    <span className="muted"> · {a.items} item{a.items === 1 ? "" : "s"}{a.id === g.suggested_keep ? " · suggested keep" : ""}</span>
                                  </span>
                                  <button className="btn" style={{ fontSize: 8, padding: "2px 8px" }} disabled={dedupBusy}
                                    onClick={() => dedupDecide([], [a.id])}>KEEP</button>
                                  <button style={{ border: "1px solid var(--carbon)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 8, padding: "2px 8px" }} disabled={dedupBusy}
                                    onClick={() => dedupDecide([a.id], [], a.public_ref || a.label)}>ELIMINATE</button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      {catEdit && (
                        <div style={{ border: "1px solid var(--carbon)", background: "var(--void)", padding: 10, maxHeight: 260, overflowY: "auto" }}>
                          <div className="stat-label" style={{ marginBottom: 8 }}>Assign each source a category</div>
                          {(project?.anchors || []).map((a: any) => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--rowline)" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {(a.public_ref || a.label || "").replace("https://www.facebook.com/", "fb/").replace("https://", "")}
                              </span>
                              {(a.page_category || a.service_area) && (
                                <span className="muted" style={{ ...MONO, fontSize: 9, flexShrink: 0, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${a.page_category || ""}${a.service_area ? " · " + a.service_area : ""}`}>
                                  {a.page_category || "?"}{a.service_area ? ` · ${a.service_area}` : ""}
                                </span>
                              )}
                              <select className="select" style={{ width: 110, fontSize: 10, padding: "3px 6px" }}
                                value={kindDraft[a.id] ?? (a.kind || "other")}
                                onChange={(e) => setKindDraft((cur) => ({ ...cur, [a.id]: e.target.value }))}>
                                {["media", "group", "politician", "government", "institution", "other"].map((k) => <option key={k} value={k}>{k}</option>)}
                              </select>
                              <select className="select" title="Faction — YOUR judgment, never the machine&apos;s. state = the government machinery (ministries, police). coalition = the governing political side (SLP, ministers, incl. the independents in cabinet). Penetration measures how far a narrative escapes its own BLOC — a ministry post landing only on party pages has NOT spread."
                                style={{ width: 108, fontSize: 10, padding: "3px 6px" }}
                                value={factionDraft[a.id] ?? (a.faction || "unknown")}
                                onChange={(e) => setFactionDraft((cur) => ({ ...cur, [a.id]: e.target.value }))}>
                                {["unknown", "state", "coalition", "opposition", "media", "civil", "neutral"].map((f) => <option key={f} value={f}>{f}</option>)}
                              </select>
                              {isAdmin && <button title="Remove this source" onClick={() => deleteSource(a.id, a.public_ref || a.label)}
                                style={{ border: "1px solid var(--carbon)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 11, padding: "2px 7px", borderRadius: 0, flexShrink: 0 }}>×</button>}
                            </div>
                          ))}
                          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={saveKinds}>Save categories</button>
                        </div>
                      )}
                      <div className="muted" style={{ fontSize: 11 }}>Paste anything — the app extracts and cleans the links. Organize with headers (MEDIA: / POLITICIANS: / GROUPS: / GOVERNMENT:) and each link below a header is auto-categorized.</div>
                      <textarea className="input" style={{ minHeight: 180, resize: "none", flex: 1 }} value={urls} onChange={(e) => setUrls(e.target.value)} />
                      {isAdmin && (<button className="btn btn-primary" style={{ width: "100%" }} disabled={busy} onClick={collect}>{busy ? "COLLECTING…" : "Add sources & collect"}</button>)}
  {isAdmin && (
                      <button className="btn btn-quiet" style={{ width: "100%", marginTop: 6 }} disabled={busy} onClick={async () => {
                        setBusy(true); setError(null); setMsg(null);
                        try {
                          const r = await call(`/projects/${id}/scan-pages`, "POST");
                          if (r.error) setError(`Page scan: ${r.error}`);
                          else setMsg(r.note || "Page scan started — the result lands in the ops feed in a few minutes.");
                        } catch (e: any) { setError(e.message || "Page scan failed."); }
                        finally { setBusy(false); }
                      }}>SCAN PAGES (profiles · followers · categories)</button>)}
                    </div>
                  </div>
                <div className="ops-stack">
                  <div className="panel" style={{ flex: 1 }}>
                    <div className="panel-head"><NetworkIcon />Market scout</div>
                    <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {isAdmin && (<button className="btn btn-primary" style={{ width: "100%" }} disabled={scouting} onClick={scout}>{scouting ? "SCOUTING…" : "Scout the market"}</button>)}
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
                      {(disc.pages || []).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div className="muted" style={{ fontSize: 11, marginBottom: 5, letterSpacing: ".04em" }}>SCOUT PROPOSES — pages mentioned often enough to matter. Nothing joins the roster without your word.</div>
                          {(disc.pages || []).slice(0, 6).map((p: any) => (
                            <div key={p.ref} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--rowline)" }}>
                              <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}><Ext href={p.ref}>{String(p.ref).replace("https://www.facebook.com/", "").replace("https://facebook.com/", "")} ↗</Ext></span>
                              <span style={{ ...MONO, fontSize: 10, color: "var(--amber)" }}>·{p.co_count}</span>
                              {p.locality === 1 && <span style={{ ...MONO, fontSize: 9, color: "var(--green, #3FA36B)", flexShrink: 0 }}>ST. LUCIA</span>}
                              {p.locality === 3 && <span style={{ ...MONO, fontSize: 9, color: "var(--danger)", flexShrink: 0 }} title={p.service_area || ""}>ELSEWHERE</span>}
                              {p.category && <span className="muted" style={{ ...MONO, fontSize: 9, flexShrink: 0 }}>{p.category}</span>}
  {isAdmin && (<>                            <button className="btn btn-quiet" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => scoutDecide(p.ref, "approve")}>APPROVE</button>
                              <button style={{ border: "1px solid var(--carbon)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: 10, padding: "2px 8px", borderRadius: 0 }} onClick={() => scoutDecide(p.ref, "reject")}>REJECT</button></>)}
                            </div>
                          ))}
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
          </div>
        )}
        </div>

        {teamOpen && (
          <div onClick={() => setTeamOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(13,14,18,0.82)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: "100%", maxWidth: 560, maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
              <div className="panel-head">Team &amp; access
                <span className="ph-right"><button className="btn btn-quiet" style={{ fontSize: 12 }} onClick={() => setTeamOpen(false)}>CLOSE ×</button></span>
              </div>
              <div className="panel-body" style={{ overflowY: "auto" }}>
                <div style={{ marginBottom: 14 }}>
                  <div className="muted" style={{ fontSize: 11, letterSpacing: ".05em", marginBottom: 8 }}>INVITE SOMEONE</div>
                  <input className="select" style={{ width: "100%", marginBottom: 8, padding: "8px 10px" }} type="email" placeholder="their email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button onClick={() => setInvRole("editor")} style={{ flex: 1, padding: "7px 0", borderRadius: 3, border: "1px solid var(--carbon)", background: invRole === "editor" ? "var(--carbon)" : "transparent", color: "inherit", cursor: "pointer", fontSize: 12 }}>
                      OPERATOR<div className="muted" style={{ fontSize: 9, marginTop: 2 }}>full — can spend</div>
                    </button>
                    <button onClick={() => setInvRole("viewer")} style={{ flex: 1, padding: "7px 0", borderRadius: 3, border: "1px solid var(--carbon)", background: invRole === "viewer" ? "var(--carbon)" : "transparent", color: "inherit", cursor: "pointer", fontSize: 12 }}>
                      OBSERVER<div className="muted" style={{ fontSize: 9, marginTop: 2 }}>view only — no spend</div>
                    </button>
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={sendInvite}>Create invite link</button>
                  {invLink && (
                    <div style={{ marginTop: 8 }}>
                      <input readOnly value={invLink} onFocus={(e) => e.currentTarget.select()}
                        style={{ width: "100%", padding: 8, background: "var(--void)", border: "1px solid var(--carbon)", borderRadius: 3, color: "inherit", ...MONO, fontSize: 10 }} />
                      <button className="btn btn-quiet" style={{ fontSize: 10, marginTop: 6 }} onClick={async () => {
                        try { await navigator.clipboard.writeText(invLink); setMsg("Link copied."); }
                        catch { setError("Clipboard blocked — click the link box (it selects itself) and copy manually."); }
                      }}>COPY LINK</button>
                    </div>
                  )}
                </div>
                <div style={{ borderTop: "1px solid var(--carbon)", paddingTop: 12 }}>
                  <div className="muted" style={{ fontSize: 11, letterSpacing: ".05em", marginBottom: 8 }}>ON THIS PROJECT</div>
                  {(team?.members || []).map((m: any) => (
                    <div key={m.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--rowline)" }}>
                      <span style={{ fontSize: 13 }}>{m.display_name || m.email} <span className="muted" style={{ fontSize: 11 }}>{m.email}</span></span>
                      <span style={{ ...MONO, fontSize: 10, color: m.role === "owner" ? "var(--amber)" : "var(--muted)" }}>{m.role === "editor" ? "OPERATOR" : m.role === "viewer" ? "OBSERVER" : "OWNER"}</span>
                    </div>
                  ))}
                  {(team?.pending || []).length > 0 && (
                    <>
                      <div className="muted" style={{ fontSize: 10, letterSpacing: ".05em", margin: "10px 0 6px" }}>PENDING</div>
                      {team.pending.map((p: any) => (
                        <div key={p.email} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--rowline)", opacity: 0.7 }}>
                          <span style={{ fontSize: 12 }}>{p.email}</span>
                          <span style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{p.role === "editor" ? "OPERATOR" : "OBSERVER"} · invited</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {topicDetail.open && (
          <div onClick={() => setTopicDetail({ open: false, loading: false, data: null })}
            style={{ position: "fixed", inset: 0, background: "rgba(13,14,18,0.82)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} className="panel" style={{ width: "100%", maxWidth: 760, maxHeight: "82vh", display: "flex", flexDirection: "column" }}>
              <div className="panel-head">
                {topicDetail.data?.summary?.label || "TOPIC"}
                <span className="ph-right">
                  {cat && <span className="chip chip-accent">{cat.toUpperCase()}</span>}
                  <button className="btn btn-quiet" style={{ fontSize: 12 }} onClick={() => setTopicDetail({ open: false, loading: false, data: null })}>CLOSE ×</button>
                </span>
              </div>
              <div className="panel-body" style={{ overflowY: "auto" }}>
                {topicDetail.loading && <div className="muted" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>Reading the topic&apos;s posts…</div>}
                {topicDetail.data?.summary && (
                  <>
                    <div className="row" style={{ gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ ...MONO, fontSize: 12 }}>{topicDetail.data.summary.posts} posts</span>
                      <span style={{ ...MONO, fontSize: 12, color: "var(--amber)" }}>{Number(topicDetail.data.summary.engagement).toLocaleString()} eng</span>
                      <span style={{ ...MONO, fontSize: 12 }}>{topicDetail.data.summary.pages} pages</span>
                      {topicDetail.data.summary.mood && <Mood m={topicDetail.data.summary.mood} />}
                    </div>
                    {topicDetail.data.summary.top_pages?.length > 0 && (
                      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {topicDetail.data.summary.top_pages.map((tp: any) => (
                          <span key={tp.page} className="chip">{tp.page} <span style={{ color: "var(--amber)" }}>·{Number(tp.engagement).toLocaleString()}</span></span>
                        ))}
                      </div>
                    )}
                    <div style={{ borderTop: "1px solid var(--carbon)" }}>
                      {topicDetail.data.posts.map((p: any, i: number) => (
                        <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--rowline)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                            <span style={{ fontSize: 13 }}>{p.page}</span>
                            <span style={{ ...MONO, fontSize: 10, color: "var(--muted)" }}>{p.day.slice(5)}</span>
                            <span style={{ ...MONO, fontSize: 11, color: "var(--amber)" }}>{p.engagement.toLocaleString()} eng</span>
                            {p.url && <span style={{ ...MONO, fontSize: 10, marginLeft: "auto" }}><Ext href={p.url}>open ↗</Ext></span>}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, color: "#B8BEC7" }}>{p.text || <span className="muted">(no text)</span>}</div>
                          <div style={{ ...MONO, fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{p.reactions.toLocaleString()} reactions · {p.comments.toLocaleString()} comments · {p.shares.toLocaleString()} shares{p.views ? ` · ${p.views.toLocaleString()} views` : ""}</div>
                        </div>
                      ))}
                      {topicDetail.data.posts.length === 0 && !topicDetail.loading && (
                        <div className="muted" style={{ fontSize: 12, padding: "10px 0" }}>No indexed posts for this topic yet — run one Rebuild to fill the index.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
