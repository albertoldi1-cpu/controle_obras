/** Dispara atualização imediata do painel Avanço físico (ex.: após salvar em Lançamentos). */
export const DASHBOARD_REFRESH_EVENT = "obra-controle:dashboard-refresh";

export function requestDashboardRefresh(projectId: number): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT, { detail: { projectId } }));
}
