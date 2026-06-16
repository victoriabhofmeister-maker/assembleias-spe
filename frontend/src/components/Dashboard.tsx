import { useEffect, useMemo, useState } from "react";
import type { Assembleia, Criticidade, EtapaKanban, Solicitacao } from "../types";
import { CRITICIDADES, temEdital } from "../types";
import { patchAssembleia, promoverSolicitacao, deleteAssembleia } from "../api";
import {
  CRITICIDADE_BADGE,
  CRITICIDADE_EMOJI,
  diasAte,
  fmtData,
  isProximaComPendencias,
  isRealizada,
  pendencias,
  progressoChecklist,
  temSlaAtrasado,
} from "../utils";

// MIME types para identificar o que está sendo arrastado no kanban.
const KANBAN_DRAG_MIME = "application/x-seazone-assembleia-id";
const SOLIC_DRAG_MIME = "application/x-seazone-solicitacao-id";

type View = "lista" | "kanban";
type FiltroStatus = "todas" | "proximas" | "realizadas";

const VIEW_KEY = "seazone.dashboard.view";

interface Props {
  rows: Assembleia[];
  solicitacoes: Solicitacao[];
  loading: boolean;
  onRefresh: () => void;
  onOpen: (a: Assembleia) => void;
  onOpenSolicitacoes: () => void;
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

// Colunas do funil (5 estágios). Stage 1 (solicitacoes) é especial: mostra
// Solicitacoes pendentes, não Assembleias. Stages 2-5 mostram Assembleias.
type ColunaKanban =
  | "solicitacoes"
  | "documentos_faltantes"
  | "em_elaboracao"
  | "apresentacao"
  | "edital_enviado"
  | "realizada";

// Coluna ⇄ etapa salva. A coluna "solicitacoes" é o estágio "A elaborar".
// "aprazado" foi removido como coluna; etapa legada cai em "A elaborar".
const ETAPA_TO_COLUNA: Record<EtapaKanban, ColunaKanban> = {
  a_elaborar: "solicitacoes",
  documentos_faltantes: "documentos_faltantes",
  em_elaboracao: "em_elaboracao",
  aprazado: "solicitacoes",
  apresentacao: "apresentacao",
  edital_enviado: "edital_enviado",
  realizada: "realizada",
};
const COLUNA_TO_ETAPA: Record<ColunaKanban, EtapaKanban> = {
  solicitacoes: "a_elaborar",
  documentos_faltantes: "documentos_faltantes",
  em_elaboracao: "em_elaboracao",
  apresentacao: "apresentacao",
  edital_enviado: "edital_enviado",
  realizada: "realizada",
};

// Deriva um selo de situação a partir das colunas "Situação"/"Observações"
// do cronograma (a planilha às vezes registra o status em qualquer uma das duas).
function situacaoTag(a: Assembleia): { label: string; cls: string } | null {
  const txt = `${a.situacao} ${a.observacoes}`.toLowerCase();
  if (txt.includes("cancel"))
    return { label: "Cancelada", cls: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" };
  if (txt.includes("não aconteceu") || txt.includes("nao aconteceu"))
    return { label: "Não aconteceu", cls: "border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300" };
  return null;
}

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

// Mapeia uma Assembleia para sua coluna no kanban (Stages 2-5).
// Stage 1 (solicitacoes) é populado a partir de Solicitacoes, não Assembleias.
function colunaKanbanFor(a: Assembleia): ColunaKanban {
  // Etapa salva (via drag) é a fonte de verdade; senão, deriva pelo estado.
  if (a.etapa) return ETAPA_TO_COLUNA[a.etapa];
  if (isRealizada(a)) return "realizada";
  if (a.editalEnviado) return "edital_enviado";
  if (temApresentacao(a)) return "apresentacao";
  // Sem estado especial → começa em "A elaborar".
  return "solicitacoes";
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

// Ordem das colunas no kanban segue o funil pré-assembleia → realizada.
const COLUNAS_KANBAN: {
  key: ColunaKanban;
  titulo: string;
  emoji: string;
  icon?: React.ReactNode;
  dot: string;
  tone: string;
}[] = [
  {
    key: "solicitacoes",
    titulo: "A elaborar",
    emoji: "📝",
    dot: "bg-[#A855F7]",
    tone: "from-[#A855F7]/10 to-transparent border-[#A855F7]/30",
  },
  {
    key: "documentos_faltantes",
    titulo: "Documentos faltantes",
    emoji: "📄",
    dot: "bg-[#F59E0B]",
    tone: "from-[#F59E0B]/10 to-transparent border-[#F59E0B]/30",
  },
  {
    key: "em_elaboracao",
    titulo: "Em elaboração",
    emoji: "✏️",
    dot: "bg-[#0EA5E9]",
    tone: "from-[#0EA5E9]/10 to-transparent border-[#0EA5E9]/30",
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
    key: "realizada",
    titulo: "Assembleia realizada",
    emoji: "✓",
    dot: "bg-fg/40",
    tone: "from-muted/40 to-transparent border-line",
  },
];

export function Dashboard({
  rows,
  solicitacoes,
  loading,
  onRefresh,
  onOpen,
  onOpenSolicitacoes,
}: Props) {
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

  // Solicitações que aparecem no Stage 1: ainda não viraram Assembleia
  // (status Pendente ou Em análise). Aprovada/Rejeitada saem do kanban.
  const solicitacoesAbertas = useMemo(() => {
    return solicitacoes.filter(
      (s) => s.status === "Pendente de análise" || s.status === "Em análise",
    );
  }, [solicitacoes]);

  const colunasKanban = useMemo(() => {
    // "A elaborar" mostra solicitações abertas + assembleias com etapa a_elaborar.
    return COLUNAS_KANBAN.map((c) => ({
      ...c,
      rows: filtradas.filter((a) => colunaKanbanFor(a) === c.key),
      solicitacoes: c.key === "solicitacoes" ? solicitacoesAbertas : ([] as Solicitacao[]),
    }));
  }, [filtradas, solicitacoesAbertas]);

  const alertas = rows.filter(isProximaComPendencias).length;
  const proximaData = useMemo(() => {
    return filtradas.find((a) => a.data && !isRealizada(a))?.data ?? "";
  }, [filtradas]);

  // Arrastar um card de Assembleia entre quaisquer colunas grava a etapa.
  async function handleMoveAssembleia(assembleiaId: string, target: ColunaKanban) {
    const atual = rows.find((r) => r.id === assembleiaId);
    if (!atual) return;
    if (colunaKanbanFor(atual) === target) return; // no-op (mesma coluna)
    try {
      await patchAssembleia(assembleiaId, { etapa: COLUNA_TO_ETAPA[target] });
      await onRefresh();
    } catch (err) {
      console.error("[kanban] falha ao mover card:", err);
      alert("Não foi possível mover o card. Tente novamente em alguns segundos.");
    }
  }

  // Arrastar uma Solicitação de "A elaborar" para frente a converte em Assembleia.
  async function handlePromoverSolicitacao(solicitacaoId: string, target: ColunaKanban) {
    if (target === "solicitacoes") return; // continua em "A elaborar"
    try {
      await promoverSolicitacao(solicitacaoId, COLUNA_TO_ETAPA[target]);
      await onRefresh();
    } catch (err) {
      console.error("[kanban] falha ao promover solicitação:", err);
      alert("Não foi possível converter a solicitação em assembleia. Tente novamente.");
    }
  }

  async function handleDelete(assembleiaId: string) {
    const atual = rows.find((r) => r.id === assembleiaId);
    if (
      !window.confirm(
        `Excluir esta assembleia${atual ? ` — ${atual.spe}` : ""}? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    try {
      await deleteAssembleia(assembleiaId);
      await onRefresh();
    } catch (err) {
      console.error("[kanban] falha ao excluir:", err);
      alert("Não foi possível excluir o card. Tente novamente.");
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
          onDelete={handleDelete}
        />
      ) : (
        <KanbanView
          colunas={colunasKanban}
          onOpen={onOpen}
          onMoveAssembleia={handleMoveAssembleia}
          onPromoverSolicitacao={handlePromoverSolicitacao}
          onDelete={handleDelete}
          onOpenSolicitacoes={onOpenSolicitacoes}
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
  onDelete,
}: {
  gruposFuturas: { label: string; rows: Assembleia[] }[];
  gruposRealizadas: { label: string; rows: Assembleia[] }[];
  onOpen: (a: Assembleia) => void;
  onDelete: (id: string) => void;
}) {
  const mostrarDivisor = gruposFuturas.length > 0 && gruposRealizadas.length > 0;

  return (
    <div className="space-y-10 animate-fade-in">
      {gruposFuturas.map((g) => (
        <MonthGroup key={`f-${g.label}`} group={g} dimmed={false} onOpen={onOpen} onDelete={onDelete} />
      ))}

      {mostrarDivisor && (
        <DivisorRealizadas total={gruposRealizadas.reduce((n, g) => n + g.rows.length, 0)} />
      )}

      {gruposRealizadas.map((g) => (
        <MonthGroup key={`r-${g.label}`} group={g} dimmed={true} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </div>
  );
}

function MonthGroup({
  group,
  dimmed,
  onOpen,
  onDelete,
}: {
  group: { label: string; rows: Assembleia[] };
  dimmed: boolean;
  onOpen: (a: Assembleia) => void;
  onDelete: (id: string) => void;
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
          <AssembleiaCard key={a.id} a={a} onOpen={() => onOpen(a)} onDelete={() => onDelete(a.id)} />
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
  onMoveAssembleia,
  onPromoverSolicitacao,
  onDelete,
  onOpenSolicitacoes,
}: {
  colunas: {
    key: ColunaKanban;
    titulo: string;
    emoji: string;
    icon?: React.ReactNode;
    dot: string;
    tone: string;
    rows: Assembleia[];
    solicitacoes: Solicitacao[];
  }[];
  onOpen: (a: Assembleia) => void;
  onMoveAssembleia: (assembleiaId: string, target: ColunaKanban) => void;
  onPromoverSolicitacao: (solicitacaoId: string, target: ColunaKanban) => void;
  onDelete: (id: string) => void;
  onOpenSolicitacoes: () => void;
}) {
  // Coluna sob hover do drag — usado pra dar feedback visual (highlight).
  const [dragOverKey, setDragOverKey] = useState<ColunaKanban | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 animate-fade-in">
      {colunas.map((c) => {
        const sobHover = dragOverKey === c.key;
        const total = c.rows.length + c.solicitacoes.length;
        return (
          <div
            key={c.key}
            className={`flex-shrink-0 w-[300px] flex flex-col surface overflow-hidden transition ${
              sobHover ? "ring-2 ring-fg/40 ring-offset-2 ring-offset-bg" : ""
            }`}
            onDragOver={(e) => {
              const t = e.dataTransfer.types;
              if (!t.includes(KANBAN_DRAG_MIME) && !t.includes(SOLIC_DRAG_MIME)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverKey !== c.key) setDragOverKey(c.key);
            }}
            onDragLeave={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && (e.currentTarget as Node).contains(next)) return;
              if (dragOverKey === c.key) setDragOverKey(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverKey(null);
              const assembleiaId = e.dataTransfer.getData(KANBAN_DRAG_MIME);
              if (assembleiaId) {
                onMoveAssembleia(assembleiaId, c.key);
                return;
              }
              const solicId = e.dataTransfer.getData(SOLIC_DRAG_MIME);
              if (solicId) onPromoverSolicitacao(solicId, c.key);
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
                  {total}
                </span>
              </h3>
            </header>
            <div className="space-y-2 overflow-y-auto p-2 max-h-[68vh] bg-bg/30">
              {total === 0 ? (
                <p className="py-8 text-center text-xs text-muted-fg italic">
                  {sobHover ? "Solte aqui" : "Vazio"}
                </p>
              ) : (
                <>
                  {c.solicitacoes.map((s) => (
                    <SolicitacaoKanbanCard key={s.id} s={s} onOpen={onOpenSolicitacoes} />
                  ))}
                  {c.rows.map((a) => (
                    <KanbanCard
                      key={a.id}
                      a={a}
                      onOpen={() => onOpen(a)}
                      onDelete={() => onDelete(a.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssembleiaCard({
  a,
  onOpen,
  onDelete,
}: {
  a: Assembleia;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const pend = pendencias(a);
  const destaque = isProximaComPendencias(a);
  const realizada = isRealizada(a);
  const prog = progressoChecklist(a);
  const sit = situacaoTag(a);
  const obs = a.observacoes?.trim();
  const atrasado = !realizada && temSlaAtrasado(a);

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
        <span className="absolute right-12 top-4 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-fg">
          Realizada
        </span>
      )}
      <CardDeleteButton onDelete={onDelete} />

      <div className="flex items-start gap-3">
        <CriticidadeBlock c={a.criticidade} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="chip">{a.tipo}</span>
            {sit && <span className={`chip ${sit.cls}`}>{sit.label}</span>}
            {atrasado && (
              <span className="chip border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                ⏰ SLA vencido
              </span>
            )}
            {realizada && (
              <span className="chip">✓ Realizada</span>
            )}
          </div>
          <h3 className="text-display text-lg font-semibold leading-snug">{a.spe}</h3>
        </div>
      </div>

      <div className="mt-3">
        <PrazoBadge a={a} />
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

      {obs && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-eyebrow mb-1">Observações</div>
          <p className="text-xs leading-relaxed text-muted-fg line-clamp-3" title={obs}>
            {obs}
          </p>
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
  onDelete,
}: {
  a: Assembleia;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const prog = progressoChecklist(a);
  const realizada = isRealizada(a);
  const atrasado = !realizada && temSlaAtrasado(a);

  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(KANBAN_DRAG_MIME, a.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative cursor-pointer rounded-lg border border-line bg-card p-3 shadow-sm transition hover:shadow-soft hover:border-fg/20 active:cursor-grabbing ${
        realizada ? "opacity-60" : ""
      } ${atrasado ? "ring-1 ring-rose-500/40" : ""}`}
      title="Arraste para outra coluna para mudar a etapa"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <CriticidadeDot c={a.criticidade} />
        <span className="chip py-0.5 px-1.5 text-[10px]">{a.tipo}</span>
        {atrasado && <span className="text-[11px]" title="SLA vencido">⏰</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tabular-nums text-muted-fg">
            {prog.done}/{prog.total}
          </span>
          <CardDeleteButton onDelete={onDelete} small />
        </span>
      </div>
      <h4 className="text-display text-sm font-semibold leading-tight">{a.spe}</h4>
      <div className="mt-2">
        <PrazoBadge a={a} compact />
      </div>
      <div className="mt-2 flex items-center justify-end text-[11px] text-muted-fg">
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

// Botão de excluir reutilizável (para de propagar o clique de abrir o card).
function CardDeleteButton({ onDelete, small = false }: { onDelete: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label="Excluir card"
      title="Excluir"
      className={`${
        small ? "p-0.5" : "absolute right-3 top-3 z-10 p-1"
      } rounded-md text-muted-fg/60 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100`}
    >
      <svg width={small ? "13" : "15"} height={small ? "13" : "15"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}

// Card do Stage 1 do kanban — representa uma Solicitacao ainda não convertida
// em Assembleia. Não é arrastável (a transição requer ação no formulário,
// não drag). Click leva pra view de Solicitações.
function SolicitacaoKanbanCard({
  s,
  onOpen,
}: {
  s: Solicitacao;
  onOpen: () => void;
}) {
  const pautas = s.ordensDoDia.slice(0, 2).join(" · ");
  const sobra = s.ordensDoDia.length > 2 ? ` +${s.ordensDoDia.length - 2}` : "";
  return (
    <article
      onClick={onOpen}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(SOLIC_DRAG_MIME, s.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="relative cursor-pointer rounded-lg border border-dashed border-[#A855F7]/40 bg-card p-3 shadow-sm transition hover:shadow-soft hover:border-[#A855F7]/70 active:cursor-grabbing"
      title="Arraste para 'Aprazado' (ou outro estágio) para converter em assembleia"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="chip py-0.5 px-1.5 text-[10px]">{s.tipo}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-fg">
          {s.status === "Em análise" ? "Em análise" : "Pendente"}
        </span>
      </div>
      <h4 className="text-display text-sm font-semibold leading-tight">{s.spe || "(SPE não informada)"}</h4>
      <p className="mt-1 text-[11px] text-muted-fg line-clamp-2">
        {pautas || "Sem pauta informada"}
        {sobra}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-fg">
        <span className="truncate" title={s.nomeSolicitante}>
          {s.nomeSolicitante || "—"}
        </span>
        <span className="italic">{s.departamentoSolicitante}</span>
      </div>
    </article>
  );
}

// Badge visual de prazo (data prevista da assembleia), visível no card fechado.
function PrazoBadge({ a, compact = false }: { a: Assembleia; compact?: boolean }) {
  const dias = diasAte(a.data);
  const semData = !a.data;

  let tone = "border-line bg-muted/60 text-muted-fg";
  let extra = "";
  if (!semData && dias !== null) {
    if (dias < 0) {
      tone = "border-rose-500/40 bg-rose-500/12 text-rose-700 dark:text-rose-300";
      extra = `${Math.abs(dias)}d atrás`;
    } else if (dias === 0) {
      tone = "border-amber-500/50 bg-amber-500/20 text-amber-800 dark:text-amber-200";
      extra = "hoje";
    } else if (dias <= 7) {
      tone = "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300";
      extra = `em ${dias}d`;
    } else {
      tone = "border-[#0048D7]/35 bg-[#0048D7]/10 text-[#0048D7] dark:text-sky-300";
      extra = `em ${dias}d`;
    }
  } else if (semData) {
    tone = "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 font-semibold ${tone} ${
        compact ? "py-1 text-[11px]" : "py-1.5 text-xs"
      }`}
    >
      <CalendarIcon />
      <span className="tabular-nums">
        {semData ? "Prazo a definir" : `Prazo: ${fmtData(a.data)}`}
      </span>
      {extra && (
        <span className="ml-auto rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] dark:bg-white/10">
          {extra}
        </span>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
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
