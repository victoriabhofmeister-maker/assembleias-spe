import { useEffect, useState } from "react";
import type { Procuracao } from "../types";
import { listProcuracoes, patchProcuracao } from "../api";
import { fmtData } from "../utils";

export function Procuracoes() {
  const [rows, setRows] = useState<Procuracao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingAcs, setEditingAcs] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listProcuracoes();
      setRows(data);
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

  const totalComProc = rows.filter((r) => r.possuiProcuracao === true).length;
  const totalSemProc = rows.filter((r) => r.possuiProcuracao === false).length;
  const totalSemDef = rows.filter((r) => r.possuiProcuracao === null).length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-800">Controle de procurações</h2>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} empreendimentos ·
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
              ✓ {totalComProc} com procuração
            </span>
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 ring-1 ring-red-200">
              ✗ {totalSemProc} sem
            </span>
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              ? {totalSemDef} indefinido
            </span>
          </p>
        </div>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>
          {loading ? "Atualizando..." : "↻ Atualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-navy-800 text-white text-left text-xs uppercase tracking-wide">
            <tr>
              <Th>SPE / Empreendimento</Th>
              <Th>Código SPE</Th>
              <Th>Responsável</Th>
              <Th>Data da Assembleia</Th>
              <Th>Pauta(s)</Th>
              <Th>Sócio</Th>
              <Th>Contato</Th>
              <Th>Sócio(s)</Th>
              <Th>📄 Contrato Social (ACS)</Th>
              <Th className="text-center">Possui Procuração?</Th>
              <Th>Observações</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-navy-800 whitespace-nowrap">
                  {p.spe}
                </td>
                <Cell
                  value={p.codigoSpe}
                  onChange={(v) => setLocal(p.id, { codigoSpe: v })}
                  onBlur={(v) => save(p.id, { codigoSpe: v })}
                  saving={savingId === p.id}
                  placeholder="—"
                  width="w-28"
                />
                <Cell
                  value={p.responsavel}
                  onChange={(v) => setLocal(p.id, { responsavel: v })}
                  onBlur={(v) => save(p.id, { responsavel: v })}
                  saving={savingId === p.id}
                  width="w-28"
                />
                <td className="px-3 py-2">
                  <input
                    type="date"
                    className="w-36 rounded border border-slate-200 px-2 py-1 text-xs"
                    value={p.dataAssembleia}
                    onChange={(e) => setLocal(p.id, { dataAssembleia: e.target.value })}
                    onBlur={(e) => save(p.id, { dataAssembleia: e.target.value })}
                  />
                  {p.dataAssembleia && (
                    <div className="text-[10px] text-slate-400">{fmtData(p.dataAssembleia)}</div>
                  )}
                </td>
                <Cell
                  value={p.pautas}
                  onChange={(v) => setLocal(p.id, { pautas: v })}
                  onBlur={(v) => save(p.id, { pautas: v })}
                  saving={savingId === p.id}
                  width="w-48"
                />
                <Cell
                  value={p.socio}
                  onChange={(v) => setLocal(p.id, { socio: v })}
                  onBlur={(v) => save(p.id, { socio: v })}
                  saving={savingId === p.id}
                  width="w-32"
                />
                <Cell
                  value={p.contato}
                  onChange={(v) => setLocal(p.id, { contato: v })}
                  onBlur={(v) => save(p.id, { contato: v })}
                  saving={savingId === p.id}
                  width="w-32"
                />
                <td className="px-2 py-1 align-top">
                  <textarea
                    rows={1}
                    placeholder="Adicionar sócio(s)..."
                    className={`w-48 resize-y min-h-[28px] rounded border border-transparent px-2 py-1 text-xs
                                hover:border-slate-200 focus:border-navy-400 focus:outline-none focus:bg-white focus:min-h-[64px]
                                ${savingId === p.id ? "opacity-60" : ""}`}
                    value={p.socios}
                    onChange={(e) => setLocal(p.id, { socios: e.target.value })}
                    onBlur={(e) => save(p.id, { socios: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1">
                  {editingAcs === p.id ? (
                    <input
                      type="url"
                      autoFocus
                      placeholder="https://..."
                      className="w-44 rounded border border-slate-300 px-2 py-1 text-xs
                                 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200"
                      value={p.linkAcs}
                      onChange={(e) => setLocal(p.id, { linkAcs: e.target.value })}
                      onBlur={(e) => {
                        save(p.id, { linkAcs: e.target.value });
                        setEditingAcs(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                      }}
                    />
                  ) : p.linkAcs ? (
                    <span className="inline-flex items-center gap-2">
                      <a
                        href={p.linkAcs}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-navy-700 hover:underline"
                      >
                        📄 Ver ACS
                      </a>
                      <button
                        type="button"
                        className="text-[10px] text-slate-400 hover:text-navy-700"
                        onClick={() => setEditingAcs(p.id)}
                        title="Editar link"
                      >
                        ✎
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-navy-700 hover:underline"
                      onClick={() => setEditingAcs(p.id)}
                    >
                      —
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <select
                    value={p.possuiProcuracao === null ? "" : p.possuiProcuracao ? "sim" : "nao"}
                    onChange={(e) => {
                      const v = e.target.value;
                      const next = v === "" ? null : v === "sim";
                      setLocal(p.id, { possuiProcuracao: next });
                      save(p.id, { possuiProcuracao: next });
                    }}
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      p.possuiProcuracao === true
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : p.possuiProcuracao === false
                          ? "border-red-300 bg-red-50 text-red-800"
                          : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <option value="">—</option>
                    <option value="sim">✓ Sim</option>
                    <option value="nao">✗ Não</option>
                  </select>
                </td>
                <Cell
                  value={p.observacoes}
                  onChange={(v) => setLocal(p.id, { observacoes: v })}
                  onBlur={(v) => save(p.id, { observacoes: v })}
                  saving={savingId === p.id}
                  width="w-56"
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Os campos são salvos automaticamente ao sair de cada célula.
      </p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-semibold ${className}`}>{children}</th>;
}

function Cell({
  value,
  onChange,
  onBlur,
  saving,
  placeholder,
  width = "w-32",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  saving: boolean;
  placeholder?: string;
  width?: string;
}) {
  return (
    <td className="px-2 py-1">
      <input
        className={`${width} rounded border border-transparent px-2 py-1 text-xs
                    hover:border-slate-200 focus:border-navy-400 focus:outline-none focus:bg-white
                    ${saving ? "opacity-60" : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
      />
    </td>
  );
}
