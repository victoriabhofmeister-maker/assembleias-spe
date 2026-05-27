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

const COLUNAS_KANBAN: { key: ReturnType<typeof statusKanban>; titulo: string; ring: string }[] = [
  { key: "nao_iniciado", titulo: "🔴 Não iniciado", ring: "bg-red-50 border-red-200" },
  { key: "em_andamento", titulo: "🟡 Em andamento", ring: "bg-amber-50 border-amber-200" },
  { key: "concluido", titulo: "🟢 Concluído", ring: "bg-emerald-50 border-emerald-200" },
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

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800">Assembleias registradas</h2>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} {rows.length === 1 ? "registro" : "registros"}
            {alertas > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                ⚠ {alertas} próxima{alertas > 1 ? "s" : ""} com pendência
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="field-label">Responsável</label>
            <select
              className="field-input min-w-[170px]"
              value={filtroResp}
              onChange={(e) => setFiltroResp(e.target.value)}
            >
              <option value="">Todos</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Criticidade</label>
            <select
              className="field-input min-w-[140px]"
              value={filtroCrit}
              onChange={(e) => setFiltroCrit(e.target.value as typeof filtroCrit)}
            >
              <option value="todos">Todas</option>
              {CRITICIDADES.map((c) => (
                <option key={c} value={c}>
                  {CRITICIDADE_EMOJI[c]} {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Status</label>
            <select
              className="field-input min-w-[150px]"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            >
              <option value="todas">Todas</option>
              <option value="proximas">Próximas</option>
              <option value="realizadas">Realizadas</option>
            </select>
          </div>
          <ViewToggle view={view} onChange={setView} />
          <button onClick={onRefresh} className="btn-ghost" disabled={loading}>
            {loading ? "Atualizando..." : "↻ Atualizar"}
          </button>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="card p-12 text-center text-sm text-slate-500">
          {rows.length === 0
            ? "Nenhuma assembleia cadastrada ainda. Use o botão “+ Nova assembleia” para começar."
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

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div>
      <label className="field-label">Visualização</label>
      <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        <button
          type="button"
          onClick={() => onChange("lista")}
          className={`rounded px-3 py-1 text-sm font-medium transition ${
            view === "lista"
              ? "bg-navy-700 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          ☰ Lista
        </button>
        <button
          type="button"
          onClick={() => onChange("kanban")}
          className={`rounded px-3 py-1 text-sm font-medium transition ${
            view === "kanban"
              ? "bg-navy-700 text-white"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          🗂 Kanban
        </button>
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
    <div className="space-y-6">
      {gruposFuturas.map((g) => (
        <MonthGroup key={`f-${g.label}`} group={g} dimmed={false} onOpen={onOpen} />
      ))}

      {mostrarDivisor && <DivisorRealizadas total={gruposRealizadas.reduce((n, g) => n + g.rows.length, 0)} />}

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
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            dimmed ? "text-slate-400" : "text-slate-500"
          }`}
        >
          ── {group.label} ──
        </span>
        <span className={`text-xs ${dimmed ? "text-slate-300" : "text-slate-400"}`}>
          {group.rows.length} {group.rows.length === 1 ? "assembleia" : "assembleias"}
        </span>
        <div
          className={`flex-1 border-t ${dimmed ? "border-slate-100" : "border-slate-200"}`}
        />
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
    <div className="my-8 -mx-2 rounded-md bg-[repeating-linear-gradient(135deg,theme(colors.slate.100)_0_8px,theme(colors.slate.50)_8px_16px)] px-4 py-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t-2 border-dashed border-slate-300" />
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-300 shadow-sm">
          <span aria-hidden>✓</span>
          <span>Assembleias realizadas</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {total}
          </span>
        </span>
        <div className="flex-1 border-t-2 border-dashed border-slate-300" />
      </div>
      <p className="mt-2 text-center text-[11px] uppercase tracking-wider text-slate-400">
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
  colunas: { key: string; titulo: string; ring: string; rows: Assembleia[] }[];
  realizadas: Assembleia[];
  mostrar: boolean;
  onToggleMostrar: () => void;
  onOpen: (a: Assembleia) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {colunas.map((c) => (
        <div
          key={c.key}
          className="flex-shrink-0 w-80 flex flex-col rounded-lg border border-slate-200 bg-white"
        >
          <header className={`rounded-t-lg px-3 py-2 border-b ${c.ring}`}>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center justify-between">
              <span>{c.titulo}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                {c.rows.length}
              </span>
            </h3>
          </header>
          <div className="p-2 space-y-2 max-h-[68vh] overflow-y-auto bg-slate-50/40">
            {c.rows.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
            ) : (
              c.rows.map((a) => <KanbanCard key={a.id} a={a} onOpen={() => onOpen(a)} />)
            )}
          </div>
        </div>
      ))}

      <div
        className={`flex-shrink-0 flex flex-col rounded-lg border border-slate-200 bg-white transition-all ${
          mostrar ? "w-80" : "w-64"
        }`}
      >
        <header className="rounded-t-lg px-3 py-2 border-b bg-slate-100 border-slate-300">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center justify-between">
            <span>✓ Realizadas</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
              {realizadas.length}
            </span>
          </h3>
        </header>
        <div className="p-2 space-y-2 max-h-[68vh] overflow-y-auto bg-slate-50/40">
          {!mostrar ? (
            <button
              type="button"
              onClick={onToggleMostrar}
              className="w-full rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-navy-700"
            >
              Mostrar realizadas ({realizadas.length})
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onToggleMostrar}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Ocultar realizadas
              </button>
              {realizadas.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
              ) : (
                realizadas.map((a) => <KanbanCard key={a.id} a={a} onOpen={() => onOpen(a)} />)
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
      className={`card p-5 cursor-pointer transition hover:shadow-md hover:border-navy-300 ${
        destaque ? "ring-2 ring-amber-400 border-amber-300 bg-amber-50/30" : ""
      } ${realizada ? "opacity-[0.55] grayscale-[0.2]" : ""}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`badge ${CRITICIDADE_BADGE[a.criticidade]}`}>
              {CRITICIDADE_EMOJI[a.criticidade]} {a.criticidade}
            </span>
            <span className="badge bg-navy-100 text-navy-800 ring-1 ring-navy-200">
              {a.tipo}
            </span>
            {realizada ? (
              <span className="badge bg-slate-200 text-slate-700 ring-1 ring-slate-300">
                ✓ Realizada
              </span>
            ) : (
              dias !== null &&
              dias >= 0 &&
              dias <= 7 && (
                <span className="badge bg-amber-100 text-amber-900 ring-1 ring-amber-200">
                  {dias === 0 ? "Hoje" : `em ${dias}d`}
                </span>
              )
            )}
          </div>
          <h3 className="text-base font-semibold text-navy-800">{a.spe}</h3>
          <p className={`text-xs ${a.data ? "text-slate-500" : "text-amber-700 italic"}`}>
            {a.data ? fmtData(a.data) : "Data a definir"}
          </p>
        </div>
        {realizada && (
          <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400">
            Realizada
          </span>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Field label="Responsável" value={a.responsavel || "—"} />
        <Field label="Suporte CSI" value={a.suporteCsi || "—"} />
        {temEdital(a.tipo) ? (
          <Field label="Edital" value={a.editalEnviado ? "✅ Enviado" : "❌ Pendente"} />
        ) : (
          <Field
            label="Confirmação"
            value={a.editalEnviado ? "✅ Confirmado" : "❌ Pendente"}
          />
        )}
        <Field label="Apresentação" value={a.apresentacao || "—"} />
      </dl>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold uppercase tracking-wide text-slate-500">
            Checklist
          </span>
          <span className="font-semibold text-slate-700">
            {prog.done}/{prog.total} etapas concluídas
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-navy-700 transition-all" style={{ width: `${prog.pct}%` }} />
        </div>
      </div>

      {destaque && (
        <div className="mt-3 rounded-md bg-amber-100 border border-amber-300 px-3 py-2 text-xs text-amber-900">
          <strong>⚠ Pendências antes da data:</strong> {pend.join(", ")}.
        </div>
      )}

      <p className="mt-3 text-xs text-navy-700 font-medium">→ Abrir checklist completo</p>
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
      className={`relative rounded-md border border-slate-200 bg-white p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-navy-300 transition ${
        realizada ? "opacity-[0.55] grayscale-[0.2]" : ""
      }`}
    >
      {realizada && (
        <span className="absolute right-2 top-2 text-[9px] uppercase tracking-wider font-medium text-slate-400">
          Realizada
        </span>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span className={`badge ${CRITICIDADE_BADGE[a.criticidade]}`}>
          {CRITICIDADE_EMOJI[a.criticidade]} {a.criticidade}
        </span>
        <span className="badge bg-navy-100 text-navy-800 ring-1 ring-navy-200">{a.tipo}</span>
        {realizada && (
          <span className="badge bg-slate-200 text-slate-700 ring-1 ring-slate-300">
            ✓ Realizada
          </span>
        )}
        <span className="ml-auto text-[11px] font-semibold text-slate-700">
          {prog.done}/{prog.total}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-navy-800 leading-tight">{a.spe}</h4>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className={a.data ? "" : "italic text-amber-700"}>
          {a.data ? fmtData(a.data) : "Data a definir"}
        </span>
        <span className="truncate font-medium text-slate-600" title={a.responsavel}>
          {a.responsavel || "—"}
        </span>
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-navy-700 transition-all" style={{ width: `${prog.pct}%` }} />
      </div>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
