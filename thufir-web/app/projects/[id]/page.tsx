"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import TopBar from "@/components/TopBar";

export default function ProjectDetailPage() {
  const { user, loading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    api
      .getProject(id)
      .then(setData)
      .catch(() => setError("Couldn't load this project."));
  }, [user, id]);

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
      <div className="page" style={{ maxWidth: 900 }}>
        <button className="btn btn-quiet" style={{ marginBottom: 14 }} onClick={() => router.push("/projects")}>
          ← Projects
        </button>

        {error && <div className="alert alert-danger">{error}</div>}
        {!data && !error && <div className="spinner" aria-label="Loading" />}

        {data && (
          <>
            <div className="spread" style={{ marginBottom: 6, alignItems: "flex-start" }}>
              <h1 style={{ fontSize: 20 }}>{data.project.name}</h1>
              <span className="chip" style={{ textTransform: "capitalize" }}>{data.role}</span>
            </div>

            <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              <span className="chip">{data.project.region_label}</span>
              {(data.project.languages || []).length > 0 && (
                <span className="chip">{data.project.languages.join(" · ")}</span>
              )}
              <span className={data.project.status === "collecting" ? "chip chip-ok" : "chip"}>
                {data.project.status}
              </span>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Anchor nodes</div>
              {data.anchors.length === 0 ? (
                <span className="muted" style={{ fontSize: 13 }}>No anchor nodes added.</span>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {data.anchors.map((a: any) => (
                    <div
                      key={a.id}
                      className="spread"
                      style={{ borderBottom: "1px solid var(--border-soft)", paddingBottom: 8 }}
                    >
                      <span style={{ fontSize: 13 }}>{a.label}</span>
                      <span className="chip">{a.kind}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ textAlign: "center", padding: "28px 16px" }}>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Dashboards coming soon</div>
              <p className="muted" style={{ fontSize: 13, margin: 0, maxWidth: 460, marginInline: "auto" }}>
                Topic velocity, the entity engine, and coordination views will appear here once data
                collection is switched on for this project.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
