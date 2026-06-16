import { useRef, useState } from "react";
import type { Assembleia, ChecklistItem, ChecklistStatus, TipoAssembleia } from "../types";
import { PONTOS_FOCAIS, STATUS_CHECKLIST, TIPO_DESCRICAO, temEdital } from "../types";
import { patchAssembleia, updateChecklist, updateChecklistPos } from "../api";
import { fmtData, progressoChecklist, slaInfo } from "../utils";
import { RoteiroPanel } from "./RoteiroPanel";
import { AtaPanel } from "./AtaPanel";

type Tab = "checklist" | "roteiro" | "ata";

function etapaParaTipo(c: ChecklistItem, _idx: number, tipo: TipoAssembleia): ChecklistItem {
  // A etapa "Convocar a assembleia" é condicional por tipo (só faz sentido com edital).
  if (!c.titulo.startsWith("Convocar a assembleia")) return c;
  if (temEdital(tipo)) return c;
  return {
    ...c,
    titulo: "Confirmar participação dos envolvidos",
    prazo: "Confirmar com todos os participantes que estarão presentes na reunião.",
  };
}

interface Props {
  assembleia: Assembleia;
  onClose: () => void;
  onChange: (updated: Assembleia) => void;
}

export function AssembleiaDetail({ assembleia, onClose, onChange }: Props) {
  const [a, setA] = useState<Assembleia>(assembleia);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("checklist");
  const printRef = useRef<HTMLDivElement>(null);

  async function changeStatus(idx: number, status: ChecklistStatus) {
    setSavingIdx(idx);
    setError(null);
    try {
      const updated = await updateChecklist(a.id, idx, status);
      setA(updated);
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingIdx(null);
    }
  }

  const prog = progressoChecklist(a);
  const critTone =
    a.criticidade === "Alto"
      ? "bg-rose-500"
      : a.criticidade === "Medio"
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="modal-content surface w-full max-w-3xl my-8 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        ref={printRef}
      >
        <header className="no-print relative flex items-start gap-4 border-b border-line bg-muted/40 p-6">
          <span className={`block h-14 w-1 rounded-full ${critTone}`} />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="chip">{a.tipo}</span>
              <span className="text-[11px] text-muted-fg">{TIPO_DESCRICAO[a.tipo]}</span>
            </div>
            <h2 className="text-display text-2xl font-semibold leading-tight">
              {a.spe}
            </h2>
            <p className="mt-0.5 text-sm text-muted-fg">
              {a.data ? fmtData(a.data) : "Data a definir"}
              {a.responsavel && (
                <>
                  {" · "}Responsável: <span className="text-fg">{a.responsavel}</span>
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-fg transition hover:bg-card hover:text-fg"
            aria-label="Fechar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="no-print flex gap-1 border-b border-line bg-card px-6">
          <TabButton active={tab === "checklist"} onClick={() => setTab("checklist")}>
            ✅ Checklist
            <span className="ml-2 text-[11px] font-semibold opacity-80 tabular-nums">
              {prog.done}/{prog.total}
            </span>
          </TabButton>
          <TabButton active={tab === "roteiro"} onClick={() => setTab("roteiro")}>
            📋 Roteiro
          </TabButton>
          <TabButton active={tab === "ata"} onClick={() => setTab("ata")}>
            📝 Ata
          </TabButton>
        </div>

        <div className="p-6">
          {tab === "roteiro" && <RoteiroPanel assembleia={a} />}
          {tab === "ata" && <AtaPanel assembleia={a} />}
          {tab === "checklist" && (
            <>
              <ChecklistSection
                a={a}
                changeStatus={changeStatus}
                changeStatusPos={async (idx, status) => {
                  setSavingIdx(idx + 100);
                  setError(null);
                  try {
                    const updated = await updateChecklistPos(a.id, idx, status);
                    setA(updated);
                    onChange(updated);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setSavingIdx(null);
                  }
                }}
                savingIdx={savingIdx}
                error={error}
                onPrint={() => window.print()}
              />
              <ComentariosEditor
                a={a}
                onSaved={(updated) => {
                  setA(updated);
                  onChange(updated);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistSection({
  a,
  changeStatus,
  changeStatusPos,
  savingIdx,
  error,
  onPrint,
}: {
  a: Assembleia;
  changeStatus: (i: number, s: ChecklistStatus) => Promise<void>;
  changeStatusPos: (i: number, s: ChecklistStatus) => Promise<void>;
  savingIdx: number | null;
  error: string | null;
  onPrint: () => void;
}) {
  const prog = progressoChecklist(a);
  const pos = a.checklistPos ?? [];
  const posDone = pos.filter((c) => c.status === "Concluído").length;

  return (
    <div className="space-y-6 print-doc">
      <div className="no-print flex items-end justify-between">
        <div>
          <p className="text-eyebrow">Etapas pré-assembleia</p>
          <h3 className="text-display text-lg font-semibold">
            {prog.done}/{prog.total} concluídas
          </h3>
        </div>
        <button onClick={onPrint} className="btn-ghost text-xs">
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fg/70 to-fg transition-all"
          style={{ width: `${prog.pct}%` }}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <ol className="space-y-2.5 print-section">
        {a.checklist.map((raw, i) => {
          const c = etapaParaTipo(raw, i, a.tipo);
          const done = c.status === "Concluído";
          const inProgress = c.status === "Em andamento";
          return (
            <li
              key={i}
              className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                done
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : inProgress
                    ? "border-amber-500/30 bg-amber-500/[0.04]"
                    : "border-line bg-card"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : inProgress
                      ? "bg-amber-500 text-white"
                      : "bg-muted text-fg"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-fg">{c.titulo}</p>
                  {done && (
                    <span
                      title="Notificação enviada ao Slack"
                      aria-label="Notificação enviada ao Slack"
                      className="text-sm cursor-help select-none"
                    >
                      💬
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-fg">
                  <span className="font-medium text-fg">{c.responsavel}</span> · {c.prazo}
                </p>
                {(() => {
                  const sla = slaInfo(a, c);
                  if (!sla) return null;
                  return (
                    <p
                      className={`mt-0.5 text-[11px] font-semibold ${
                        sla.overdue
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {sla.overdue
                        ? `⏰ SLA vencido (limite ${sla.dueLabel})`
                        : `🎯 SLA: vence ${sla.dueLabel}`}
                    </p>
                  );
                })()}
              </div>
              <select
                value={c.status}
                disabled={savingIdx === i}
                onChange={(e) => changeStatus(i, e.target.value as ChecklistStatus)}
                className="no-print rounded-md border border-line bg-card px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {STATUS_CHECKLIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ol>

      {/* Checklist pós-assembleia */}
      {pos.length > 0 && (
        <div className="pt-2">
          <div className="no-print mb-3 flex items-end justify-between">
            <div>
              <p className="text-eyebrow">Pós-assembleia</p>
              <h3 className="text-display text-lg font-bold">
                {posDone}/{pos.length} concluídas
              </h3>
              <p className="text-xs text-muted-fg mt-0.5">
                Execução depois que a assembleia foi realizada.
              </p>
            </div>
          </div>
          <ol className="space-y-2.5 print-section">
            {pos.map((c, i) => {
              const done = c.status === "Concluído";
              const inProgress = c.status === "Em andamento";
              return (
                <li
                  key={i}
                  className={`flex items-start gap-4 rounded-xl border p-4 transition ${
                    done
                      ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                      : inProgress
                        ? "border-amber-500/30 bg-amber-500/[0.04]"
                        : "border-line bg-card"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? "bg-emerald-500 text-white"
                        : inProgress
                          ? "bg-amber-500 text-white"
                          : "bg-[#0048D7]/15 text-[#0048D7]"
                    }`}
                  >
                    {done ? "✓" : `P${i + 1}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-fg">{c.titulo}</p>
                      {done && (
                        <span
                          title="Notificação enviada ao Slack"
                          aria-label="Notificação enviada ao Slack"
                          className="text-sm cursor-help select-none"
                        >
                          💬
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-fg">
                      <span className="font-medium text-fg">{c.responsavel}</span> · {c.prazo}
                    </p>
                  </div>
                  <select
                    value={c.status}
                    disabled={savingIdx === i + 100}
                    onChange={(e) => changeStatusPos(i, e.target.value as ChecklistStatus)}
                    className="no-print rounded-md border border-line bg-card px-2 py-1 text-xs focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {STATUS_CHECKLIST.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div>
        <p className="text-eyebrow mb-3">Pontos focais por área</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {PONTOS_FOCAIS.map((p) => (
            <div
              key={p.area}
              className="rounded-lg border border-line bg-muted/30 px-3 py-2.5"
            >
              <div className="text-eyebrow">{p.area}</div>
              <div className="text-sm font-medium text-fg">{p.pessoa}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-eyebrow mb-2">Ordem do dia</p>
        <p className="text-sm text-fg whitespace-pre-wrap">{a.ordemDoDia}</p>
      </div>
    </div>
  );
}

function ComentariosEditor({
  a,
  onSaved,
}: {
  a: Assembleia;
  onSaved: (updated: Assembleia) => void;
}) {
  const [texto, setTexto] = useState(a.comentarios ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = texto !== (a.comentarios ?? "");

  async function salvar() {
    setSaving(true);
    setErr(null);
    try {
      const updated = await patchAssembleia(a.id, { comentarios: texto });
      onSaved(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-eyebrow">💬 Comentários</p>
        {dirty && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            não salvo
          </span>
        )}
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Anotações internas sobre esta assembleia…"
        className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {err && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{err}</p>}
      <div className="mt-2 flex justify-end">
        <button
          onClick={salvar}
          disabled={!dirty || saving}
          className="btn-ghost text-xs disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar comentários"}
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${
        active
          ? "border-fg text-fg"
          : "border-transparent text-muted-fg hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
