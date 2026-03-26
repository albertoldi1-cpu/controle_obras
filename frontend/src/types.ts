export interface User {
  id: number;
  username: string;
  is_master: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  obra_total_value_brl?: number | null;
}

export interface Stage {
  id: number;
  project_id: number;
  name: string;
  weight: number;
  total_quantity: number;
  unit: string | null;
  sort_order: number;
}

export interface DailyEntry {
  id: number;
  stage_id: number;
  day: string;
  planned_optimistic: number;
  planned_pessimistic: number;
  executed: number;
  execution_note: string | null;
}

export type Farol = "green" | "yellow" | "red";

export interface StageDashboardRow {
  stage_id: number;
  name: string;
  unit: string | null;
  weight: number;
  total_quantity: number;
  farol: Farol;
  pct_optimistic: number;
  pct_pessimistic: number;
  pct_executed: number;
  deviation_vs_optimistic_pct: number | null;
  deviation_vs_pessimistic_pct: number | null;
  cumulative_executed: number;
  cumulative_optimistic: number;
  cumulative_pessimistic: number;
  planning_sum_optimistic: number;
  planning_sum_pessimistic: number;
  pending_planning_optimistic: number;
  pending_planning_pessimistic: number;
  deviation_planning_optimistic_pct: number | null;
  deviation_planning_pessimistic_pct: number | null;
  farol_saldo: Farol;
  pending_execution_quantity: number;
}

export interface ObraSummary {
  pct_optimistic: number;
  pct_pessimistic: number;
  pct_executed: number;
  deviation_vs_optimistic_pct: number | null;
  deviation_vs_pessimistic_pct: number | null;
  trend_label: string;
  trend_detail: string;
}

export interface SeriesPoint {
  day: string;
  optimistic: number | null;
  pessimistic: number | null;
  executed: number | null;
}

export interface Dashboard {
  project_id: number;
  project_name: string;
  reference_date: string | null;
  last_execution_date: string | null;
  obra: ObraSummary;
  series: SeriesPoint[];
  stages: StageDashboardRow[];
}

export interface ObraFinancialAdvancePoint {
  day: string;
  produced_accumulated_brl?: number | null;
  forecast_optimistic_brl?: number | null;
  forecast_pessimistic_brl?: number | null;
}

export interface ObraFinancialAdvance {
  project_id: number;
  project_name: string;
  obra_total_value_brl?: number | null;
  total_produced_brl: number;
  has_billing_forecasts: boolean;
  series: ObraFinancialAdvancePoint[];
}

export type BillingForecastScenario = "optimistic" | "pessimistic";

export interface BillingForecastEntry {
  id: number;
  project_id: number;
  day: string;
  scenario: BillingForecastScenario;
  amount_brl: number;
  created_at: string;
}

/** Lançamento detalhado (planilha UPS) — API legada */
export interface FinancialEntry {
  id: number;
  project_id: number;
  exec_date: string;
  team_type: string;
  segment: string;
  uen: string;
  obra_code: string;
  labor_code: string;
  description: string;
  quantity: number;
  ups: number;
  ups_brl: number;
  value_brl: number;
  ep_note: string | null;
  created_at: string;
}

export interface FinancialPanelFilters {
  date_from: string | null;
  date_to: string | null;
  team_id: number | null;
}

export interface FinancialTeamBrief {
  id: number;
  name: string;
  team_type: string;
  uen: string;
  encarregado: string;
  default_daily_target_brl?: number | null;
}

export interface FinancialTeam extends FinancialTeamBrief {
  project_id: number;
  created_at: string;
}

export interface FinancialPanelSeriesPoint {
  day: string;
  daily_planned_brl: number;
  daily_produced_brl: number;
  cumulative_planned_brl: number;
  cumulative_produced_brl: number;
  physical_executed_pct: number;
  productive_advance_pct: number;
}

export interface FinancialFarolDayRow {
  day: string;
  planned_brl: number;
  produced_brl: number;
  teams_count: number;
  farol: Farol;
  produced_observation?: string | null;
}

export interface FinancialPanelSummary {
  total_planned_brl: number;
  total_produced_brl: number;
  deviation_pct: number | null;
  last_data_day: string | null;
}

export interface FinancialPanelDashboard {
  project_id: number;
  project_name: string;
  obra_total_value_brl?: number | null;
  filters: FinancialPanelFilters;
  summary: FinancialPanelSummary;
  series: FinancialPanelSeriesPoint[];
  farol_days: FinancialFarolDayRow[];
  teams: FinancialTeamBrief[];
}

export interface CsvImportResult {
  upserted: number;
  errors: string[];
}

export interface FinancialDailyPlan {
  id: number;
  project_id: number;
  day: string;
  team_id: number;
  daily_target_brl: number;
  daily_planning_brl: number;
  created_at: string;
  team: FinancialTeamBrief;
}

export interface FinancialDailyProduction {
  id: number;
  project_id: number;
  day: string;
  team_id: number;
  produced_value_brl: number;
  observation: string | null;
  created_at: string;
  team: FinancialTeamBrief;
}
