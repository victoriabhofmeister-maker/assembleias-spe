import { useMemo, useState } from "react";
import {
  DEPARTAMENTOS,
  DOCUMENTOS_POR_ORDEM,
  ORDEM_LABEL_COMPLETO,
  ORDENS_DO_DIA,
  SPES_DISPONIVEIS,
  TIPOS,
  TIPO_DESCRICAO,
  UPLOAD_ACCEPT,
  UPLOAD_MAX_BYTES,
  type CampoConfig,
  type DepartamentoSolicitante,
  type TipoAssembleia,
} from "../types";
import { createSolicitacao, type CreateSolicitacaoResult } from "../api";

interface FormState {
  nomeSolicitante: string;
  departamentoSolicitante: DepartamentoSolicitante;
  spe: string;
  dataPretendida: string;
  tipo: TipoAssembleia;
  ordensDoDia: string[];
  outraOrdemDescricao: string;
  observacoes: string;
}

const EMPTY: FormState = {
  nomeSolicitante: "",
  departamentoSolicitante: "Jurídico",
  spe: "",
  dataPretendida: "",
  tipo: "AGE",
  ordensDoDia: [],
  outraOrdemDescricao: "",
  observacoes: "",
};

type FileMap = Record<string, File | null>;
type TextMap = Record<string, string>;

function key(ordem: string, nome: string): string {
  return `${ordem}::${nome}`;
}

function labelOrdem(ordem: string): string {
  return ORDEM_LABEL_COMPLETO[ordem] ?? ordem;
}

