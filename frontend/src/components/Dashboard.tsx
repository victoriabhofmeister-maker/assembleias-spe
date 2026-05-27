import { useEffect, useMemo, useState } from "react";
import type { Assembleia, Criticidade } from "../types";
import { CRITICIDADES, temEdital } from "../types";
import {
  CRITICIDADE_BADGE,
  CRITICIDADE_EMOJI,
  diasAte,
  fmtData,
  isProximaComPendencias,
  isRealizada,
  pendencias,
  progressoChecklist,
} from "../utils";

type View = "lista" | "kanban";
type FiltroStatus = "todas" | "proximas" | "realizadas";

const VIEW_KEY = "seazone.dashboard.view";

interface Props {
  rows: Assembleia[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (a: Assembleia) => void;
}

function compareDataAsc(a: Assembleia, b: Assembleia): number {
  if (!a.data && !b.data) return 0;
  if (!a.data) return 1;
  if (!b.data) return -1;
  if (a.data < b.data) return -1;
  if (a.data > b.data) return 1;
  return 0;
}

function monthLabel(iso: string): string {
  if (!iso) return "Sem data definida";
  const [y, m] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  const month = date.toLocaleDateString("pt-BR", { month: "long" });
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${y}`;
}

function groupByMonth(rows: Assembleia[]): { label: string; rows: Assembleia[] }[] {
  const groups: { label: string; rows: Assembleia[] }[] = [];
  const idx = new Map<string, number>();
  for (const a of rows) {
    const label = monthLabel(a.data);
    let i = idx.get(label);
    if (i === undefined) {
      i = groups.length;
      idx.set(label, i);
      groups.push({ label, rows: [] });
    }
    groups[i].rows.push(a);
  }
  return groups;
}

function statusKanban(a: Assembleia): "nao_iniciado" | "em_andamento" | "concluido" {
  const { done, total } = progressoChecklist(a);
  if (total === 0 || done === 0) return "nao_iniciado";
  if (done >= total) return "concluido";
  return "em_andamento";
}

const COLUNAS_KANBAN: { key: ReturnType<typeof statusKanban>; titulo: string; tone: string }[] = [
  { key: "nao_iniciado", titulo: "Não iniciado", tone: "from-rose-500/10 to-transparent border-rose-500/20" },
  { key: "em_andamento", titulo: "Em andamento", tone: "from-amber-500/10 to-transparent border-amber-500/20" },
  { key: "concluido", titulo: "Concluído", tone: "from-emerald-500/10 to-transparent border-emerald-500/20" },
];

export function Dashboard({ rows, loading, onRefresh, onOpen }: Props) {
  const [filtroResp, setFiltroResp] = useState<string>("");
  const [filtroCrit, setFiltroCrit] = useState<"todos" | Criticidade>("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "lista";
    return localStorage.getItem(VIEW_KEY) === "kanban" ? "kanban" : "lista";
  });
  const [mostrarRealizadasKanban, setMostrarRealizadasKanban] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    if (filtroStatus === "realizadas") setMostrarRealizadasKanban(true);
  }, [filtroStatus]);

  const responsaveis = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.responsavel.trim() && s.add(r.responsavel.trim()));
    return Array.from(s).sort();
  }, [rows]);

  const filtradas = useMemo(() => {
    return rows
      .filter((r) => {
        if (filtroResp && r.responsavel.trim() !== filtroResp) return false;
        if (filtroCrit !== "todos" && r.criticidade !== filtroCrit) return false;
        if (filtroStatus === "proximas" && isRealizada(r)) return false;
        if (filtroStatus === "realizadas" && !isRealizada(r)) return false;
        return true;
      })
      .slice()
      .sort(compareDataAsc);
  }, [rows, filtroResp, filtroCrit, filtroStatus]);

  const { gruposFuturas, gruposRealizadas } = useMemo(() => {
    const futuras = filtradas.filter((a) => !isRealizada(a));
    const realizadas = filtradas
      .filter(isRealizada)
      .slice()
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
    return {
      gruposFuturas: groupByMonth(futuras),
      gruposRealizadas: groupByMonth(realizadas),
    };
  }, [filtradas]);

  const colunasKanban = useMemo(() => {
    const naoRealizadas = filtradas.filter((a) => !isRealizada(a));
    const realizadas = filtradas.filter(isRealizada);
    return {
      ativas: COLUNAS_KANBAN.map((c) => ({
        ...c,
        rows: naoRealizadas.filter((a) => statusKanban(a) === c.key),
      })),
      realizadas,
    };
  }, [filtradas]);

  const alertas = rows.filter(isProximaComPendencias).length;
  const proximaData = useMemo(() => {
    return filtradas.find((a) => a.data && !isRealizada(a))?.data ?? "";
  }, [filtradas]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 animate-fade-in">
        <p className="text-eyebrow">Operações · Jurídico Seazone</p>
        <h2 className="text-display mt-1 text-3xl font-semibold text-balance">
          Assembleias <span className="text-muted-fg">·</span> {rows.length}
        </h2>
        <p className="mt-2 text-sm text-muted-fg">
          {alertas > 0 ? (
            <>
              <span className="font-medium text-fg">{alertas}</span> próxima
              {alertas > 1 ? "s" : ""} com pendência
              {proximaData && (
                <>
                  {" · "}primeira em <span className="font-medium text-fg">{fmtData(proximaData)}</span>
                </>
              )}
            </>
          ) : (
            "Tudo em dia. Nenhuma pendência identificada nos próximos 7 dias."
          )}
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-end gap-3 animate-fade-in">
        <Filter
          label="Responsável"
          value={filtroResp}
          onChange={setFiltroResp}
          options={[{ value: "", label: "Todos" }, ...responsaveis.map((r) => ({ value: r, label: r }))]}
        />
        <Filter
          label="Criticidade"
          value={filtroCrit}
          onChange={(v) => setFiltroCrit(v as "todos" | Criticidade)}
          options={[
            { value: "todos", label: "Todas" },
            ...CRITICIDADES.map((c) => ({ value: c, label: `${CRITICIDADE_EMOJI[c]} ${c}` })),
          ]}
        />
        <Filter
          label="Status"
          value={filtroStatus}
          onChange={(v) => setFiltroStatus(v as FiltroStatus)}
          options={[
            { value: "todas", label: "Todas" },
            { value: "proximas", label: "Próximas" },
            { value: "realizadas", label: "Realizadas" },
          ]}
        />
        <ViewToggle view={view} onChange={setView} />
        <button onClick={onRefresh} className="btn-ghost" disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {filtradas.length === 0 ? (
        <div className="surface p-16 text-center text-sm text-muted-fg animate-fade-in">
          {rows.length === 0
            ? "Nenhuma assembleia cadastrada ainda. Use “+ Nova” para começar."
            : "Nenhuma assembleia bate com os filtros selecionados."}
        </div>
      ) : view === "lista" ? (
        <ListaView
          gruposFuturas={gruposFuturas}
          gruposRealizadas={gruposRealizadas}
          onOpen={onOpen}
        />
      ) : (
        <KanbanView
          colunas={colunasKanban.ativas}
          realizadas={colunasKanban.realizadas}
          mostrar={mostrarRealizadasKanban}
          onToggleMostrar={() => setMostrarRealizadasKanban((v) => !v)}
          onOpen={onOpen}
        />
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select
        className="field-input min-w-[160px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div>
      <label className="field-label">Visualização</label>
      <div className="inline-flex rounded-lg border border-line bg-card p-0.5">
        {(["lista", "kanban"] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === v
                ? "bg-fg text-bg shadow-soft"
                : "text-muted-fg hover:text-fg"
            }`}
          >
            {v === "lista" ? "☰ Lista" : "🗂 Kanban"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListaView({
  gruposFuturas,
  gruposRealizadas,
  onOpen,
}: {
  gruposFuturas: { label: string; rows: Assembleia[] }[];
  gruposRealizadas: { label: string; rows: Assembleia[] }[];
  onOpen: (a: Assembleia) => void;
}) {
  const mostrarDivisor = gruposFuturas.length > 0 && gruposRealizadas.length > 0;

  return (
    <div className="space-y-10 animate-fade-in">
      {gruposFuturas.map((g) => (
        <MonthGroup key={`f-${g.label}`} group={g} dimmed={false} onOpen={onOpen} />
      ))}

      {mostrarDivisor && (
        <DivisorRealizadas total={gruposRealizadas.reduce((n, g) => n + g.rows.length, 0)} />
      )}

      {gruposRealizadas.map((g) => (
        <MonthGroup key={`r-${g.label}`} group={g} dimmed={true} onOpen={onOpen} />
      ))}
    </div>
  );
}

function MonthGroup({
  group,
  dimmed,
  onOpen,
}: {
  group: { label: string; rows: Assembleia[] };
  dimmed: boolean;
  onOpen: (a: Assembleia) => void;
}) {
  return (
    <section>
      <div className={`divider-eyebrow mb-4 ${dimmed ? "opacity-60" : ""}`}>
        <span>{group.label}</span>
        <span className="font-normal normal-case tracking-wide text-muted-fg">
          {group.rows.length} {group.rows.length === 1 ? "assembleia" : "assembleias"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {group.rows.map((a) => (
          <AssembleiaCard key={a.id} a={a} onOpen={() => onOpen(a)} />
        ))}
      </div>
    </section>
  );
}

function DivisorRealizadas({ total }: { total: number }) {
  return (
    <div className="relative my-12 overflow-hidden rounded-xl border border-dashed border-line bg-muted/40 py-6 bg-grain">
      <div className="relative flex items-center gap-4 px-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
        <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-fg shadow-soft">
          <CheckIcon />
          <span>Assembleias realizadas</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-fg">
            {total}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
      </div>
      <p className="relative mt-3 text-center text-eyebrow">
        as assembleias abaixo já aconteceram
      </p>
    </div>
  );
}

function KanbanView({
  colunas,
  realizadas,
  mostrar,
  onToggleMostrar,
  onOpen,
}: {
  colunas: { key: string; titulo: string; tone: string; rows: Assembleia[] }[];
  realizadas: Assembleia[];
  mostrar: boolean;
  onToggleMostrar: () => void;
  onOpen: (a: Assembleia) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-fade-in">
      {colunas.map((c) => (
        <div
          key={c.key}
          className="flex-shrink-0 w-[320px] flex flex-col surface overflow-hidden"
        >
          <header
            className={`border-b border-line bg-gradient-to-b px-4 py-3 ${c.tone}`}
          >
            <h3 className="flex items-center justify-between text-sm font-semibold text-fg">
              <span className="flex items-center gap-2">
                <ColumnDot status={c.key as "nao_iniciado" | "em_andamento" | "concluido"} />
                {c.titulo}
              </span>
              <span className="rounded-full bg-card px-2 py-0.5 text-[11px] tabular-nums text-muted-fg ring-1 ring-line">
                {c.rows.length}
              </span>
            </h3>
          </header>
          <div className="space-y-2 overflow-y-auto p-2 max-h-[68vh]">
            {c.rows.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-fg">Vazio</p>
            ) : (
              c.rows.map((a) => <KanbanCard key={a.id} a={a} onOpen={() => onOpen(a)} />)
            )}
          </div>
        </div>
      ))}

      <div
        className={`flex-shrink-0 surface overflow-hidden flex flex-col transition-all ${
          mostrar ? "w-[320px]" : "w-[240px]"
        }`}
      >
        <header className="border-b border-line bg-muted/60 px-4 py-3">
          <h3 className="flex items-center justify-between text-sm font-semibold text-muted-fg">
            <span className="flex items-center gap-2">
              <CheckIcon />
              Realizadas
            </span>
            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] tabular-nums ring-1 ring-line">
              {realizadas.length}
            </span>
          </h3>
        </header>
        <div className="space-y-2 overflow-y-auto p-2 max-h-[68vh]">
          {!mostrar ? (
            <button
              type="button"
              onClick={onToggleMostrar}
              className="w-full rounded-lg border border-dashed border-line bg-card/50 px-3 py-3 text-xs font-medium text-muted-fg transition hover:border-fg/30 hover:text-fg"
            >
              Mostrar realizadas ({realizadas.length})
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleMostrar}
                className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted-fg transition hover:bg-muted hover:text-fg"
              >
                Ocultar realizadas
              </button>
              {realizadas.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-fg">Vazio</p>
              ) : (
                realizadas.map((a) => (
                  <KanbanCard key={a.id} a={a} onOpen={() => onOpen(a)} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AssembleiaCard({ a, onOpen }: { a: Assembleia; onOpen: () => void }) {
  const dias = diasAte(a.data);
  const pend = pendencias(a);
  const destaque = isProximaComPendencias(a);
  const realizada = isRealizada(a);
  const prog = progressoChecklist(a);

  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group card-hover relative overflow-hidden p-5 cursor-pointer ${
        destaque ? "ring-1 ring-amber-500/40 border-amber-500/40" : ""
      } ${realizada ? "opacity-[0.6]" : ""}`}
    >
      {realizada && (
        <span className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-fg">
          Realizada
        </span>
      )}

      <div className="flex items-start gap-3">
        <CriticidadeBlock c={a.criticidade} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="chip">{a.tipo}</span>
            {!realizada && dias !== null && dias >= 0 && dias <= 7 && (
              <span className="chip border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                {dias === 0 ? "Hoje" : `em ${dias}d`}
              </span>
            )}
            {realizada && (
              <span className="chip">✓ Realizada</span>
            )}
          </div>
          <h3 className="text-display text-lg font-semibold leading-snug">{a.spe}</h3>
          <p
            className={`text-xs tabular-nums ${
              a.data ? "text-muted-fg" : "italic text-amber-600 dark:text-amber-400"
            }`}
          >
            {a.data ? fmtData(a.data) : "Data a definir"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-line pt-4 text-sm">
        <Field label="Responsável" value={a.responsavel || "—"} />
        <Field label="Suporte CSI" value={a.suporteCsi || "—"} />
        {temEdital(a.tipo) ? (
          <Field label="Edital" value={a.editalEnviado ? "✓ Enviado" : "○ Pendente"} />
        ) : (
          <Field
            label="Confirmação"
            value={a.editalEnviado ? "✓ Confirmado" : "○ Pendente"}
          />
        )}
        <Field label="Apresentação" value={a.apresentacao || "—"} />
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 flex items-center justify-between text-eyebrow">
          <span>Checklist</span>
          <span className="font-semibold normal-case tracking-wide text-fg tabular-nums">
            {prog.done}/{prog.total}
          </span>
        </div>
        <ProgressBar value={prog.pct} />
      </div>

      {destaque && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <strong>Pendências:</strong> {pend.join(" · ")}
        </div>
      )}

      <p className="mt-4 text-xs font-medium text-muted-fg transition group-hover:text-accent">
        Abrir checklist →
      </p>
    </article>
  );
}

function KanbanCard({ a, onOpen }: { a: Assembleia; onOpen: () => void }) {
  const prog = progressoChecklist(a);
  const realizada = isRealizada(a);

  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative cursor-pointer rounded-lg border border-line bg-card p-3 shadow-sm transition hover:shadow-soft hover:border-fg/20 ${
        realizada ? "opacity-60" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <CriticidadeDot c={a.criticidade} />
        <span className="chip py-0.5 px-1.5 text-[10px]">{a.tipo}</span>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-fg">
          {prog.done}/{prog.total}
        </span>
      </div>
      <h4 className="text-display text-sm font-semibold leading-tight">{a.spe}</h4>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-fg">
        <span className={a.data ? "tabular-nums" : "italic text-amber-600 dark:text-amber-400"}>
          {a.data ? fmtData(a.data) : "Data a definir"}
        </span>
        <span className="truncate font-medium" title={a.responsavel}>
          {a.responsavel || "—"}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={prog.pct} thin />
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-eyebrow">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}

function ProgressBar({ value, thin = false }: { value: number; thin?: boolean }) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-muted ${thin ? "h-1" : "h-1.5"}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-fg/80 to-fg transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function CriticidadeBlock({ c }: { c: Criticidade }) {
  const tone =
    c === "Alto"
      ? "bg-rose-500"
      : c === "Medio"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <span
      className={`block h-12 w-1 rounded-full ${tone}`}
      title={c}
    />
  );
}

function CriticidadeDot({ c }: { c: Criticidade }) {
  const tone =
    c === "Alto"
      ? "bg-rose-500"
      : c === "Medio"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${tone}`} aria-label={c} />;
}

function ColumnDot({ status }: { status: "nao_iniciado" | "em_andamento" | "concluido" }) {
  const tone =
    status === "nao_iniciado"
      ? "bg-rose-500"
      : status === "em_andamento"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${tone}`} />;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Re-export para evitar warnings de unused imports
export const _CRIT_BADGE = CRITICIDADE_BADGE;
