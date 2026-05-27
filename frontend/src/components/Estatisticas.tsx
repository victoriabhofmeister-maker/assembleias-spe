import { useMemo } from "react";
import type { Assembleia } from "../types";
import { isRealizada, progressoChecklist, isProximaComPendencias } from "../utils";

interface Props {
  rows: Assembleia[];
}

function monthKey(iso: string): string {
  if (!iso) return "sem-data";
  const [y, m] = iso.split("-");
  return `${y}-${m}`;
}

function monthShort(key: string): string {
  if (key === "sem-data") return "S/data";
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function Estatisticas({ rows }: Props) {
  const stats = useMemo(() => {
    const realizadas = rows.filter(isRealizada);
    const proximas = rows.filter((r) => !isRealizada(r));
    const pendentes = rows.filter(isProximaComPendencias);

    const totalEtapas = rows.length * 7;
    const etapasConcluidas = rows.reduce(
      (acc, r) => acc + progressoChecklist(r).done,
      0,
    );
    const pctChecklist =
      totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;

    // Distribuição por mês (ordenada cronologicamente, sem-data por último)
    const byMonth = new Map<string, { total: number; realizadas: number }>();
    for (const r of rows) {
      const k = monthKey(r.data);
      const cur = byMonth.get(k) ?? { total: 0, realizadas: 0 };
      cur.total += 1;
      if (isRealizada(r)) cur.realizadas += 1;
      byMonth.set(k, cur);
    }
    const months = Array.from(byMonth.entries())
      .sort(([a], [b]) => {
        if (a === "sem-data") return 1;
        if (b === "sem-data") return -1;
        return a.localeCompare(b);
      })
      .map(([key, v]) => ({ key, ...v }));

    // Por responsável
    const byResp = new Map<string, number>();
    for (const r of rows) {
      const k = r.responsavel.trim() || "—";
      byResp.set(k, (byResp.get(k) ?? 0) + 1);
    }
    const responsaveis = Array.from(byResp.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    // Por tipo
    const byTipo = new Map<string, number>();
    for (const r of rows) byTipo.set(r.tipo, (byTipo.get(r.tipo) ?? 0) + 1);
    const tipos = Array.from(byTipo.entries())
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total);

    // Por criticidade
    const byCrit = { Alto: 0, Medio: 0, Baixo: 0 };
    for (const r of rows) byCrit[r.criticidade] += 1;

    return {
      total: rows.length,
      realizadas: realizadas.length,
      proximas: proximas.length,
      pendentes: pendentes.length,
      pctChecklist,
      etapasConcluidas,
      totalEtapas,
      months,
      responsaveis,
      tipos,
      byCrit,
    };
  }, [rows]);

  const maxMonth = Math.max(1, ...stats.months.map((m) => m.total));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 animate-fade-in">
      <p className="text-eyebrow">Painel · BI operacional</p>
      <h2 className="text-display mt-1 text-3xl font-semibold">Estatísticas</h2>
      <p className="mt-2 text-sm text-muted-fg">
        Visão consolidada do pipeline de assembleias.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          hint="assembleias cadastradas"
        />
        <StatCard
          label="Próximas"
          value={stats.proximas}
          hint="ainda por acontecer"
          tone="emerald"
        />
        <StatCard
          label="Realizadas"
          value={stats.realizadas}
          hint="datas passadas"
          tone="muted"
        />
        <StatCard
          label="Com pendência"
          value={stats.pendentes}
          hint="próximos 7 dias com gaps"
          tone="amber"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Checklist global"
          value={`${stats.pctChecklist}%`}
          hint={`${stats.etapasConcluidas} de ${stats.totalEtapas} etapas`}
          large
        />
        <StatCard
          label="Críticas (Alto)"
          value={stats.byCrit.Alto}
          hint={`Médias ${stats.byCrit.Medio} · Baixas ${stats.byCrit.Baixo}`}
          tone="rose"
          large
        />
        <StatCard
          label="Tipos"
          value={stats.tipos.length}
          hint={stats.tipos
            .slice(0, 4)
            .map((t) => `${t.tipo}·${t.total}`)
            .join(" ")}
          large
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 surface p-6">
          <header className="mb-5 flex items-end justify-between">
            <div>
              <h3 className="text-display text-lg font-semibold">Distribuição por mês</h3>
              <p className="text-xs text-muted-fg">
                Barras escuras = já realizadas · barras claras = futuras
              </p>
            </div>
            <span className="text-eyebrow">{stats.months.length} períodos</span>
          </header>
          <div className="space-y-2.5">
            {stats.months.map((m) => {
              const pct = (m.total / maxMonth) * 100;
              const pctReal = m.total > 0 ? (m.realizadas / m.total) * 100 : 0;
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="w-14 text-xs uppercase tracking-wide text-muted-fg">
                    {monthShort(m.key)}
                  </span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 bg-fg/15"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 bg-fg"
                      style={{ width: `${(pct * pctReal) / 100}%` }}
                    />
                    <span className="relative z-10 ml-3 inline-flex h-full items-center text-[11px] font-semibold tabular-nums text-fg mix-blend-difference text-bg">
                      {m.total}
                    </span>
                  </div>
                  <span className="w-12 text-right text-[11px] tabular-nums text-muted-fg">
                    {m.realizadas}/{m.total}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface p-6">
          <header className="mb-5">
            <h3 className="text-display text-lg font-semibold">Por responsável</h3>
            <p className="text-xs text-muted-fg">Distribuição de ownership</p>
          </header>
          <ul className="space-y-2.5">
            {stats.responsaveis.map((r) => {
              const pct = (r.total / stats.total) * 100;
              return (
                <li key={r.nome}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-fg">{r.nome}</span>
                    <span className="tabular-nums text-muted-fg">
                      {r.total} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-fg"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-10 surface p-6">
        <header className="mb-5 flex items-end justify-between">
          <div>
            <h3 className="text-display text-lg font-semibold">Por tipo</h3>
            <p className="text-xs text-muted-fg">
              Mix entre assembleias formais e reuniões internas
            </p>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.tipos.map((t) => {
            const pct = (t.total / stats.total) * 100;
            return (
              <div key={t.tipo} className="rounded-lg border border-line bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-display text-lg font-semibold">{t.tipo}</span>
                  <span className="text-2xl font-bold tabular-nums text-fg">
                    {t.total}
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-fg"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] tabular-nums text-muted-fg">
                  {Math.round(pct)}% do total
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
  large = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "emerald" | "amber" | "rose" | "muted";
  large?: boolean;
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5"
        : tone === "rose"
          ? "border-rose-500/30 bg-rose-500/5"
          : tone === "muted"
            ? "border-line bg-muted/40"
            : "border-line bg-card";
  return (
    <div className={`rounded-xl border p-5 shadow-soft ${toneCls}`}>
      <p className="text-eyebrow">{label}</p>
      <p
        className={`text-display mt-1 font-semibold leading-none tabular-nums ${
          large ? "text-4xl" : "text-3xl"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] text-muted-fg">{hint}</p>}
    </div>
  );
}
