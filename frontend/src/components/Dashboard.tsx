import { useEffect, useMemo, useState } from "react";
import type { Assembleia, Criticidade } from "../types";
import { CRITICIDADES, temEdital } from "../types";
import { patchAssembleia } from "../api";
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

// MIME type usado para identificar drags de KanbanCard.
const KANBAN_DRAG_MIME = "application/x-seazone-assembleia-id";

// Colunas onde "soltar" um card tem semântica definida (toggle do editalEnviado).
const DROP_TARGETS_EDITAL: Record<string, boolean> = {
  edital_enviado: true,
  edital_nao_enviado: true,
};

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

type ColunaKanban =
  | "sem_data"
  | "apresentacao"
  | "edital_enviado"
  | "edital_nao_enviado"
  | "falta_documentos"
  | "realizadas";

function temApresentacao(a: Assembleia): boolean {
  const v = a.apresentacao.trim().toLowerCase();
  if (!v) return false;
  if (v === "—" || v === "-" || v === "pendente" || v === "não") return false;
  return true;
}

function temPendenciaDocumentos(a: Assembleia): boolean {
  // Lookup por título (robusto a reordenamento do template).
  const item = a.checklist.find((c) => c.titulo === "Comunicar documentos faltantes");
  if (!item) return true;
  return item.status !== "Concluído";
}

function colunaKanbanFor(a: Assembleia): ColunaKanban {
  if (isRealizada(a)) return "realizadas";
  if (!a.data) return "sem_data";
  if (a.editalEnviado) return "edital_enviado";
  if (temApresentacao(a)) return "apresentacao";
  // tem data + sem edital + sem apresentação → edital ainda não foi enviado
  return "edital_nao_enviado";
}

// Ícone PowerPoint/slides inline (mais distinto que emoji)
const SlideIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
    <polyline points="8 11 11 14 16 8" />
  </svg>
);

const COLUNAS_KANBAN: {
  key: ColunaKanban;
  titulo: string;
  emoji: string;
  icon?: React.ReactNode;
  dot: string;
  tone: string;
}[] = [
  {
    key: "sem_data",
    titulo: "Sem data",
    emoji: "📅",
    dot: "bg-muted-fg",
    tone: "from-muted/60 to-transparent border-line",
  },
  {
    key: "apresentacao",
    titulo: "Apresentação",
    emoji: "",
    icon: <SlideIcon />,
    dot: "bg-[#0048D7]",
    tone: "from-[#0048D7]/10 to-transparent border-[#0048D7]/30",
  },
  {
    key: "edital_enviado",
    titulo: "Edital enviado",
    emoji: "✅",
    dot: "bg-[#2FB864]",
    tone: "from-[#2FB864]/10 to-transparent border-[#2FB864]/30",
  },
  {
    key: "edital_nao_enviado",
    titulo: "Edital não enviado",
    emoji: "✉️",
    dot: "bg-[#FA5F5B]",
    tone: "from-[#FA5F5B]/10 to-transparent border-[#FA5F5B]/30",
  },
  {
    key: "falta_documentos",
    titulo: "Falta documentos",
    emoji: "📎",
    dot: "bg-amber-500",
    tone: "from-amber-500/10 to-transparent border-amber-500/30",
  },
  {
    key: "realizadas",
    titulo: "Realizadas",
    emoji: "✓",
    dot: "bg-fg/40",
    tone: "from-muted/40 to-transparent border-line",
  },
];

