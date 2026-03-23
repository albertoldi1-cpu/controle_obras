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
  optimistic: number;
  pessimistic: number;
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

export interface FinancialSeriesPoint {
  day: string;
  daily_value: number;
  cumulative_value: number;
}

export interface FinancialByTeamRow {
  team_type: string;
  total_brl: number;
  pct_of_total: number;
}

export interface FinancialSummary {
  entry_count: number;
  total_value_brl: number;
  total_ups: number;
  last_exec_date: string | null;
  avg_value_per_entry: number;
}

export interface FinancialDashboard {
  project_id: number;
  project_name: string;
  summary: FinancialSummary;
  series: FinancialSeriesPoint[];
  by_team: FinancialByTeamRow[];
  recent_entries: FinancialEntry[];
}
