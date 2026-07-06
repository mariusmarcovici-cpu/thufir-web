"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { api, AnchorIn, ApiError } from "@/lib/api";
import TopBar from "@/components/TopBar";

const LANG_PRESETS = ["English", "French", "Kwéyòl", "Spanish"];
const ANCHOR_KINDS = ["outlet", "government", "broadcast", "institution", "other"];

function discoveryLabel(v: number): string {
  if (v < 0.34) return "narrow";
  if (v < 0.67) return "balanced";
  return "wide";
}

export default function NewProjectPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [discovery, setDiscovery] = useState(0.5);
  const [anchors, setAnchors] = useState<AnchorIn[]>([{ label: "", kind: "outlet" }]);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [seedInput, setSeedInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !user) {
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  function toggleLang(l: string) {
    setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));
  }
  function updateAnchor(i: number, patch: Partial<AnchorIn>) {
    setAnchors((cur) => cur.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function addAnchor() {
    setAnchors((cur) => [...cur, { label: "", kind: "outlet" }]);
  }
  function removeAnchor(i: number) {
    setAnchors((cur) => cur.filter((_, idx) => idx !== i));
  }
  function addSeed() {
    const s = seedInput.trim();
    if (s && !seeds.includes(s)) setSeeds((cur) => [...cur, s]);
    setSeedInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanAnchors = anchors.filter((a) => a.label.trim());
    if (!name.trim() || !region.trim()) {
      setError("Give the project a name and a region.");
      return;
    }
    setBusy(true);
    try {
      const { id } = await api.createProject({
        name: name.trim(),
        region_label: region.trim(),
        languages,
        topic_seeds: seeds,
        discovery_level: discovery,
        anchors: cleanAnchors,
      });
      router.replace(`/projects/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the project. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <div className="page" style={{ maxWidth: 900 }}>
        <button className="btn btn-quiet" style={{ marginBottom: 14 }} onClick={() => router.back()}>
          ← Projects
        </button>
        <h1 style={{ fontSize: 18, marginBottom: 16 }}>New project</h1>

        <form
          onSubmit={submit}
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {/* left: the form */}
            <div className="card stack" style={{ gap: 16 }}>
              <div>
                <label className="field">Project name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dominica civic discourse" />
              </div>

              <div>
                <label className="field">Region label · metadata only, not used to filter</label>
                <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Dominica" />
              </div>

              <div>
                <label className="field">Languages</label>
                <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                  {LANG_PRESETS.map((l) => (
                    <button key={l} type="button" className="pill-toggle" data-on={languages.includes(l)} onClick={() => toggleLang(l)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider" style={{ paddingTop: 14 }}>
                <label className="field" style={{ marginBottom: 2 }}>Anchor nodes</label>
                <p className="muted" style={{ fontSize: 11, margin: "0 0 10px" }}>
                  public institutional assets that pin the market to place — the market grows outward from these
                </p>
                <div className="stack" style={{ gap: 8 }}>
                  {anchors.map((a, i) => (
                    <div key={i} className="row" style={{ gap: 7 }}>
                      <input
                        className="input"
                        value={a.label}
                        onChange={(e) => updateAnchor(i, { label: e.target.value })}
                        placeholder="e.g. Dominica News Online"
                      />
                      <select className="select" style={{ width: 140 }} value={a.kind} onChange={(e) => updateAnchor(i, { kind: e.target.value })}>
                        {ANCHOR_KINDS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                      {anchors.length > 1 && (
                        <button type="button" className="btn-danger-text" aria-label="Remove anchor" onClick={() => removeAnchor(i)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-quiet" style={{ marginTop: 8 }} onClick={addAnchor}>+ Add anchor</button>
              </div>

              <div className="divider" style={{ paddingTop: 14 }}>
                <div className="spread" style={{ marginBottom: 8 }}>
                  <label className="field" style={{ margin: 0 }}>Discovery</label>
                  <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>{discoveryLabel(discovery)}</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={discovery} onChange={(e) => setDiscovery(parseFloat(e.target.value))} />
                <div className="spread muted" style={{ fontSize: 10 }}>
                  <span>narrow · anchors only</span>
                  <span>wide · more discovery</span>
                </div>
              </div>

              <div>
                <label className="field">Topic seeds · optional</label>
                <div className="row" style={{ gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                  {seeds.map((s) => (
                    <span key={s} className="chip" style={{ cursor: "pointer" }} onClick={() => setSeeds((c) => c.filter((x) => x !== s))}>
                      {s} ✕
                    </span>
                  ))}
                </div>
                <div className="row" style={{ gap: 7 }}>
                  <input
                    className="input"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addSeed(); }
                    }}
                    placeholder="#budget2026, roads…"
                  />
                  <button type="button" className="btn" onClick={addSeed}>Add</button>
                </div>
              </div>
            </div>

            {/* right: explainer + actions */}
            <div className="stack" style={{ gap: 12 }}>
              <div className="card stack" style={{ gap: 11 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>How a market is defined</span>
                <div className="stack" style={{ gap: 10, fontSize: 12, color: "var(--text-2)" }}>
                  <span>Native geotags sit under 2%, so location can&apos;t be a filter — the market is seeded, not fenced.</span>
                  <span><b style={{ color: "var(--text)", fontWeight: 500 }}>Anchor nodes</b> are the ground truth — public outlets and institutions that fix the market to a place.</span>
                  <span><b style={{ color: "var(--text)", fontWeight: 500 }}>Discovery</b> expands outward: accounts and topics that keep appearing with the anchors join the market&apos;s map.</span>
                  <span>Everything collected is scoped to this project and never shared with other projects.</span>
                </div>
              </div>

              <div className="card row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontSize: 15 }}>🔒</span>
                <div className="stack">
                  <span style={{ fontSize: 13 }}>Private to you</span>
                  <span className="muted" style={{ fontSize: 11 }}>invite collaborators after it&apos;s created</span>
                </div>
              </div>

              {error && <div className="alert alert-danger">{error}</div>}

              <div className="row" style={{ gap: 9, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
                <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
