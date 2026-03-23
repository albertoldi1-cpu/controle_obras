import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Trash2, UserPlus } from "lucide-react";
import { api } from "../api";
import type { User } from "../types";
import { useAuth } from "../auth/AuthContext";

export default function AdminUsersPage() {
  const { isMaster, user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mkMaster, setMkMaster] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  async function load() {
    const list = await api.users.list();
    setUsers(list);
  }

  useEffect(() => {
    if (isMaster) load().catch(() => setErr("Sem permissão ou erro ao listar"));
  }, [isMaster]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.users.create(username.trim(), password, mkMaster);
      setUsername("");
      setPassword("");
      setMkMaster(false);
      await load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Erro");
    }
  }

  async function del(u: User) {
    if (!confirm(`Remover usuário ${u.username}?`)) return;
    await api.users.delete(u.id);
    await load();
  }

  async function sendBackup() {
    setBackupMsg(null);
    setBackupBusy(true);
    try {
      const r = await api.admin.sendBackupEmail();
      setBackupMsg(r.message);
    } catch (ex) {
      setBackupMsg(ex instanceof Error ? ex.message : "Falha no backup");
    } finally {
      setBackupBusy(false);
    }
  }

  if (!isMaster) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-signal-bad">Apenas o administrador master acessa esta página.</p>
        <Link to="/" className="mt-4 inline-block text-accent">
          Início
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Projetos
      </Link>
      <h1 className="font-display text-2xl font-bold text-white">Usuários</h1>
      <p className="mt-1 text-sm text-slate-500">Somente o master pode cadastrar novos acessos.</p>

      <div className="glass mt-6 rounded-2xl border border-white/10 p-6">
        <h2 className="flex items-center gap-2 font-medium text-white">
          <Mail className="h-5 w-5 text-accent" />
          Backup por e-mail
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Envia um arquivo compactado (JSON) com todos os dados do sistema para o endereço configurado no servidor (
          <code className="text-slate-400">BACKUP_EMAIL_TO</code>). Credenciais SMTP ficam só em variáveis de ambiente —
          nunca no código.
        </p>
        <button
          type="button"
          disabled={backupBusy}
          onClick={() => sendBackup()}
          className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 disabled:opacity-50"
        >
          {backupBusy ? "Enviando…" : "Enviar backup agora"}
        </button>
        {backupMsg && <p className="mt-3 text-sm text-slate-400">{backupMsg}</p>}
      </div>

      <form onSubmit={add} className="glass mt-8 space-y-4 rounded-2xl p-6">
        <h2 className="flex items-center gap-2 font-medium text-white">
          <UserPlus className="h-5 w-5 text-accent" />
          Novo usuário
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Login</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Senha</label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-ink-950/80 px-3 py-2 text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={mkMaster} onChange={(e) => setMkMaster(e.target.checked)} />
          Conceder perfil master
        </label>
        {err && <p className="text-sm text-signal-bad">{err}</p>}
        <button type="submit" className="rounded-xl bg-accent px-6 py-2 font-semibold text-white">
          Cadastrar
        </button>
      </form>

      <div className="glass mt-8 overflow-hidden rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Master</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                <td className="px-4 py-3 text-slate-400">{u.is_master ? "Sim" : "—"}</td>
                <td className="px-4 py-3 text-slate-400">{u.is_active ? "Sim" : "Não"}</td>
                <td className="px-4 py-3">
                  {u.id !== me?.id && (
                    <button
                      type="button"
                      onClick={() => del(u)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-signal-bad/15 hover:text-signal-bad"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
