import { useState } from "react";
import type { Assembleia, ChecklistItem, ChecklistStatus, TipoAssembleia } from "../types";
import { PONTOS_FOCAIS, STATUS_CHECKLIST, TIPO_DESCRICAO, temEdital } from "../types";

function etapaParaTipo(c: ChecklistItem, idx: number, tipo: TipoAssembleia): ChecklistItem {
  if (idx !== 6) return c;
  if (temEdital(tipo)) return c;
  return {
    ...c,
    titulo: "Confirmar participação dos envolvidos",
    prazo: "Confirmar com todos os participantes que estarão presentes na reunião.",
  };
}
import { updateChecklist } from "../api";
import {
  CRITICIDADE_BADGE,
  CRITICIDADE_EMOJI,
  STATUS_BADGE,
  fmtData,
  progressoChecklist,
} from "../utils";
import { RoteiroPanel } from "./RoteiroPanel";

type Tab = "checklist" | "roteiro";

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

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 print:bg-transparent print:p-0 print:block"
      onClick={onClose}
    >
      <div
        className="modal-content card w-full max-w-3xl my-6 p-6 md:p-8 print:max-w-none print:my-0 print:p-0 print:shadow-none print:border-0"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="no-print flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`badge ${CRITICIDADE_BADGE[a.criticidade]}`}>
                {CRITICIDADE_EMOJI[a.criticidade]} {a.criticidade}
              </span>
              <span className="badge bg-navy-100 text-navy-800 ring-1 ring-navy-200">{a.tipo}</span>
              <span className="text-xs text-slate-500">{TIPO_DESCRICAO[a.tipo]}</span>
            </div>
            <h2 className="text-xl font-semibold text-navy-800">{a.spe}</h2>
            <p className="text-sm text-slate-600">
              {fmtData(a.data)} · Responsável: {a.responsavel || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="no-print mt-5 flex gap-2 border-b border-slate-200">
          <TabButton active={tab === "checklist"} onClick={() => setTab("checklist")}>
            ✅ Checklist
            <span className="ml-2 text-[11px] font-semibold opacity-80">
              {prog.done}/{prog.total}
            </span>
          </TabButton>
          <TabButton active={tab === "roteiro"} onClick={() => setTab("roteiro")}>
            📋 Roteiro
          </TabButton>
        </div>

        {tab === "roteiro" ? (
          <section className="mt-5">
            <RoteiroPanel assembleia={a} />
          </section>
        ) : (
        <section className="no-print mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-navy-800 uppercase tracking-wide">
              Checklist pré-assembleia
            </h3>
            <span className="text-xs font-semibold text-slate-600">
              {prog.done}/{prog.total} etapas concluídas
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 mb-4 overflow-hidden">
            <div
              className="h-full bg-navy-700 transition-all"
              style={{ width: `${prog.pct}%` }}
            />
          </div>

          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <ol className="space-y-2">
            {a.checklist.map((raw, i) => {
              const c = etapaParaTipo(raw, i, a.tipo);
              return (
              <li
                key={i}
                className="rounded-md border border-slate-200 bg-white p-3 flex items-start gap-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-800 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{c.titulo}</p>
                    <span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                    {c.status === "Concluído" && (
                      <span
                        title="Notificação enviada ao Slack"
                        aria-label="Notificação enviada ao Slack"
                        className="text-sm cursor-help select-none"
                      >
                        💬
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-medium">{c.responsavel}</span> · {c.prazo}
                  </p>
                </div>
                <select
                  value={c.status}
                  disabled={savingIdx === i}
                  onChange={(e) => changeStatus(i, e.target.value as ChecklistStatus)}
                  className="text-xs rounded-md border border-slate-300 bg-white px-2 py-1
                             focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200"
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

          <div className="mt-4 rounded-md border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900">
            <strong>⚠️ REUNIÃO PRÉVIA DE ALINHAMENTO (48hrs antes)</strong>
            <p className="text-xs mt-1 text-red-800">
              Garantir alinhamento entre Jurídico, PMO e demais áreas envolvidas 48 horas antes da
              assembleia.
            </p>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Pontos focais
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {PONTOS_FOCAIS.map((p) => (
                <div key={p.area} className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{p.area}</div>
                  <div className="font-medium text-slate-800">{p.pessoa}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Ordem do dia
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.ordemDoDia}</p>
          </div>
        </section>
        )}
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
      className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition ${
        active
          ? "border-navy-700 text-navy-800"
          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
