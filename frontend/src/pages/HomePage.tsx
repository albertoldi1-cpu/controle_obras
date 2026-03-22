import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, LogOut, Plus, Shield, Sparkles, Trash2 } from "lucide-react";
import { api } from "../api";
import type { Project } from "../types";
import { useAuth } from "../auth/AuthContext";

export default function HomePage() {
  const { user, logout, isMaster } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr(null);
    try {
      const list = await api.projects.list();
      setProjects(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    try {
      await api.projects.create(name.trim());
      setName("");
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao criar");
    }
  }

  async function remove(id: number, n: string) {
    if (!confirm(`Excluir o projeto "${n}" e todos os dados?`)) return;
    await api.projects.delete(id);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="mb-8 flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="mr-auto text-slate-500">
          Olá, <span className="text-slate-300">{user?.username}</span>
        </span>
        {isMaster && (
          <Link
            to="/admin/usuarios"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/10"
          >
            <Shield className="h-4 w-4 text-accent" />
            Usuários
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
      <header className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent-glow">
          <Sparkles className="h-4 w-4" />
          Controle físico · curva S · farol por etapa
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-gradient md:text-5xl">
          Obra Controle
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-400">
          Planejamento em dois cenários, execução diária e painel executivo para acompanhar desvios e tendência
          da obra — pronto para compartilhar via web.
        </p>
      </header>

      <form onSubmit={create} className="glass mb-10 flex flex-col gap-3 rounded-2xl p-6 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
            Novo projeto
          </label>
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-4 py-3 text-white outline-none ring-accent/40 placeholder:text-slate-600 focus:ring-2"
            placeholder="Nome da obra ou projeto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-lift transition hover:bg-accent-glow"
        >
          <Plus className="h-5 w-5" />
          Criar
        </button>
      </form>

      {err && (
        <p className="mb-6 rounded-xl border border-signal-bad/40 bg-signal-bad/10 px-4 py-3 text-sm text-signal-bad">
          {err}
        </p>
      )}

      <section className="glass rounded-2xl p-2">
        <h2 className="flex items-center gap-2 px-4 py-3 font-display text-lg font-semibold text-white">
          <Building2 className="h-5 w-5 text-accent" />
          Projetos
        </h2>
        {loading ? (
          <p className="px-4 py-8 text-center text-slate-500">Carregando…</p>
        ) : projects.length === 0 ? (
          <p className="px-4 py-8 text-center text-slate-500">Nenhum projeto ainda. Crie o primeiro acima.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-white/[0.03]"
              >
                <Link to={`/projeto/${p.id}/painel`} className="min-w-0 flex-1 group">
                  <p className="truncate font-medium text-white group-hover:text-accent-glow">{p.name}</p>
                  <p className="text-xs text-slate-500">Abrir painel →</p>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(p.id, p.name)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-signal-bad/15 hover:text-signal-bad"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