export function Dashboard({ rows, loading, onRefresh, onOpen }: Props) {
  const [filtroResp, setFiltroResp] = useState<string>("");
  const [filtroCrit, setFiltroCrit] = useState<"todos" | Criticidade>("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "lista";
    return localStorage.getItem(VIEW_KEY) === "kanban" ? "kanban" : "lista";
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);


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
    return COLUNAS_KANBAN.map((c) => ({
      ...c,
      rows: filtradas.filter((a) => colunaKanbanFor(a) === c.key),
    }));
  }, [filtradas]);

  const alertas = rows.filter(isProximaComPendencias).length;
  const proximaData = useMemo(() => {
    return filtradas.find((a) => a.data && !isRealizada(a))?.data ?? "";
  }, [filtradas]);

  // Handler do drag-and-drop do kanban: arrastar entre as colunas
  // "edital_enviado" ⇄ "edital_nao_enviado" alterna o campo `editalEnviado`.
  // Outras colunas (sem_data, apresentacao, realizadas) não aceitam drop
  // porque a transição exige preencher outros campos manualmente.
  async function handleMoveEdital(assembleiaId: string, target: ColunaKanban) {
    const alvo = target === "edital_enviado";
    const atual = rows.find((r) => r.id === assembleiaId);
    if (!atual) return;
    // Só faz sentido em assembleias com data e não realizadas.
    if (!atual.data || isRealizada(atual)) return;
    if (atual.editalEnviado === alvo) return; // no-op
    try {
      await patchAssembleia(assembleiaId, { editalEnviado: alvo });
      await onRefresh();
    } catch (err) {
      console.error("[kanban] falha ao mover edital:", err);
      alert(
        "Não foi possível atualizar o status do edital. Tente novamente em alguns segundos.",
      );
    }
  }

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
        <KanbanView colunas={colunasKanban} onOpen={onOpen} onMoveEdital={handleMoveEdital} />
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
  onOpen,
  onMoveEdital,
}: {
  colunas: { key: ColunaKanban; titulo: string; emoji: string; dot: string; tone: string; rows: Assembleia[] }[];
  onOpen: (a: Assembleia) => void;
  onMoveEdital: (assembleiaId: string, target: ColunaKanban) => void;
}) {
  // Coluna sob hover do drag — usado pra dar feedback visual (highlight).
  const [dragOverKey, setDragOverKey] = useState<ColunaKanban | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-fade-in">
      {colunas.map((c) => {
        const aceitaDrop = !!DROP_TARGETS_EDITAL[c.key];
        const sobHover = dragOverKey === c.key && aceitaDrop;
        return (
          <div
            key={c.key}
            className={`flex-shrink-0 w-[300px] flex flex-col surface overflow-hidden transition ${
              sobHover ? "ring-2 ring-fg/40 ring-offset-2 ring-offset-bg" : ""
            }`}
            onDragOver={(e) => {
              // Aceitar drop só se a coluna for "edital_enviado" / "edital_nao_enviado"
              // e o payload arrastado for um card do kanban.
              if (!aceitaDrop) return;
              if (!e.dataTransfer.types.includes(KANBAN_DRAG_MIME)) return;
              e.preventDefault(); // <-- ESSENCIAL: sem isso o drop é rejeitado.
              e.dataTransfer.dropEffect = "move";
              if (dragOverKey !== c.key) setDragOverKey(c.key);
            }}
            onDragLeave={(e) => {
              // O dragleave dispara também ao entrar em filho — usar relatedTarget
              // pra confirmar que saímos da coluna.
              const next = e.relatedTarget as Node | null;
              if (next && (e.currentTarget as Node).contains(next)) return;
              if (dragOverKey === c.key) setDragOverKey(null);
            }}
            onDrop={(e) => {
              if (!aceitaDrop) return;
              e.preventDefault();
              setDragOverKey(null);
              const id = e.dataTransfer.getData(KANBAN_DRAG_MIME);
              if (id) onMoveEdital(id, c.key);
            }}
          >
            <header className={`border-b border-line bg-gradient-to-b px-4 py-3 ${c.tone}`}>
              <h3 className="flex items-center justify-between text-sm font-semibold text-fg">
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.dot}`} />
                  {c.icon ? c.icon : c.emoji && <span>{c.emoji}</span>}
                  <span>{c.titulo}</span>
                </span>
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] tabular-nums text-muted-fg ring-1 ring-line">
                  {c.rows.length}
                </span>
              </h3>
            </header>
            <div className="space-y-2 overflow-y-auto p-2 max-h-[68vh] bg-bg/30">
              {c.rows.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-fg italic">
                  {sobHover ? "Solte aqui" : "Vazio"}
                </p>
              ) : (
                c.rows.map((a) => (
                  <KanbanCard
                    key={a.id}
                    a={a}
                    onOpen={() => onOpen(a)}
                    draggable={a.data ? !isRealizada(a) : false}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
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

function KanbanCard({
  a,
  onOpen,
  draggable = false,
}: {
  a: Assembleia;
  onOpen: () => void;
  draggable?: boolean;
}) {
  const prog = progressoChecklist(a);
  const realizada = isRealizada(a);

  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(KANBAN_DRAG_MIME, a.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`relative cursor-pointer rounded-lg border border-line bg-card p-3 shadow-sm transition hover:shadow-soft hover:border-fg/20 ${
        realizada ? "opacity-60" : ""
      } ${draggable ? "active:cursor-grabbing" : ""}`}
      title={draggable ? "Arraste para 'Edital enviado' ou 'Edital não enviado' para alternar status" : undefined}
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Re-export para evitar warnings de unused imports
export const _CRIT_BADGE = CRITICIDADE_BADGE;
