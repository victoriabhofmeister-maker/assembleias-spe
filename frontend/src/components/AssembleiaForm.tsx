import { useMemo, useState } from "react";
import {
  TIPOS,
  CRITICIDADES,
  TIPO_DESCRICAO,
  temEdital,
  ORDENS_DO_DIA,
  PAUTAS_CRITICAS,
  AVISO_PAUTA_CRITICA,
  ORDEM_LABEL_COMPLETO,
  DOCUMENTOS_INDISPENSAVEIS,
  type AssembleiaInput,
} from "../types";
import { createAssembleia, type CreateAssembleiaResult } from "../api";

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

function labelOrdem(ordem: string): string {
  return ORDEM_LABEL_COMPLETO[ordem] ?? ordem;
}

interface Props {
  onCreated: () => void;
}

export function AssembleiaForm({ onCreated }: Props) {
  const [form, setForm] = useState<AssembleiaInput>(EMPTY);
  // Estado paralelo: usuário seleciona pautas via checkbox; no submit,
  // fundimos em form.ordemDoDia (string) para manter o tipo Assembleia atual.
  const [ordensDoDia, setOrdensDoDia] = useState<string[]>([]);
  const [outraOrdemDescricao, setOutraOrdemDescricao] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateAssembleiaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AssembleiaInput>(key: K, value: AssembleiaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleOrdem(ordem: string) {
    setOrdensDoDia((arr) =>
      arr.includes(ordem) ? arr.filter((o) => o !== ordem) : [...arr, ordem],
    );
  }

  function limpar() {
    setForm(EMPTY);
    setOrdensDoDia([]);
    setOutraOrdemDescricao("");
    setError(null);
  }

  const docsIndispensaveis = useMemo(() => {
    const out: { ordem: string; docs: string[] }[] = [];
    for (const o of ordensDoDia) {
      const docs = DOCUMENTOS_INDISPENSAVEIS[o];
      if (docs && docs.length > 0) out.push({ ordem: o, docs });
    }
    return out;
  }, [ordensDoDia]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    if (ordensDoDia.length === 0) {
      setSubmitting(false);
      setError("Selecione ao menos uma ordem do dia.");
      return;
    }

    // Funde as pautas selecionadas em uma string (mesmo formato usado pelo
    // backend hoje). Se "Outro" estiver selecionado, substitui pelo texto livre.
    const partes = ordensDoDia.map((o) =>
      o === "Outro (especificar)" && outraOrdemDescricao.trim()
        ? outraOrdemDescricao.trim()
        : labelOrdem(o),
    );
    const ordemDoDiaCombinada = partes.join(" · ");

    try {
      const r = await createAssembleia({ ...form, ordemDoDia: ordemDoDiaCombinada });
      setResult(r);
      limpar();
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
            <label className="field-label">Ordem do Dia (selecione uma ou mais) *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-lg border border-line bg-muted/40 p-3">
              {ORDENS_DO_DIA.map((o) => (
                <label
                  key={o}
                  className="flex items-start gap-2 rounded-md border border-line bg-card px-3 py-2 hover:border-[#0048D7]/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-line text-[#0048D7] focus:ring-[#0048D7]/30"
                    checked={ordensDoDia.includes(o)}
                    onChange={() => toggleOrdem(o)}
                  />
                  <span className="text-sm text-fg">{labelOrdem(o)}</span>
                </label>
              ))}
            </div>

            {ordensDoDia.includes("Outro (especificar)") && (
              <div className="mt-3">
                <label className="field-label">Descreva a pauta</label>
                <input
                  className="field-input"
                  placeholder="Qual o tema da deliberação?"
                  value={outraOrdemDescricao}
                  onChange={(e) => setOutraOrdemDescricao(e.target.value)}
                />
              </div>
            )}

            {ordensDoDia.some((o) => PAUTAS_CRITICAS.has(o)) && (
              <div className="mt-3 space-y-2">
                {ordensDoDia
                  .filter((o) => PAUTAS_CRITICAS.has(o))
                  .map((o) => (
                    <div
                      key={o}
                      className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
                    >
                      <strong className="block mb-1 text-amber-700 dark:text-amber-200">
                        ⚠️ {labelOrdem(o)}
                      </strong>
                      <p className="text-xs leading-relaxed">{AVISO_PAUTA_CRITICA[o]}</p>
                    </div>
                  ))}
              </div>
            )}

            {docsIndispensaveis.length > 0 && (
              <div className="mt-3 rounded-lg border border-[#0048D7]/30 bg-[#0048D7]/[0.06] p-4">
                <h3 className="text-sm font-bold text-[#0048D7] mb-2 flex items-center gap-2">
                  📋 Documentos indispensáveis
                </h3>
                <div className="space-y-3">
                  {docsIndispensaveis.map((g) => (
                    <div key={g.ordem}>
                      <p className="text-xs font-semibold text-fg mb-1">
                        {labelOrdem(g.ordem)}
                      </p>
                      <ul className="ml-4 list-disc text-xs text-fg/80 space-y-0.5">
                        {g.docs.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              onClick={limpar}
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
