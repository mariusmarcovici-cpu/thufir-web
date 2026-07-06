"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { api, ProjectSummary } from "@/lib/api";
import TopBar from "@/components/TopBar";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusChip(status: string) {
  if (status === "collecting") return <span className="chip chip-ok">collecting</span>;
  if (status === "paused") return <span className="chip">paused</span>;
  return <span className="chip">draft</span>;
}

export default function ProjectsPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .listProjects()
      .then((r) => setProjects(r.projects))
      .catch(() => setError("Couldn't load your projects. Refresh to try again."));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="stack" style={{ gap: 4, marginBottom: 18 }}>
          <h1 style={{ fontSize: 18 }}>Your projects</h1>
          <span className="muted" style={{ fontSize: 13 }}>
            private research workspaces — only you and invited collaborators can see these
          </span>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="grid-cards">
          {projects?.map((p) => (
            <div
              key={p.id}
              className="project-card"
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/projects/${p.id}`)}
              onKeyDown={(e) => e.key === "Enter" && router.push(`/projects/${p.id}`)}
            >
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                <span className="muted" title="Private" aria-label="Private">🔒</span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="chip">{p.region_label}</span>
                {p.languages.length > 0 && <span className="chip">{p.languages.join(" · ")}</span>}
                {statusChip(p.status)}
              </div>
              <div className="row" style={{ gap: 16, fontSize: 12, color: "var(--text-2)" }}>
                <span>
                  <b style={{ color: "var(--text)", fontWeight: 500 }}>{p.anchor_count}</b> anchors
                </span>
                <span style={{ textTransform: "capitalize" }}>{p.role}</span>
              </div>
              <div className="spread divider" style={{ paddingTop: 9 }}>
                <span className="muted" style={{ fontSize: 11 }}>updated {timeAgo(p.updated_at)}</span>
              </div>
            </div>
          ))}

          {/* new project */}
          <div className="new-card" onClick={() => router.push("/projects/new")}>
            <div
              style={{
                width: 34, height: 34, borderRadius: "50%", background: "var(--accent-bg)",
                color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}
            >
              +
            </div>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>New project</span>
            <span className="muted" style={{ fontSize: 11 }}>define a market and start collecting</span>
          </div>
        </div>

        {projects && projects.length === 0 && (
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            You don&apos;t have any projects yet. Create your first one to define a market.
          </p>
        )}
      </div>
    </>
  );
}
