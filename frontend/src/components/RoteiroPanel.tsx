import { useEffect, useState } from "react";
import type { Assembleia, QuorumStatus, Roteiro, RoteiroFormulario } from "../types";
import { QUORUM_CATALOGO, QUORUM_VALORES } from "../types";
import { deleteRoteiro, gerarRoteiro, getRoteiro } from "../api";

interface Props {
  assembleia: Assembleia;
}

const EMPTY_FORM: RoteiroFormulario = {
  linkApresentacao: "",
  presidente: "",
  secretario: "",
  quorum: "A verificar",
  observacoes: "",
};

export function RoteiroPanel({ assembleia }: Props) {
  const [form, setForm] = useState<RoteiroFormulario>(EMPTY_FORM);
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRoteiro(assembleia.id)
      .then((r) => {
        if (cancelled) return;
        setRoteiro(r);
        if (r) setForm(r.formulario);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [assembleia.id]);

  async function handleGerar(force = false) {
    if (force && !window.confirm("Sobrescrever o roteiro existente?")) return;
    setGenerating(true);
    setError(null);
    try {
      const r = await gerarRoteiro(assembleia.id, form);
      setRoteiro(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /ANTHROPIC_API_KEY/i.test(msg)
          ? "Não foi possível gerar o roteiro. Verifique se a ANTHROPIC_API_KEY está configurada no .env do backend."
          : msg,
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleApagar() {
    if (!window.confirm("Apagar o roteiro gerado? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteRoteiro(assembleia.id);
      setRoteiro(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-fg py-8 text-center">Carregando...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="no-print rounded-md border border-line bg-card p-4 space-y-4">
        <h4 className="text-sm font-semibold text-fg uppercase tracking-wide">
          Dados para o roteiro
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="field-label">Link da apresentação</label>
            <input
              className="field-input"
              type="url"
              placeholder="https://..."
              value={form.linkApresentacao}
              onChange={(e) => setForm((f) => ({ ...f, linkApresentacao: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Presidente da mesa</label>
            <input
              className="field-input"
              value={form.presidente}
              onChange={(e) => setForm((f) => ({ ...f, presidente: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Secretário(a)</label>
            <input
              className="field-input"
              value={form.secretario}
              onChange={(e) => setForm((f) => ({ ...f, secretario: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Quórum necessário</label>
            <select
              className="field-input"
              value={form.quorum}
              onChange={(e) => setForm((f) => ({ ...f, quorum: e.target.value as QuorumStatus }))}
            >
              {QUORUM_VALORES.map((q) => (
                <option key={q} value={q}>
                  {QUORUM_CATALOGO[q].titulo}
                </option>
              ))}
            </select>
            <QuorumHelp quorum={form.quorum} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Observações / instruções especiais</label>
            <textarea
              className="field-input min-h-[80px]"
              placeholder="Ex.: há condômino conflituoso, deliberação sensível sobre permuta..."
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line">
          {!roteiro && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleGerar(false)}
              disabled={generating}
            >
              {generating ? "Gerando..." : "✨ Gerar Roteiro com IA"}
            </button>
          )}
          {roteiro && (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleGerar(true)}
                disabled={generating}
              >
                {generating ? "Regenerando..." : "♻️ Regenerar"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.print()}
                disabled={generating}
              >
                🖨️ Imprimir / Exportar PDF
              </button>
              <button
                type="button"
                className="btn-ghost text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                onClick={handleApagar}
                disabled={generating}
              >
                🗑 Apagar
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
      </div>

      {generating && (
        <div className="no-print rounded-md border border-line bg-muted/40/40 p-6 text-center">
          <div className="inline-flex items-center gap-3 text-fg">
            <svg
              className="animate-spin h-5 w-5 text-fg"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="font-medium">Gerando roteiro com IA...</span>
          </div>
          <p className="text-xs text-muted-fg mt-2">
            Pode levar alguns segundos. O Claude está montando o texto seção por seção.
          </p>
        </div>
      )}

      {roteiro && !generating && <RoteiroView roteiro={roteiro} assembleia={assembleia} />}
    </div>
  );
}

function RoteiroView({ roteiro, assembleia }: { roteiro: Roteiro; assembleia: Assembleia }) {
  const dt = new Date(roteiro.geradoEm).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const blocks = splitSections(roteiro.roteiro);

  return (
    <article className="roteiro-doc rounded-md border border-line bg-card p-6 md:p-10 shadow-sm">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-fg">
            Roteiro — {assembleia.spe}
          </h2>
          <span className="no-print badge bg-emerald-100 text-emerald-700 dark:text-emerald-300 dark:text-emerald-300 ring-1 ring-emerald-500/30">
            ✨ Gerado em {dt}
          </span>
        </div>
        <p className="text-sm text-muted-fg mt-1">
          {assembleia.tipo} · {fmtData(assembleia.data)}
          {roteiro.formulario.presidente && ` · Presidente: ${roteiro.formulario.presidente}`}
        </p>
      </header>

      <div className="space-y-6">
        {blocks.length > 0 ? (
          blocks.map((b, i) => (
            <section key={i} className="roteiro-section">
              {b.title && (
                <h3 className="text-base font-bold text-fg mb-2 uppercase tracking-wide">
                  {b.title}
                </h3>
              )}
              <div className="text-[15px] leading-relaxed text-fg whitespace-pre-wrap">
                {b.body}
              </div>
              {i < blocks.length - 1 && <hr className="my-6 border-line" />}
            </section>
          ))
        ) : (
          <pre className="text-[15px] leading-relaxed text-fg whitespace-pre-wrap font-sans">
            {roteiro.roteiro}
          </pre>
        )}
      </div>
    </article>
  );
}

function fmtData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function splitSections(text: string): { title: string; body: string }[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const sections: { title: string; body: string }[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  const flush = () => {
    if (currentTitle || currentBody.join("").trim()) {
      sections.push({ title: currentTitle, body: currentBody.join("\n").trim() });
    }
    currentTitle = "";
    currentBody = [];
  };

  const isSep = (s: string) => /^[═━─=]{4,}\s*$/.test(s.trim());
  const isSection = (s: string) =>
    /^SE[ÇC][ÃA]O\s+\d+/i.test(s.trim()) ||
    /^\[SE[ÇC][ÃA]O\s+\d+/i.test(s.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSep(line)) continue;
    if (isSection(line)) {
      flush();
      currentTitle = line.trim();
      continue;
    }
    currentBody.push(line);
  }
  flush();
  return sections.filter((s) => s.title || s.body);
}

function QuorumHelp({ quorum }: { quorum: QuorumStatus }) {
  const info = QUORUM_CATALOGO[quorum];
  if (!info || quorum === "A verificar") return null;
  return (
    <div className="mt-2 rounded-lg border border-line bg-muted/30 p-3 text-xs">
      <p className="font-medium text-fg">{info.resumo}</p>
      {info.materias.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-muted-fg">
          {info.materias.map((m) => (
            <li key={m} className="flex gap-1.5">
              <span className="text-[#0048D7]">•</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>
      )}
      {info.baseLegal && (
        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-fg">
          Base legal: {info.baseLegal}
        </p>
      )}
    </div>
  );
}
