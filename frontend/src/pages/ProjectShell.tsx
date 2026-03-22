import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, Link } from "react-router-dom";
import { ArrowLeft, ClipboardList, Gauge, Layers, LogOut, Shield } from "lucide-react";
import { api } from "../api";
import type { Project } from "../types";
import clsx from "clsx";
import { useAuth } from "../auth/AuthContext";

const tabs = [
  { to: "painel", label: "Painel", icon: Gauge },
  { to: "etapas", label: "Etapas", icon: Layers },
  { to: "lancamentos", label: "Lançamentos", icon: ClipboardList },
];

export default function ProjectShell() {
  const { id } = useParams();
  const projectId = Number(id);
  const [project, setProject] = useState<Project | null>(null);
  const { logout, isMaster } = useAuth();

  useEffect(() => {
    if (!Number.isFinite(projectId)) return;
    api.projects
      .get(projectId)
      .then(setProject)
      .catch(() => setProject(null));
  }, [projectId]);

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
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={`/projeto/${projectId}/${to}`}
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet context={{ projectId }} />
      </main>
    </div>
  );
}
