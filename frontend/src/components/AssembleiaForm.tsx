import { useState } from "react";
import {
    TIPOS,
    CRITICIDADES,
    TIPO_DESCRICAO,
    temEdital,
    type AssembleiaInput,
} from "../types";
import { createAssembleia, type CreateResult } from "../api";

const EMPTY: AssembleiaInput = {
    data: "",
    tipo: "AGE",
    ordemDoDia: "",
    dataLimiteEdital: "",
    suporteCsi: "",
    editalEnviado: false,
    apresentacao: "",
    dptosEnvolvidos: "",
    spe: "",
    criticidade: "Medio",
    responsavel: "",
};

interface Props {
    onCreated: () => void;
}

export function AssembleiaForm({ onCreated }: Props) {
    const [form, setForm] = useState<AssembleiaInput>(EMPTY);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<CreateResult | null>(null);
    const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AssembleiaInput>(key: K, value: AssembleiaInput[K]) {
        setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        setResult(null);
        try {
                const r = await createAssembleia(form);
                setResult(r);
                setForm(EMPTY);
                onCreated();
        } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
        } finally {
                setSubmitting(false);
        }
  }

  return (
        <div className="mx-auto max-w-4xl px-6 py-8">
              <div className="card p-8">
                      <div className="mb-6 border-b border-line pb-4">
                                <h2 className="text-xl font-semibold text-fg">Registrar nova assembleia</h2>
                                <p className="mt-1 text-sm text-muted-fg">
                                            Os dados são gravados localmente e disparam notificação ao Slack.
                                </p>
                      </div>
              
                {error && (
                    <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                                <strong>Erro:</strong> {error}
                    </div>
                      )}
              
                {result && (
                    <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 dark:text-emerald-300">
                                <strong>Assembleia registrada.</strong>{" "}
                      {result.slack.ok ? (
                                    <>Notificação enviada ao Slack ✅</>
                                  ) : (
                                    <>Envio ao Slack falhou: {result.slack.error}</>
                                  )}
                    </div>
                      )}
              
                      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                            <label className="field-label">SPE *</label>
                                            <input
                                                            required
                                                            className="field-input"
                                                            value={form.spe}
                                                            placeholder="Ex.: Barra Spot"
                                                            onChange={(e) => set("spe", e.target.value)}
                                                          />
                                </div>
                      
                                <div>
                                            <label className="field-label">Data *</label>
                                            <input
                                                            required
                                                            type="date"
                                                            className="field-input"
                                                            value={form.data}
                                                            onChange={(e) => set("data", e.target.value)}
                                                          />
                                </div>
                      
                                <div>
                                            <label className="field-label">Tipo de reunião *</label>
                                            <select
                                                            className="field-input"
                                                            value={form.tipo}
                                                            onChange={(e) => set("tipo", e.target.value as AssembleiaInput["tipo"])}
                                                          >
                                              {TIPOS.map((t) => (
                                                                            <option key={t} value={t}>
                                                                              {t} — {TIPO_DESCRICAO[t]}
                                                                            </option>
                                                                          ))}
                                            </select>
                                </div>
                      
                                <div>
                                            <label className="field-label">Nível de criticidade *</label>
                                            <select
                                                            className="field-input"
                                                            value={form.criticidade}
                                                            onChange={(e) =>
                                                                              set("criticidade", e.target.value as AssembleiaInput["criticidade"])
                                                            }
                                                          >
                                              {CRITICIDADES.map((c) => (
                                                                            <option key={c} value={c}>
                                                                              {c === "Alto" ? "🔴 Alto" : c === "Medio" ? "🟡 Médio" : "🟢 Baixo"}
                                                                            </option>
                                                                          ))}
                                            </select>
                                </div>
                      
                                <div className="md:col-span-2">
                                            <label className="field-label">Ordem do dia *</label>
                                            <textarea
                                                            required
                                                            className="field-input min-h-[90px]"
                                                            value={form.ordemDoDia}
                                                            placeholder="Aprovação de contas, deliberação sobre permuta, eleição de administrador..."
                                                            onChange={(e) => set("ordemDoDia", e.target.value)}
                                                          />
                                </div>
                      
                                <div>
                                            <label className="field-label">Data limite do edital</label>
                                            <input
                                                            type="date"
                                                            className="field-input"
                                                            value={form.dataLimiteEdital}
                                                            onChange={(e) => set("dataLimiteEdital", e.target.value)}
                                                          />
                                </div>
                      
                                <div>
                                            <label className="field-label">Suporte CSI</label>
                                            <input
                                                            className="field-input"
                                                            value={form.suporteCsi}
                                                            placeholder="Ex.: Mariana / equipe contábil"
                                                            onChange={(e) => set("suporteCsi", e.target.value)}
                                                          />
                                </div>
                      
                                <div className="flex items-end">
                                            <label className="inline-flex items-center gap-2 text-sm">
                                                          <input
                                                                            type="checkbox"
                                                                            className="h-4 w-4 rounded border-line text-fg focus:ring-accent/30"
                                                                            checked={form.editalEnviado}
                                                                            onChange={(e) => set("editalEnviado", e.target.checked)}
                                                                          />
                                                          <span className="font-medium text-fg">
                                                            {temEdital(form.tipo) ? "Edital enviado" : "Participação confirmada"}
                                                          </span>
                                            </label>
                                </div>
                      
                                <div>
                                            <label className="field-label">Apresentação</label>
                                            <input
                                                            className="field-input"
                                                            value={form.apresentacao}
                                                            placeholder="Confirmada / Pendente / Não se aplica"
                                                            onChange={(e) => set("apresentacao", e.target.value)}
                                                          />
                                </div>
                      
                                <div className="md:col-span-2">
                                            <label className="field-label">Departamentos envolvidos</label>
                                            <input
                                                            className="field-input"
                                                            value={form.dptosEnvolvidos}
                                                            placeholder="Jurídico, Financeiro, Operações"
                                                            onChange={(e) => set("dptosEnvolvidos", e.target.value)}
                                                          />
                                </div>
                      
                                <div className="md:col-span-2">
                                            <label className="field-label">Responsável</label>
                                            <input
                                                            className="field-input"
                                                            value={form.responsavel}
                                                            placeholder="Nome do responsável pela assembleia"
                                                            onChange={(e) => set("responsavel", e.target.value)}
                                                          />
                                </div>
                      
                                <div className="md:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-line">
                                            <button
                                                            type="button"
                                                            className="btn-ghost"
                                                            onClick={() => setForm(EMPTY)}
                                                            disabled={submitting}
                                                          >
                                                          Limpar
                                            </button>
                                            <button type="submit" className="btn-primary" disabled={submitting}>
                                              {submitting ? "Enviando..." : "Registrar e notificar Slack"}
                                            </button>
                                </div>
                      </form>
              </div>
        </div>
      );
}
