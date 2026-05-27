import { useEffect, useState } from "react";
import type { Assembleia, Relatorio } from "../types";
import { deleteRelatorio, gerarRelatorio, getRelatorio } from "../api";

interface Props {
  assembleia: Assembleia;
}

export function AtaPanel({ assembleia }: Props) {
  const [transcricao, setTranscricao] = useState("");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getRelatorio(assembleia.id)
      .then((r) => {
        if (cancelled) return;
        setRelatorio(r);
        if (r) setTranscricao(r.transcricao);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [assembleia.id]);

  async function handleGerar(force = false) {
    if (force && !window.confirm("Sobrescrever o relatório existente?")) return;
    if (transcricao.trim().length < 50) {
      setError("Cole a transcrição da assembleia (mínimo 50 caracteres).");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const r = await gerarRelatorio(assembleia.id, transcricao);
      setRelatorio(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /ANTHROPIC_API_KEY/i.test(msg)
          ? "Não foi possível gerar o relatório. Verifique se a ANTHROPIC_API_KEY está configurada no .env do backend."
          : msg,
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleApagar() {
    if (!window.confirm("Apagar o relatório gerado? Esta ação não pode ser desfeita.")) return;
    try {
      await deleteRelatorio(assembleia.id);
      setRelatorio(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-fg">Carregando…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="no-print rounded-lg border border-line bg-card p-4 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-fg uppercase tracking-wide">
            Transcrição da assembleia
          </h4>
          <p className="text-xs text-muted-fg mt-0.5">
            Cole aqui a transcrição completa (do Zoom/Meet/Otter/manual). A IA gera o
            relatório estruturado com decisões, próximos passos e pontos de atenção.
          </p>
        </div>

        <textarea
          className="field-input min-h-[200px] font-mono text-xs"
          placeholder="Cole a transcrição da assembleia aqui — quanto mais completa, melhor o relatório…"
          value={transcricao}
          onChange={(e) => setTranscricao(e.target.value)}
        />
        <div className="text-[11px] text-muted-fg">
          {transcricao.length.toLocaleString("pt-BR")} caracteres ·{" "}
          {transcricao.trim() ? transcricao.trim().split(/\s+/).length : 0} palavras
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line">
          {!relatorio && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleGerar(false)}
              disabled={generating}
            >
              {generating ? "Gerando..." : "✨ Gerar relatório com IA"}
            </button>
          )}
          {relatorio && (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleGerar(true)}
                disabled={generating}
              >
                {generating ? "Regenerando..." : "♻️ Regenerar relatório"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => window.print()}
                disabled={generating}
              >
                🖨️ Imprimir / PDF
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
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
      </div>

      {generating && (
        <div className="no-print rounded-lg border border-[#0048D7]/30 bg-[#0048D7]/[0.06] p-6 text-center">
          <div className="inline-flex items-center gap-3 text-[#0048D7]">
            <svg
              className="animate-spin h-5 w-5"
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
            <span className="font-medium">Gerando relatório com IA…</span>
          </div>
          <p className="text-xs text-muted-fg mt-2">
            O Claude está estruturando o relatório (resumo, deliberações, próximos passos…).
          </p>
        </div>
      )}

      {relatorio && !generating && (
        <RelatorioView relatorio={relatorio} assembleia={assembleia} />
      )}
    </div>
  );
}

function RelatorioView({ relatorio, assembleia }: { relatorio: Relatorio; assembleia: Assembleia }) {
  const dt = new Date(relatorio.geradoEm).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  return (
    <article className="roteiro-doc rounded-lg border border-line bg-card p-6 md:p-10 shadow-sm">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-display text-lg font-bold text-fg">
            Relatório de ata — {assembleia.spe}
          </h2>
          <span className="no-print badge bg-[#2FB864]/15 text-[#2FB864] ring-1 ring-[#2FB864]/30">
            ✨ Gerado em {dt}
          </span>
        </div>
        <p className="text-sm text-muted-fg mt-1">
          {assembleia.tipo} · {assembleia.data || "—"} · Responsável: {assembleia.responsavel || "—"}
        </p>
      </header>
      <pre className="text-[15px] leading-relaxed text-fg whitespace-pre-wrap font-sans">
        {relatorio.relatorio}
      </pre>
    </article>
  );
}
