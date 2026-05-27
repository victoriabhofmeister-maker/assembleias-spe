import { useEffect, useState } from "react";
import type { Procuracao, SocioProcuracao } from "../types";
import { listProcuracoes, patchProcuracao } from "../api";

export function Procuracoes() {
  const [rows, setRows] = useState<Procuracao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listProcuracoes());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function save(id: string, patch: Partial<Procuracao>) {
    setSavingId(id);
    try {
      const updated = await patchProcuracao(id, patch);
      setRows((r) => r.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  function setLocal(id: string, patch: Partial<Procuracao>) {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSocio(p: Procuracao) {
    const novo: SocioProcuracao = {
      nome: "",
      percentualCapital: 0,
      temProcuracaoValida: false,
      outorgado: "",
    };
    const socios = [...p.socios, novo];
    setLocal(p.id, { socios });
    save(p.id, { socios });
  }

  function updateSocio(p: Procuracao, idx: number, patch: Partial<SocioProcuracao>) {
    const socios = p.socios.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    setLocal(p.id, { socios });
  }

  function commitSocios(p: Procuracao) {
    save(p.id, { socios: p.socios });
  }

  function removeSocio(p: Procuracao, idx: number) {
    const socios = p.socios.filter((_, i) => i !== idx);
    setLocal(p.id, { socios });
    save(p.id, { socios });
  }

  const totalComProc = rows.filter((r) => r.possuiProcuracao === true).length;
  const totalSemProc = rows.filter((r) => r.possuiProcuracao === false).length;
  const totalSemDef = rows.filter((r) => r.possuiProcuracao === null).length;
  const totalSocios = rows.reduce((acc, r) => acc + r.socios.length, 0);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 animate-fade-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Compliance · controle societário</p>
          <h2 className="text-display mt-1 text-3xl font-bold">Procurações</h2>
          <p className="mt-2 text-sm text-muted-fg">
            {rows.length} empreendimentos · {totalSocios} sócio(s) cadastrado(s) ·{" "}
            <span className="text-success font-medium">✓ {totalComProc} com procuração</span> ·{" "}
            <span className="text-coral font-medium">✗ {totalSemProc} sem</span> ·{" "}
            <span className="text-muted-fg">? {totalSemDef} indefinido</span>
          </p>
        </div>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>
          {loading ? "Atualizando..." : "↻ Atualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((p) => {
          const isExpanded = expanded.has(p.id);
          const totalPct = p.socios.reduce((acc, s) => acc + (s.percentualCapital || 0), 0);
          return (
            <article
              key={p.id}
              className={`surface overflow-hidden transition ${
                savingId === p.id ? "opacity-70" : ""
              }`}
            >
              <header className="flex flex-wrap items-center gap-3 p-4">
                <button
                  onClick={() => toggleExpanded(p.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <span
                    className={`text-xs text-muted-fg transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  >
                    ▶
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-display text-base font-semibold text-fg">
                        {p.spe}
                      </h3>
                      {p.codigoSpe && (
                        <span className="chip chip-navy text-[10px] py-0.5 px-1.5">
                          {p.codigoSpe}
                        </span>
                      )}
                      {p.responsavel && (
                        <span className="chip text-[10px] py-0.5 px-1.5">
                          👤 {p.responsavel}
                        </span>
                      )}
                      {p.socios.length > 0 && (
                        <span className="chip text-[10px] py-0.5 px-1.5">
                          {p.socios.length} sócio{p.socios.length > 1 ? "s" : ""}
                          {Math.abs(totalPct - 100) < 0.01 && " · 100%"}
                          {totalPct > 0 && Math.abs(totalPct - 100) >= 0.01 && ` · ${totalPct.toFixed(0)}%`}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <ProcSelector
                  value={p.possuiProcuracao}
                  onChange={(v) => {
                    setLocal(p.id, { possuiProcuracao: v });
                    save(p.id, { possuiProcuracao: v });
                  }}
                />

                {p.linkAcs ? (
                  <a
                    href={p.linkAcs}
                    target="_blank"
                    rel="noreferrer"
                    className="chip chip-blue text-[11px]"
                  >
                    📄 Ver ACS
                  </a>
                ) : (
                  <span className="chip text-[11px] text-muted-fg">📄 sem ACS</span>
                )}
              </header>

              {isExpanded && (
                <div className="border-t border-line bg-muted/30 p-4 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="field-label">Código SPE</label>
                      <input
                        className="field-input"
                        value={p.codigoSpe}
                        onChange={(e) => setLocal(p.id, { codigoSpe: e.target.value })}
                        onBlur={(e) => save(p.id, { codigoSpe: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label">Responsável</label>
                      <input
                        className="field-input"
                        value={p.responsavel}
                        onChange={(e) => setLocal(p.id, { responsavel: e.target.value })}
                        onBlur={(e) => save(p.id, { responsavel: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label">Contato</label>
                      <input
                        className="field-input"
                        value={p.contato}
                        onChange={(e) => setLocal(p.id, { contato: e.target.value })}
                        onBlur={(e) => save(p.id, { contato: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="field-label">Link Contrato Social (ACS)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        className="field-input"
                        value={p.linkAcs}
                        onChange={(e) => setLocal(p.id, { linkAcs: e.target.value })}
                        onBlur={(e) => save(p.id, { linkAcs: e.target.value })}
                      />
                    </div>
                  </div>

                  <SociosTable
                    socios={p.socios}
                    onChange={(idx, patch) => updateSocio(p, idx, patch)}
                    onCommit={() => commitSocios(p)}
                    onAdd={() => addSocio(p)}
                    onRemove={(idx) => removeSocio(p, idx)}
                  />

                  <div>
                    <label className="field-label">Observações</label>
                    <textarea
                      className="field-input min-h-[60px]"
                      value={p.observacoes}
                      onChange={(e) => setLocal(p.id, { observacoes: e.target.value })}
                      onBlur={(e) => save(p.id, { observacoes: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-fg">
        Edições salvam automaticamente ao sair do campo. Clique no nome do empreendimento pra
        expandir.
      </p>
    </div>
  );
}

function ProcSelector({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <select
      value={value === null ? "" : value ? "sim" : "nao"}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : v === "sim");
      }}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
        value === true
          ? "border-success/40 bg-success/10 text-success"
          : value === false
            ? "border-coral/40 bg-coral/10 text-coral"
            : "border-line bg-card text-muted-fg"
      }`}
    >
      <option value="">— procuração?</option>
      <option value="sim">✓ Possui procuração</option>
      <option value="nao">✗ Sem procuração</option>
    </select>
  );
}

function SociosTable({
  socios,
  onChange,
  onCommit,
  onAdd,
  onRemove,
}: {
  socios: SocioProcuracao[];
  onChange: (idx: number, patch: Partial<SocioProcuracao>) => void;
  onCommit: () => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-eyebrow">Sócios</h4>
        <button onClick={onAdd} className="btn-soft text-xs">
          + Adicionar sócio
        </button>
      </div>

      {socios.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-card/50 px-4 py-6 text-center text-xs text-muted-fg">
          Nenhum sócio cadastrado. Clique em "Adicionar sócio" pra começar.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-wider text-muted-fg">
              <tr>
                <th className="px-3 py-2 font-semibold">Nome do sócio</th>
                <th className="px-3 py-2 font-semibold w-24">% Capital</th>
                <th className="px-3 py-2 font-semibold w-32 text-center">
                  Procuração válida?
                </th>
                <th className="px-3 py-2 font-semibold">Outorgado</th>
                <th className="px-1 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {socios.map((s, idx) => (
                <tr key={idx} className="hover:bg-muted/30">
                  <td className="px-2 py-1">
                    <input
                      className="w-full rounded-md border border-transparent px-2 py-1 text-sm hover:border-line focus:border-accent focus:bg-bg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="Nome completo"
                      value={s.nome}
                      onChange={(e) => onChange(idx, { nome: e.target.value })}
                      onBlur={onCommit}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      className="w-20 rounded-md border border-transparent px-2 py-1 text-sm tabular-nums hover:border-line focus:border-accent focus:bg-bg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="0"
                      value={s.percentualCapital}
                      onChange={(e) =>
                        onChange(idx, {
                          percentualCapital: Number(e.target.value) || 0,
                        })
                      }
                      onBlur={onCommit}
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={s.temProcuracaoValida}
                      onChange={(e) => {
                        onChange(idx, { temProcuracaoValida: e.target.checked });
                        setTimeout(onCommit, 0);
                      }}
                      className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      className="w-full rounded-md border border-transparent px-2 py-1 text-sm hover:border-line focus:border-accent focus:bg-bg focus:outline-none focus:ring-2 focus:ring-accent/20"
                      placeholder="Nome do outorgado"
                      value={s.outorgado}
                      onChange={(e) => onChange(idx, { outorgado: e.target.value })}
                      onBlur={onCommit}
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => onRemove(idx)}
                      className="rounded p-1 text-muted-fg transition hover:bg-coral/10 hover:text-coral"
                      title="Remover sócio"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
