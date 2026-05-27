import { useEffect, useState } from "react";
import type { DocumentoUpload, Indicacao, Solicitacao } from "../types";
import { ORDEM_LABEL_COMPLETO } from "../types";
import { listSolicitacoes } from "../api";
import { fmtData, formatBytes } from "../utils";

export function Solicitacoes() {
  const [rows, setRows] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSolicitacoes());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Solicitações recebidas</h2>
          <p className="mt-1 text-sm text-muted-fg">
            {rows.length} solicitação(ões) registrada(s).{" "}
            <span className="text-muted-fg">
              Link público:&nbsp;
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-fg">
                /solicitar
              </code>
            </span>
          </p>
        </div>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>
          {loading ? "Atualizando..." : "↻ Atualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-12 text-center text-sm text-muted-fg">
          Nenhuma solicitação recebida ainda.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => (
            <SolicitacaoCard
              key={s.id}
              s={s}
              expanded={expanded.has(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SolicitacaoCard({
  s,
  expanded,
  onToggle,
}: {
  s: Solicitacao;
  expanded: boolean;
  onToggle: () => void;
}) {
  const indicacoesDestaque = (s.indicacoes ?? []).filter((i) =>
    /Eleição do Conselho Fiscal|Reeleição do Conselho Fiscal/.test(i.ordemDoDia),
  );

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="badge bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/30">
              📨 {s.status}
            </span>
            <span className="badge bg-fg/10 text-fg ring-1 ring-line">{s.tipo}</span>
            <span className="badge bg-muted text-fg ring-1 ring-line">
              {s.departamentoSolicitante}
            </span>
            <span className="badge bg-muted/40 text-muted-fg ring-1 ring-line">
              📎 {s.documentos.length}
            </span>
          </div>
          <h3 className="text-base font-semibold text-fg">{s.spe}</h3>
          <p className="text-xs text-muted-fg">
            Solicitado por <strong>{s.nomeSolicitante}</strong> · Data pretendida{" "}
            {fmtData(s.dataPretendida)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-fg/70 text-right">
            {new Date(s.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </div>
          <button onClick={onToggle} className="btn-ghost text-xs">
            {expanded ? "Recolher" : "Expandir"}
          </button>
        </div>
      </div>

      {indicacoesDestaque.length > 0 && (
        <div className="mt-3 rounded-md border-l-4 border-emerald-500 bg-emerald-500/10 px-3 py-2">
          {indicacoesDestaque.map((i, idx) => (
            <p key={idx} className="text-sm text-emerald-900 dark:text-emerald-200">
              <strong>{i.campo}:</strong>{" "}
              <span className="font-semibold">{i.valor}</span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 ml-2">— {i.ordemDoDia}</span>
            </p>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 border-t border-line pt-4 space-y-4">
          {s.ordensDoDia.length === 0 ? (
            <p className="text-sm text-muted-fg italic">Nenhuma pauta marcada.</p>
          ) : (
            s.ordensDoDia.map((ordem) => (
              <PautaSection
                key={ordem}
                ordem={ordem}
                solicitacaoId={s.id}
                outraOrdemDescricao={s.outraOrdemDescricao}
                documentos={s.documentos.filter((d) => d.ordemDoDia === ordem)}
                indicacoes={(s.indicacoes ?? []).filter((i) => i.ordemDoDia === ordem)}
              />
            ))
          )}

          {s.observacoes && (
            <div className="border-t border-line pt-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-fg font-semibold mb-1">
                Observações
              </div>
              <p className="text-sm text-fg whitespace-pre-wrap">{s.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function PautaSection({
  ordem,
  solicitacaoId,
  outraOrdemDescricao,
  documentos,
  indicacoes,
}: {
  ordem: string;
  solicitacaoId: string;
  outraOrdemDescricao: string;
  documentos: DocumentoUpload[];
  indicacoes: Indicacao[];
}) {
  const titulo = ORDEM_LABEL_COMPLETO[ordem] ?? ordem;

  return (
    <div className="rounded-md bg-muted/40 border border-line p-3">
      <h4 className="text-sm font-semibold text-fg mb-2">{titulo}</h4>

      {ordem === "Outro (especificar)" && outraOrdemDescricao && (
        <p className="text-xs text-fg mb-2">
          <strong>Descrição:</strong> {outraOrdemDescricao}
        </p>
      )}

      {indicacoes.length > 0 && (
        <ul className="text-xs text-fg mb-2 space-y-0.5">
          {indicacoes.map((i, idx) => (
            <li key={idx}>
              <strong>{i.campo}:</strong> {i.valor}
            </li>
          ))}
        </ul>
      )}

      {documentos.length === 0 ? (
        <p className="text-xs text-muted-fg italic">Sem documentos anexados nesta pauta.</p>
      ) : (
        <ul className="text-xs text-fg space-y-1">
          {documentos.map((d) => (
            <li key={d.filename} className="flex items-center gap-2">
              <span aria-hidden>📎</span>
              <span className="text-muted-fg">{d.nomeDocumento}:</span>
              <a
                href={`/api/solicitacoes/${solicitacaoId}/docs/${d.filename}`}
                target="_blank"
                rel="noreferrer"
                className="text-fg hover:underline truncate"
                title={d.originalName}
              >
                {d.originalName}
              </a>
              <span className="text-muted-fg/70">({formatBytes(d.size)})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
