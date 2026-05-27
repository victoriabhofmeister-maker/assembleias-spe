import { useCallback, useEffect, useMemo, useState } from "react";
import { Header, type View } from "./components/Header";
import { AssembleiaForm } from "./components/AssembleiaForm";
import { Dashboard } from "./components/Dashboard";
import { AssembleiaDetail } from "./components/AssembleiaDetail";
import { Procuracoes } from "./components/Procuracoes";
import { Solicitacoes } from "./components/Solicitacoes";
import { SolicitacaoForm } from "./components/SolicitacaoForm";
import { listAssembleias, listSolicitacoes } from "./api";
import type { Assembleia } from "./types";
import { isProximaComPendencias } from "./utils";

export default function App() {
  const isPublic = window.location.pathname.startsWith("/solicitar");
  if (isPublic) return <SolicitacaoForm />;

  return <InternalApp />;
}

function InternalApp() {
  const [view, setView] = useState<View>("dashboard");
  const [rows, setRows] = useState<Assembleia[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [solicitacoesCount, setSolicitacoesCount] = useState(0);
  const [openAssembleia, setOpenAssembleia] = useState<Assembleia | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listAssembleias();
      setRows(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSolicitacoesCount = useCallback(async () => {
    try {
      const list = await listSolicitacoes();
      setSolicitacoesCount(list.length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    refreshSolicitacoesCount();
  }, [refresh, refreshSolicitacoesCount]);

  useEffect(() => {
    if (view === "solicitacoes") refreshSolicitacoesCount();
  }, [view, refreshSolicitacoesCount]);

  const alertas = useMemo(() => rows.filter(isProximaComPendencias).length, [rows]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        view={view}
        onChange={setView}
        total={rows.length}
        alertas={alertas}
        solicitacoesCount={solicitacoesCount}
      />

      <main className="flex-1">
        {loadError && view === "dashboard" && (
          <div className="mx-auto max-w-7xl px-6 pt-6">
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <strong>Falha ao carregar dados:</strong> {loadError}. Verifique se o backend está
              rodando em <code>http://localhost:3001</code>.
            </div>
          </div>
        )}

        {view === "dashboard" && (
          <Dashboard
            rows={rows}
            loading={loading}
            onRefresh={refresh}
            onOpen={(a) => setOpenAssembleia(a)}
          />
        )}
        {view === "form" && (
          <AssembleiaForm
            onCreated={() => {
              refresh();
              setView("dashboard");
            }}
          />
        )}
        {view === "solicitacoes" && <Solicitacoes />}
        {view === "procuracoes" && <Procuracoes />}
      </main>

      {openAssembleia && (
        <AssembleiaDetail
          assembleia={openAssembleia}
          onClose={() => setOpenAssembleia(null)}
          onChange={(updated) => {
            setOpenAssembleia(updated);
            setRows((r) => r.map((x) => (x.id === updated.id ? updated : x)));
          }}
        />
      )}

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Seazone — Gestão de Assembleias · backend Express + dados locais em JSON
      </footer>
    </div>
  );
}
