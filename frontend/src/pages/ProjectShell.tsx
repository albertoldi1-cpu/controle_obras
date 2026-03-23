import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { ArrowLeft, Banknote, ClipboardList, Gauge, Layers, LogOut, Shield } from "lucide-react";
import { api } from "../api";
import type { Project } from "../types";
import clsx from "clsx";
import { useAuth } from "../auth/AuthContext";

const tabs = [
  { to: "painel", label: "Avanço físico", icon: Gauge, end: true },
  { to: "etapas", label: "Etapas", icon: Layers, end: true },
  { to: "lancamentos", label: "Lançamentos", icon: ClipboardList, end: true },
  { to: "financeiro", label: "Financeiro", icon: Banknote, end: false },
] as const;

export default function ProjectShell() {
  const { id } = useParams();
  const projectId = Number(id);
  const [project, setProject] = useState<Project | null>(null);
  const [obraInput, setObraInput] = useState("");
  const [obraSaving, setObraSaving] = useState(false);
  const [obraMsg, setObraMsg] = useState<string | null>(null);
  const { logout, isMaster } = useAuth();

  useEffect(() => {
    if (!Number.isFinite(projectId)) return;
    api.projects
      .get(projectId)
      .then(setProject)
      .catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    const v = project?.obra_total_value_brl;
    if (v != null && Number.isFinite(v)) setObraInput(String(v));
    else setObraInput("");
  }, [project?.obra_total_value_brl]);

  async function saveObraTotal(e: FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(projectId)) return;
    setObraSaving(true);
    setObraMsg(null);
    try {
      const trimmed = obraInput.trim();
      const payload =
        trimmed === ""
          ? { obra_total_value_brl: null as number | null }
          : { obra_total_value_brl: Number(trimmed.replace(",", ".")) };
      if (trimmed !== "" && !Number.isFinite(payload.obra_total_value_brl)) {
        setObraMsg("Valor inválido.");
        return;
      }
      const updated = await api.projects.update(projectId, payload);
      setProject(updated);
      setObraMsg("Salvo.");
    } catch (ex) {
      setObraMsg(ex instanceof Error ? ex.message : "Erro ao salvar");
    } finally {
      setObraSaving(false);
    }
  }

  if (!Number.isFinite(projectId)) {
    return (
      <div className="p-8 text-center text-slate-500">
        Projeto inválido. <Link to="/" className="text-accent">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-white">
                {project?.name ?? "Projeto"}
              </p>
              <p className="text-xs text-slate-500">ID #{projectId}</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={`/projeto/${projectId}/${to}`}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-accent text-white shadow-lift"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            {isMaster && (
              <Link
                to="/admin/usuarios"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <Shield className="h-4 w-4" />
                Usuários
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <form
          onSubmit={saveObraTotal}
          className="glass flex flex-col gap-3 rounded-2xl border border-white/10 p-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Valor total da obra (R$)
            </label>
            <p className="mb-2 text-xs text-slate-500">
              Usado no painel financeiro (avanço produtivo %) e no comparativo físico × produtivo (referência diária).
            </p>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full max-w-md rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
              placeholder="Ex.: 3002162.75"
              value={obraInput}
              onChange={(e) => {
                setObraInput(e.target.value);
                setObraMsg(null);
              }}
            />
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="submit"
              disabled={obraSaving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {obraSaving ? "Salvando…" : "Salvar valor"}
            </button>
            {obraMsg && <p className="text-xs text-slate-400">{obraMsg}</p>}
          </div>
        </form>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet context={{ projectId }} />
      </main>
    </div>
  );
}