export function SolicitacaoForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [files, setFiles] = useState<FileMap>({});
  const [texts, setTexts] = useState<TextMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateSolicitacaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleOrdem(ordem: string) {
    setForm((f) => {
      const has = f.ordensDoDia.includes(ordem);
      const next = has
        ? f.ordensDoDia.filter((o) => o !== ordem)
        : [...f.ordensDoDia, ordem];
      if (has) {
        const config = DOCUMENTOS_POR_ORDEM[ordem];
        if (config) {
          setFiles((m) => {
            const copy = { ...m };
            for (const c of config.campos) {
              if (c.tipo === "upload") delete copy[key(ordem, c.nome)];
            }
            return copy;
          });
          setTexts((m) => {
            const copy = { ...m };
            for (const c of config.campos) {
              if (c.tipo === "texto") delete copy[key(ordem, c.nome)];
            }
            return copy;
          });
        }
      }
      return { ...f, ordensDoDia: next };
    });
  }

  function setFile(k: string, file: File | null) {
    setFiles((m) => ({ ...m, [k]: file }));
  }

  function setText(k: string, valor: string) {
    setTexts((m) => ({ ...m, [k]: valor }));
  }

  const todosCampos = useMemo(() => {
    const out: { ordem: string; campo: CampoConfig; k: string }[] = [];
    for (const ordem of form.ordensDoDia) {
      const config = DOCUMENTOS_POR_ORDEM[ordem];
      if (!config) continue;
      for (const campo of config.campos) {
        out.push({ ordem, campo, k: key(ordem, campo.nome) });
      }
    }
    return out;
  }, [form.ordensDoDia]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    for (const c of todosCampos) {
      if (c.campo.tipo === "upload" && c.campo.obrigatorio && !files[c.k]) {
        setSubmitting(false);
        setError(
          `Documento obrigatório faltando: "${c.campo.nome}" (em "${labelOrdem(c.ordem)}").`,
        );
        return;
      }
      if (c.campo.tipo === "upload") {
        const f = files[c.k];
        if (f && f.size > UPLOAD_MAX_BYTES) {
          setSubmitting(false);
          setError(`Arquivo "${f.name}" excede o limite de 10MB.`);
          return;
        }
      }
    }

    try {
      const fd = new FormData();
      fd.append("nomeSolicitante", form.nomeSolicitante);
      fd.append("departamentoSolicitante", form.departamentoSolicitante);
      fd.append("spe", form.spe);
      fd.append("dataPretendida", form.dataPretendida);
      fd.append("tipo", form.tipo);
      fd.append("ordensDoDia", JSON.stringify(form.ordensDoDia));
      fd.append("outraOrdemDescricao", form.outraOrdemDescricao);
      fd.append("observacoes", form.observacoes);

      const indicacoes = todosCampos
        .filter((c) => c.campo.tipo === "texto" && texts[c.k]?.trim())
        .map((c) => ({ ordemDoDia: c.ordem, campo: c.campo.nome, valor: texts[c.k] }));
      fd.append("indicacoes", JSON.stringify(indicacoes));

      for (const c of todosCampos) {
        if (c.campo.tipo !== "upload") continue;
        const f = files[c.k];
        if (f) fd.append(c.k, f, f.name);
      }

      const r = await createSolicitacao(fd);
      setResult(r);
      setForm(EMPTY);
      setFiles({});
      setTexts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-muted/60 text-fg">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <h1 className="text-lg font-semibold">Seazone — Solicitar nova assembleia</h1>
          <p className="text-sm text-muted-fg">
            Preencha os campos abaixo para enviar uma solicitação ao Jurídico.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="card p-8">
          {error && (
            <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <strong>Erro:</strong> {error}
            </div>
          )}

          {result && (
            <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 dark:text-emerald-300">
              <strong>✅ Solicitação registrada.</strong> Status:{" "}
              <strong>{result.solicitacao.status}</strong>.{" "}
              {result.slack.ok
                ? "Notificação enviada ao Slack."
                : `Slack: ${result.slack.error ?? "falhou"}.`}
              <br />
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                {result.solicitacao.documentos.length} documento(s) anexado(s)
                {result.solicitacao.indicacoes.length > 0 &&
                  ` · ${result.solicitacao.indicacoes.length} indicação(ões)`}
                .
              </span>
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
                <option value="">Selecione...</option>
                {SPES_DISPONIVEIS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Data pretendida *</label>
              <input
                required
                type="date"
                className="field-input"
                value={form.dataPretendida}
                onChange={(e) => setForm((f) => ({ ...f, dataPretendida: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
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
              <div className="space-y-2 rounded-md border border-line bg-muted/40 p-3">
                {ORDENS_DO_DIA.map((o) => (
                  <PautaBlock
                    key={o}
                    ordem={o}
                    checked={form.ordensDoDia.includes(o)}
                    onToggle={() => toggleOrdem(o)}
                    outraOrdemDescricao={form.outraOrdemDescricao}
                    onChangeOutra={(v) => setForm((f) => ({ ...f, outraOrdemDescricao: v }))}
                    files={files}
                    setFile={setFile}
                    texts={texts}
                    setText={setText}
                  />
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="field-label">Observações adicionais</label>
              <textarea
                className="field-input min-h-[90px]"
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
          <br />
          Tipos aceitos: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG · Até 10MB por arquivo.
        </p>
      </main>
    </div>
  );
}

function PautaBlock({
  ordem,
  checked,
  onToggle,
  outraOrdemDescricao,
  onChangeOutra,
  files,
  setFile,
  texts,
  setText,
}: {
  ordem: string;
  checked: boolean;
  onToggle: () => void;
  outraOrdemDescricao: string;
  onChangeOutra: (v: string) => void;
  files: FileMap;
  setFile: (k: string, f: File | null) => void;
  texts: TextMap;
  setText: (k: string, v: string) => void;
}) {
  const config = DOCUMENTOS_POR_ORDEM[ordem];

  return (
    <div
      className={`rounded-md border bg-card transition-colors ${
        checked ? "border-fg/30" : "border-line"
      }`}
    >
      <label className="flex items-start gap-2 px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-line text-fg focus:ring-accent/30"
          checked={checked}
          onChange={onToggle}
        />
        <span className="text-sm text-fg">{labelOrdem(ordem)}</span>
      </label>

      <div
        className={`grid transition-all duration-300 ease-out ${
          checked ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-line">
            {ordem === "Outro (especificar)" && (
              <div>
                <label className="field-label">Descreva a pauta</label>
                <input
                  className="field-input"
                  value={outraOrdemDescricao}
                  onChange={(e) => onChangeOutra(e.target.value)}
                  placeholder="Descrição da pauta a deliberar..."
                />
              </div>
            )}

            {config?.campos.map((campo) => {
              const k = key(ordem, campo.nome);
              if (campo.tipo === "texto") {
                return (
                  <div key={k}>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-fg mb-1">
                      <span aria-hidden>📎</span>
                      <span>{campo.label ?? campo.nome}</span>
                      {!campo.obrigatorio && (
                        <span className="text-[10px] font-normal normal-case text-muted-fg/70">
                          (opcional)
                        </span>
                      )}
                    </div>
                    <input
                      className="field-input"
                      value={texts[k] ?? ""}
                      onChange={(e) => setText(k, e.target.value)}
                    />
                    {campo.ajuda && (
                      <p className="mt-1 text-xs text-muted-fg">{campo.ajuda}</p>
                    )}
                  </div>
                );
              }

              const file = files[k];
              const preenchido = Boolean(file);
              const icon = campo.obrigatorio
                ? preenchido
                  ? "✅"
                  : "❌"
                : "📎";
              const iconColor = campo.obrigatorio
                ? preenchido
                  ? "text-emerald-600"
                  : "text-red-600"
                : "text-muted-fg/70";
              return (
                <div key={k} className="rounded-md bg-muted/40 border border-line p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-fg mb-2">
                    <span className={iconColor} aria-hidden>
                      {icon}
                    </span>
                    <span>{campo.label ?? campo.nome}</span>
                    <span
                      className={`text-[10px] font-normal normal-case ${
                        campo.obrigatorio ? "text-red-600" : "text-muted-fg/70"
                      }`}
                    >
                      {campo.obrigatorio ? "(obrigatório)" : "(opcional)"}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept={UPLOAD_ACCEPT}
                    onChange={(e) => setFile(k, e.target.files?.[0] ?? null)}
                    className="block w-full text-xs file:mr-3 file:rounded-md file:border-0
                               file:bg-fg file:px-3 file:py-1.5 file:text-white
                               file:hover:bg-fg file:cursor-pointer"
                  />
                  {file && (
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                      ✓ {file.name} · {(file.size / 1024).toFixed(0)} KB
                    </p>
                  )}
                </div>
              );
            })}

            {config?.avisoAmarelo && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {config.avisoAmarelo}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
