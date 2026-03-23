import type { DailyEntry, Dashboard, Project, Stage, User } from "./types";

const base = import.meta.env.VITE_API_BASE ?? "";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("obra_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers as Record<string, string>),
    },
  });
  if (r.status === 401) {
    localStorage.removeItem("obra_token");
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).then(async (r) => {
        if (!r.ok) {
          const raw = await r.text();
          let msg = raw;
          try {
            const j = JSON.parse(raw) as { detail?: string | string[] };
            if (j.detail !== undefined) {
              msg = Array.isArray(j.detail) ? j.detail.join(", ") : String(j.detail);
            }
          } catch {
            /* texto plano */
          }
          throw new Error(msg || "Falha no login");
        }
        return r.json() as Promise<{ access_token: string; user: User }>;
      }),
    me: () => req<User>("/api/auth/me"),
  },
  users: {
    list: () => req<User[]>("/api/users"),
    create: (username: string, password: string, is_master: boolean) =>
      req<User>("/api/users", {
        method: "POST",
        body: JSON.stringify({ username, password, is_master }),
      }),
    delete: (id: number) => req(`/api/users/${id}`, { method: "DELETE" }),
  },
  health: () => req<{ status: string }>("/api/health"),
  projects: {
    list: () => req<Project[]>("/api/projects"),
    get: (id: number) => req<Project>(`/api/projects/${id}`),
    create: (name: string, description?: string) =>
      req<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null }),
      }),
    delete: (id: number) => req(`/api/projects/${id}`, { method: "DELETE" }),
  },
  stages: {
    list: (projectId: number) => req<Stage[]>(`/api/projects/${projectId}/stages`),
    create: (projectId: number, body: Omit<Stage, "id" | "project_id">) =>
      req<Stage>(`/api/projects/${projectId}/stages`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (stageId: number, patch: Partial<Stage>) =>
      req<Stage>(`/api/stages/${stageId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    delete: (stageId: number) => req(`/api/stages/${stageId}`, { method: "DELETE" }),
    entries: (stageId: number) => req<DailyEntry[]>(`/api/stages/${stageId}/entries`),
    upsertEntry: (stageId: number, day: string, body: Partial<DailyEntry> & { day: string }) =>
      req<DailyEntry>(`/api/stages/${stageId}/entries/${day}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  },
  bulkPlanned: (
    projectId: number,
    entries: Array<{ stage_id: number; day: string; planned_optimistic: number; planned_pessimistic: number }>
  ) =>
    req<{ upserted: number }>(`/api/projects/${projectId}/entries/bulk-planned`, {
      method: "POST",
      body: JSON.stringify({ entries }),
    }),
  bulkExecuted: (
    projectId: number,
    entries: Array<{ stage_id: number; day: string; executed: number; execution_note?: string | null }>
  ) =>
    req<{ upserted: number }>(`/api/projects/${projectId}/entries/bulk-executed`, {
      method: "POST",
      body: JSON.stringify({ entries }),
    }),
  dashboard: (projectId: number) => req<Dashboard>(`/api/projects/${projectId}/dashboard`),
};
