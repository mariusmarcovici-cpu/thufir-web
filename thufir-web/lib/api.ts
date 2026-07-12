// Talks to the backend (Railway). Every call goes through here so the
// login token is attached in one place.

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const TOKEN_KEY = "thufir_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  window.localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore non-JSON errors */
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- types ----
export interface User { id: string; email: string; display_name: string; }
export interface TokenOut { access_token: string; token_type: string; }
export interface ProjectSummary {
  id: string; name: string; region_label: string; languages: string[];
  status: string; visibility: string; role: string; anchor_count: number; updated_at: string;
}
export interface AnchorIn { label: string; kind: string; public_ref?: string | null; }
export interface CreateProjectIn {
  name: string; region_label: string; languages: string[]; topic_seeds: string[];
  discovery_level: number; anchors: AnchorIn[];
}

// ---- auth ----
export const api = {
  register: (email: string, password: string, display_name: string) =>
    request<TokenOut>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),
  login: (email: string, password: string) =>
    request<TokenOut>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/auth/me"),

  // ---- projects ----
  listProjects: () => request<{ projects: ProjectSummary[] }>("/projects"),
  createProject: (body: CreateProjectIn) =>
    request<{ id: string }>("/projects", { method: "POST", body: JSON.stringify(body) }),
  getProject: (id: string) => request<any>(`/projects/${id}`),

  // ---- data (used by the dashboard screens, added next) ----
  topicVelocity: (projectId: string, window = "24h") =>
    request<any>(`/projects/${projectId}/velocity/topics?window=${window}`),
  // ---- access / members ----
  invite: (projectId: string, email: string, role: "editor" | "viewer") =>
    request<{ invite_token: string; expires_at: string }>(`/auth/projects/${projectId}/invite`, {
      method: "POST", body: JSON.stringify({ email, role }),
    }),
  members: (projectId: string) =>
    request<any>(`/auth/projects/${projectId}/members`),
  inviteInfo: (token: string) =>
    request<any>(`/auth/invite-info?token=${encodeURIComponent(token)}`),
  acceptInvite: (token: string) =>
    request<{ project_id: string; role: string }>(`/auth/accept-invite?token=${encodeURIComponent(token)}`, {
      method: "POST",
    }),

  compareEntities: (projectId: string, ids: string[], grain = "7 days") =>
    request<any>(
      `/projects/${projectId}/entities/compare?grain=${encodeURIComponent(grain)}&` +
        ids.map((i) => `ids=${encodeURIComponent(i)}`).join("&"),
    ),
};

