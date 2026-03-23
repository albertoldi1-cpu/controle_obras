import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setSession, token, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from || "/";

  useEffect(() => {
    if (!loading && token) nav(from, { replace: true });
  }, [loading, token, from, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const data = await api.auth.login(username.trim(), password);
      setSession(data.access_token, data.user);
      nav(from, { replace: true });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Carregando…</div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="font-display text-3xl font-bold text-gradient">Obra Controle</h1>
      <p className="mt-2 text-sm text-slate-500">Entre com seu usuário e senha.</p>
      <form onSubmit={submit} className="glass mt-8 space-y-4 rounded-2xl p-6">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Usuário</label>
          <input
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Senha</label>
          <input
            type="password"
            className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-accent/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {err && <p className="text-sm text-signal-bad">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-accent py-3 font-semibold text-white hover:bg-accent-glow disabled:opacity-50"
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-xs text-slate-500">
        <p className="font-medium text-slate-400">Credenciais master (após reset)</p>
        <p className="mt-1 text-slate-300">
          Usuário: <strong>Andre</strong> · Senha: <strong>Eng@3112</strong>
        </p>
        <p className="mt-2 text-slate-600">
          Se não entrar, pare a API e rode no terminal:{" "}
          <code className="rounded bg-ink-950 px-1 text-slate-400">python3 scripts/reset_master.py</code>
        </p>
      </div>
      <Link to="/" className="mt-4 block text-center text-sm text-accent hover:underline">
        Voltar
      </Link>
    </div>
  );
}
