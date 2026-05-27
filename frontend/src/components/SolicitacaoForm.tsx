import { useMemo, useState } from "react";
import {
  DEPARTAMENTOS,
  AVISO_PAUTA_CRITICA,
  DOCUMENTOS_INDISPENSAVEIS,
  ORDEM_LABEL_COMPLETO,
  ORDENS_DO_DIA,
  PAUTAS_CRITICAS,
  SPES_DISPONIVEIS,
  TIPOS,
  TIPO_DESCRICAO,
  type DepartamentoSolicitante,
  type TipoAssembleia,
} from "../types";
import { createSolicitacao, type CreateSolicitacaoResult } from "../api";

interface FormState {
  nomeSolicitante: string;
  departamentoSolicitante: DepartamentoSolicitante;
  spe: string;
  tipo: TipoAssembleia;
  ordensDoDia: string[];
  outraOrdemDescricao: string;
  observacoes: string;
}

const EMPTY: FormState = {
  nomeSolicitante: "",
  departamentoSolicitante: "Jurídico",
  spe: "",
  tipo: "AGE",
  ordensDoDia: [],
  outraOrdemDescricao: "",
  observacoes: "",
};

function labelOrdem(ordem: string): string {
  return ORDEM_LABEL_COMPLETO[ordem] ?? ordem;
}

export function SolicitacaoForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateSolicitacaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleOrdem(ordem: string) {
    setForm((f) => ({
      ...f,
      ordensDoDia: f.ordensDoDia.includes(ordem)
        ? f.ordensDoDia.filter((o) => o !== ordem)
        : [...f.ordensDoDia, ordem],
    }));
  }

  const docsIndispensaveis = useMemo(() => {
    const out: { ordem: string; docs: string[] }[] = [];
    for (const ordem of form.ordensDoDia) {
      const docs = DOCUMENTOS_INDISPENSAVEIS[ordem];
      if (docs && docs.length > 0) out.push({ ordem, docs });
    }
    return out;
  }, [form.ordensDoDia]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    if (form.ordensDoDia.length === 0) {
      setSubmitting(false);
      setError("Selecione ao menos uma ordem do dia.");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("nomeSolicitante", form.nomeSolicitante);
      fd.append("departamentoSolicitante", form.departamentoSolicitante);
      fd.append("spe", form.spe);
      fd.append("dataPretendida", "");
      fd.append("tipo", form.tipo);
      fd.append("ordensDoDia", JSON.stringify(form.ordensDoDia));
      fd.append("outraOrdemDescricao", form.outraOrdemDescricao);
      fd.append("observacoes", form.observacoes);
      fd.append("indicacoes", "[]");

      const r = await createSolicitacao(fd);
      setResult(r);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-[#00143D] text-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Seazone · Jurídico
          </p>
          <h1 className="mt-1 text-2xl font-bold">Solicitar nova assembleia</h1>
          <p className="mt-1 text-sm text-white/70">
            Preencha os campos abaixo para enviar uma solicitação ao Jurídico.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="card p-6 md:p-8">
          {error && (
            <div className="mb-4 rounded-lg border border-[#FA5F5B]/30 bg-[#FA5F5B]/10 px-4 py-3 text-sm text-[#FA5F5B]">
              <strong>Erro:</strong> {error}
            </div>
          )}

          {result && (
            <div className="mb-4 rounded-lg border border-[#2FB864]/40 bg-[#2FB864]/10 px-4 py-3 text-sm text-[#2FB864]">
              <strong>✅ Solicitação registrada.</strong> Status:{" "}
              <strong>{result.solicitacao.status}</strong>.{" "}
              {result.slack.ok
                ? "Notificação enviada ao Slack."
                : `Slack: ${result.slack.error ?? "falhou"}.`}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="field-label">Seu nome *</label>
              <input
                required
                className="field-input"
                value={form.nomeSolicitante}
                onChange={(e) => setForm((f) => ({ ...f, nomeSolicitante: e.target.value }))}
              />
            </div>

            <div>
              <label className="field-label">Departamento solicitante *</label>
              <select
                className="field-input"
                value={form.departamentoSolicitante}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    departamentoSolicitante: e.target.value as DepartamentoSolicitante,
                  }))
                }
              >
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">SPE / Empreendimento *</label>
              <select
                required
                className="field-input"
                value={form.spe}
                onChange={(e) => setForm((f) => ({ ...f, spe: e.target.value }))}
              >
                <option value="">Selecione…</option>
                {SPES_DISPONIVEIS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Tipo de assembleia *</label>
              <select
                className="field-input"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoAssembleia }))}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t} — {TIPO_DESCRICAO[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="field-label">Ordens do dia (selecione uma ou mais) *</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-lg border border-line bg-muted/40 p-3">
                {ORDENS_DO_DIA.map((o) => (
                  <label
                    key={o}
                    className="flex items-start gap-2 rounded-md border border-line bg-card px-3 py-2 hover:border-[#0048D7]/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-line text-[#0048D7] focus:ring-[#0048D7]/30"
                      checked={form.ordensDoDia.includes(o)}
                      onChange={() => toggleOrdem(o)}
                    />
                    <span className="text-sm text-fg">{labelOrdem(o)}</span>
                  </label>
                ))}
              </div>

              {form.ordensDoDia.includes("Outro (especificar)") && (
                <div className="mt-3">
                  <label className="field-label">Descreva a pauta</label>
                  <input
                    className="field-input"
                    placeholder="Qual o tema da deliberação?"
                    value={form.outraOrdemDescricao}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, outraOrdemDescricao: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            {form.ordensDoDia.some((o) => PAUTAS_CRITICAS.has(o)) && (
              <div className="md:col-span-2 space-y-2">
                {form.ordensDoDia
                  .filter((o) => PAUTAS_CRITICAS.has(o))
                  .map((o) => (
                    <div
                      key={o}
                      className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
                    >
                      <strong className="block mb-1 text-amber-700 dark:text-amber-200">
                        {labelOrdem(o)}
                      </strong>
                      <p className="text-xs leading-relaxed">
                        {AVISO_PAUTA_CRITICA[o]}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {docsIndispensaveis.length > 0 && (
              <div className="md:col-span-2 rounded-lg border border-[#0048D7]/30 bg-[#0048D7]/[0.06] p-4">
                <h3 className="text-sm font-bold text-[#0048D7] mb-2 flex items-center gap-2">
                  📋 Documentos indispensáveis
                </h3>
                <p className="text-xs text-fg/80 mb-3">
                  Reúna estes documentos antes de a solicitação ser convocada. Você não
                  precisa anexar agora — o time do Jurídico vai cobrar diretamente quando
                  começar a preparar o edital.
                </p>
                <div className="space-y-3">
                  {docsIndispensaveis.map((g) => (
                    <div
                      key={g.ordem}
                      className="rounded-md bg-card border border-line px-3 py-2"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-fg mb-1">
                        {labelOrdem(g.ordem)}
                      </div>
                      <ul className="space-y-0.5 text-sm text-fg">
                        {g.docs.map((d) => (
                          <li key={d} className="flex items-start gap-1.5">
                            <span className="text-[#0048D7] mt-0.5">•</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="field-label">Observações adicionais</label>
              <textarea
                className="field-input min-h-[90px]"
                placeholder="Algum contexto, urgência ou nuance que o Jurídico deva saber?"
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-line">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar solicitação"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-xs text-muted-fg text-center mt-6">
          Esta página é pública e pode ser compartilhada com qualquer pessoa da empresa.
        </p>
      </main>
    </div>
  );
}
