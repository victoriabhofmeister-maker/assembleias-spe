import { useCallback, useEffect, useMemo, useState } from "react";
import { Header, type View } from "./components/Header";
import { AssembleiaForm } from "./components/AssembleiaForm";
import { Dashboard } from "./components/Dashboard";
import { AssembleiaDetail } from "./components/AssembleiaDetail";
import { Procuracoes } from "./components/Procuracoes";
import { Solicitacoes } from "./components/Solicitacoes";
import { SolicitacaoForm } from "./components/SolicitacaoForm";
import { Estatisticas } from "./components/Estatisticas";
import { listAssembleias, listSolicitacoes } from "./api";
import type { Assembleia, Solicitacao } from "./types";
import { isProximaComPendencias } from "./utils";
import { AuthProvider, LoginScreen, useAuth } from "./auth";

export default function App() {
  const isPublic = window.location.pathname.startsWith("/solicitar");
  if (isPublic) return <SolicitacaoForm />;

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { user, loading, authConfigured } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-muted-fg text-sm">
        Carregando…
      </div>
    );
  }

  // Se auth não está configurada no backend (ambiente local de demo),
  // libera direto — útil pra desenvolvimento.
  if (!authConfigured) return <InternalApp />;

  if (!user) return <LoginScreen />;
  return <InternalApp />;
}

function InternalApp() {
  const [view, setView] = useState<View>("dashboard");
  const [rows, setRows] = useState<Assembleia[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const solicitacoesCount = solicitacoes.length;
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
      setSolicitacoes(list);
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
    <div className="min-h-screen flex flex-col bg-bg text-fg">
      <Header
        view={view}
        onChange={setView}
        total={rows.length}
        alertas={alertas}
        solicitacoesCount={solicitacoesCount}
        onAfterReset={() => {
          refresh();
          refreshSolicitacoesCount();
        }}
      />

      <main className="flex-1">
        {loadError && view === "dashboard" && (
          <div className="mx-auto max-w-7xl px-6 pt-6">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              <strong>Falha ao carregar dados:</strong> {loadError}. Verifique se o backend
              está rodando em <code>http://localhost:3001</code>.
            </div>
          </div>
        )}

        {view === "dashboard" && (
          <Dashboard
            rows={rows}
            solicitacoes={solicitacoes}
            loading={loading}
            onRefresh={async () => {
              await Promise.all([refresh(), refreshSolicitacoesCount()]);
            }}
            onOpen={(a) => setOpenAssembleia(a)}
            onOpenSolicitacoes={() => setView("solicitacoes")}
          />
        )}
        {view === "estatisticas" && <Estatisticas rows={rows} />}
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

      <footer className="border-t border-line bg-muted/40 py-5 text-center text-xs text-muted-fg">
        Seazone · Gestão operacional de assembleias de SPEs · backend Express + JSON local
      </footer>
    </div>
  );
}
