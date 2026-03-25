import clsx from "clsx";
import type { Farol } from "../types";

const map = {
  green: { bg: "bg-signal-ok", ring: "ring-signal-ok/40", label: "No ritmo ou acima do otimista" },
  yellow: { bg: "bg-signal-warn", ring: "ring-signal-warn/40", label: "Entre pessimista e otimista" },
  red: { bg: "bg-signal-bad", ring: "ring-signal-bad/40", label: "Abaixo do cenário pessimista" },
} as const;

export default function FarolDot({
  farol,
  className,
  title,
}: {
  farol: Farol;
  className?: string;
  /** Sobrescreve o texto do tooltip (ex.: painel produtivo). */
  title?: string;
}) {
  const m = map[farol];
  return (
    <span
      title={title ?? m.label}
      className={clsx("inline-flex h-3.5 w-3.5 shrink-0 rounded-full ring-2", m.bg, m.ring, className)}
    />
  );
}
