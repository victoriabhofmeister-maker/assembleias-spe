export type View = "dashboard" | "form" | "solicitacoes" | "procuracoes";

interface Props {
  view: View;
  onChange: (v: View) => void;
  total: number;
  alertas: number;
  solicitacoesCount: number;
}

const TABS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "solicitacoes", label: "Solicitações" },
  { key: "procuracoes", label: "Procurações" },
];

export function Header({ view, onChange, total, alertas, solicitacoesCount }: Props) {
  return (
    <header className="bg-navy-800 text-white shadow-md">
      <div className="mx-auto max-w-7xl px-6 py-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-white/10 flex items-center justify-center font-bold text-lg">
            S
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Seazone — Gestão de Assembleias
            </h1>
            <p className="text-xs text-navy-200">Controle operacional de SPEs</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => {
            const count =
              t.key === "dashboard" ? total : t.key === "solicitacoes" ? solicitacoesCount : null;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === t.key ? "bg-white text-navy-800" : "text-navy-100 hover:bg-white/10"
                }`}
              >
                {t.label}
                {count !== null && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-navy-700 px-1.5 py-0.5 text-[10px]">
                    {count}
                    {t.key === "dashboard" && alertas > 0 && (
                      <span className="text-amber-300" title="Alertas">
                        ⚠ {alertas}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => onChange("form")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === "form" ? "bg-white text-navy-800" : "text-navy-100 hover:bg-white/10"
            }`}
          >
            + Nova assembleia
          </button>
        </nav>
      </div>
    </header>
  );
}
