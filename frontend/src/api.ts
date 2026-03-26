import type {
  DailyEntry,
  Dashboard,
  FinancialDailyPlan,
  FinancialDailyProduction,
  FinancialEntry,
  CsvImportResult,
  FinancialPanelDashboard,
  ObraFinancialAdvance,
  BillingForecastEntry,
  FinancialTeam,
  Project,
  Stage,
  User,
} from "./types";

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

async function postSpreadsheetImport(path: string, file: File): Promise<CsvImportResult> {
  const t = localStorage.getItem("obra_token");
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: fd,
  });
  if (r.status === 401) {
    localStorage.removeItem("obra_token");
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!r.ok) {
    const tx = await r.text();
    throw new Error(tx || r.statusText);
  }
  return r.json() as Promise<CsvImportResult>;
}

function financialQueryString(q?: { date_from?: string; date_to?: string; team_id?: number }) {
  const sp = new URLSearchParams();
  if (q?.date_from) sp.set("date_from", q.date_from);
  if (q?.date_to) sp.set("date_to", q.date_to);
  if (q?.team_id != null && !Number.isNaN(q.team_id)) sp.set("team_id", String(q.team_id));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).then(async (r) => {
        if (r.status === 429) {
          throw new Error("Muitas tentativas de login. Aguarde alguns minutos.");
        }
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
    create: (name: string, description?: string, obra_total_value_brl?: number | null) =>
      req<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || null,
          obra_total_value_brl: obra_total_value_brl ?? null,
        }),
      }),
    update: (id: number, patch: Partial<Pick<Project, "name" | "description" | "obra_total_value_brl">>) =>
      req<Project>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
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
  importEntriesSpreadsheet: (projectId: number, kind: "planned" | "executed", file: File) =>
    postSpreadsheetImport(`/api/projects/${projectId}/entries/import.xls?kind=${kind}`, file),
  dashboard: (projectId: number) => req<Dashboard>(`/api/projects/${projectId}/dashboard`),
  financial: {
    panel: (projectId: number, q?: { date_from?: string; date_to?: string; team_id?: number }) =>
      req<FinancialPanelDashboard>(
        `/api/projects/${projectId}/financial/dashboard${financialQueryString(q)}`
      ),
    exportXlsx: async (
      projectId: number,
      q?: { date_from?: string; date_to?: string; team_id?: number }
    ): Promise<Blob> => {
      const path = `/api/projects/${projectId}/financial/export.xlsx${financialQueryString(q)}`;
      const r = await fetch(`${base}${path}`, { headers: authHeaders() });
      if (r.status === 401) {
        localStorage.removeItem("obra_token");
        throw new Error("Sessão expirada. Faça login novamente.");
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || r.statusText);
      }
      return r.blob();
    },
    listTeams: (projectId: number) =>
      req<FinancialTeam[]>(`/api/projects/${projectId}/financial/teams`),
    createTeam: (
      projectId: number,
      body: Pick<FinancialTeam, "name" | "team_type" | "uen" | "encarregado"> & {
        default_daily_target_brl?: number | null;
      }
    ) =>
      req<FinancialTeam>(`/api/projects/${projectId}/financial/teams`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateTeam: (
      projectId: number,
      teamId: number,
      body: Pick<FinancialTeam, "name" | "team_type" | "uen" | "encarregado"> & {
        default_daily_target_brl?: number | null;
      }
    ) =>
      req<FinancialTeam>(`/api/projects/${projectId}/financial/teams/${teamId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    deleteTeam: (projectId: number, teamId: number) =>
      req(`/api/projects/${projectId}/financial/teams/${teamId}`, { method: "DELETE" }),
    listPlans: (projectId: number) =>
      req<FinancialDailyPlan[]>(`/api/projects/${projectId}/financial/plans`),
    createPlan: (
      projectId: number,
      body: Pick<FinancialDailyPlan, "day" | "team_id" | "daily_target_brl" | "daily_planning_brl">
    ) =>
      req<FinancialDailyPlan>(`/api/projects/${projectId}/financial/plans`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updatePlan: (
      projectId: number,
      planId: number,
      body: Pick<FinancialDailyPlan, "day" | "team_id" | "daily_target_brl" | "daily_planning_brl">
    ) =>
      req<FinancialDailyPlan>(`/api/projects/${projectId}/financial/plans/${planId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    deletePlan: (projectId: number, planId: number) =>
      req(`/api/projects/${projectId}/financial/plans/${planId}`, { method: "DELETE" }),
    listProduction: (projectId: number) =>
      req<FinancialDailyProduction[]>(`/api/projects/${projectId}/financial/production`),
    createProduction: (
      projectId: number,
      body: Pick<FinancialDailyProduction, "day" | "team_id" | "produced_value_brl" | "observation">
    ) =>
      req<FinancialDailyProduction>(`/api/projects/${projectId}/financial/production`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateProduction: (
      projectId: number,
      prodId: number,
      body: Pick<FinancialDailyProduction, "day" | "team_id" | "produced_value_brl" | "observation">
    ) =>
      req<FinancialDailyProduction>(`/api/projects/${projectId}/financial/production/${prodId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    deleteProduction: (projectId: number, prodId: number) =>
      req(`/api/projects/${projectId}/financial/production/${prodId}`, { method: "DELETE" }),
    importSpreadsheet: (projectId: number, kind: "plans" | "production", file: File) =>
      postSpreadsheetImport(`/api/projects/${projectId}/financial/import.xls?kind=${kind}`, file),
    obraAdvance: (projectId: number, q?: { date_from?: string; date_to?: string }) =>
      req<ObraFinancialAdvance>(
        `/api/projects/${projectId}/financial/obra-advance${financialQueryString(q)}`
      ),
    listBillingForecasts: (projectId: number) =>
      req<BillingForecastEntry[]>(`/api/projects/${projectId}/financial/billing-forecasts`),
    createBillingForecast: (
      projectId: number,
      body: { day: string; scenario: "optimistic" | "pessimistic"; amount_brl: number }
    ) =>
      req<BillingForecastEntry>(`/api/projects/${projectId}/financial/billing-forecasts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateBillingForecast: (
      projectId: number,
      forecastId: number,
      body: Partial<{ day: string; scenario: "optimistic" | "pessimistic"; amount_brl: number }>
    ) =>
      req<BillingForecastEntry>(`/api/projects/${projectId}/financial/billing-forecasts/${forecastId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteBillingForecast: (projectId: number, forecastId: number) =>
      req<{ ok: boolean }>(`/api/projects/${projectId}/financial/billing-forecasts/${forecastId}`, {
        method: "DELETE",
      }),
    listLegacyEntries: (projectId: number) =>
      req<FinancialEntry[]>(`/api/projects/${projectId}/financial/entries`),
    createLegacyEntry: (
      projectId: number,
      body: Omit<FinancialEntry, "id" | "project_id" | "created_at">
    ) =>
      req<FinancialEntry>(`/api/projects/${projectId}/financial/entries`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deleteLegacyEntry: (projectId: number, entryId: number) =>
      req(`/api/projects/${projectId}/financial/entries/${entryId}`, { method: "DELETE" }),
  },
  admin: {
    sendBackupEmail: () =>
      req<{ ok: boolean; message: string }>("/api/admin/backup/email", { method: "POST" }),
  },
};
