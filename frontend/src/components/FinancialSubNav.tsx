import { NavLink } from "react-router-dom";
import clsx from "clsx";

export default function FinancialSubNav({ projectId }: { projectId: number }) {
  const base = `/projeto/${projectId}/financeiro`;
  const links: { to: string; label: string; end?: boolean }[] = [
    { to: base, label: "Painel Financeiro", end: true },
    { to: `${base}/comparativo`, label: "Comp. Físico × Produtivo", end: true },
    { to: `${base}/equipes`, label: "Equipes", end: true },
    { to: `${base}/planejamento`, label: "Planejamento", end: true },
    { to: `${base}/produtividade`, label: "Lanç. produtividade", end: true },
  ];
  return (
    <nav className="mb-8 flex flex-wrap gap-2 border-b border-emerald-500/20 pb-4">
      {links.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            clsx(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-500/40"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
