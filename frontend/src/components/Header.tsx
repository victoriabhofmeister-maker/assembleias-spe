import { useState } from "react";
import { useTheme } from "../theme";
import { resetSeed } from "../api";
import { useAuth } from "../auth";

export type View = "dashboard" | "form" | "solicitacoes" | "procuracoes" | "estatisticas";

interface Props {
  view: View;
  onChange: (v: View) => void;
  total: number;
  alertas: number;
  solicitacoesCount: number;
  onAfterReset: () => void;
}

const TABS: { key: View; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "estatisticas", label: "Estatísticas" },
  { key: "solicitacoes", label: "Solicitações" },
  { key: "procuracoes", label: "Procurações" },
];

export function Header({
  view,
  onChange,
  total,
  alertas,
  solicitacoesCount,
  onAfterReset,
}: Props) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [resetting, setResetting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleReset() {
    if (
      !window.confirm(
        "Resetar todos os dados ao estado inicial do seed?\n\n• 41 assembleias com checklist zerado\n• 22 procurações originais\n• Solicitações e roteiros apagados",
      )
    )
      return;
    setResetting(true);
    try {
      await resetSeed();
      onAfterReset();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
      setMenuOpen(false);
    }
  }

  return (
    <header className="app-header sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <button
          onClick={() => onChange("dashboard")}
          className="group flex items-center gap-3 outline-none"
        >
          <Logo />
          <div className="hidden sm:block text-left">
            <h1 className="text-display text-base font-semibold leading-tight text-fg">
              Seazone
            </h1>
            <p className="text-[11px] tracking-wide text-muted-fg">
              Gestão de Assembleias · SPEs
            </p>
          </div>
        </button>

        <nav className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => {
            const count =
              t.key === "dashboard"
                ? total
                : t.key === "solicitacoes"
                  ? solicitacoesCount
                  : null;
            const active = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-fg/[0.06] text-fg"
                    : "text-muted-fg hover:bg-fg/[0.04] hover:text-fg"
                }`}
              >
                {t.label}
                {count !== null && (
                  <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-fg/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                    {count}
                    {t.key === "dashboard" && alertas > 0 && (
                      <span className="text-accent" title="Alertas">
                        ⚠ {alertas}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}

          <span className="mx-1 h-5 w-px bg-border" aria-hidden />

          <button
            onClick={() => onChange("form")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === "form"
                ? "bg-accent text-accent-fg shadow-soft"
                : "bg-fg text-bg hover:opacity-95"
            }`}
          >
            + Nova
          </button>

          <button
            onClick={toggle}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            className="rounded-lg p-2 text-muted-fg transition hover:bg-fg/[0.06] hover:text-fg"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="rounded-lg p-2 text-muted-fg transition hover:bg-fg/[0.06] hover:text-fg"
              aria-label="Mais"
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-line bg-card p-1 shadow-lift animate-fade-in">
                {user && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2">
                      {user.picture && (
                        <img
                          src={user.picture}
                          alt={user.name}
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 rounded-full ring-1 ring-line"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-fg truncate">
                          {user.name}
                        </div>
                        <div className="text-[11px] text-muted-fg truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="my-1 h-px bg-line" />
                  </>
                )}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleReset}
                  disabled={resetting}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-fg transition hover:bg-muted disabled:opacity-50"
                >
                  {resetting ? "Resetando..." : "↻ Reset de demonstração"}
                </button>
                <a
                  href="/solicitar"
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg px-3 py-2 text-sm text-muted-fg transition hover:bg-muted hover:text-fg"
                >
                  ↗ Abrir página pública /solicitar
                </a>
                {user && (
                  <>
                    <div className="my-1 h-px bg-line" />
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => logout()}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-700 dark:text-rose-300 transition hover:bg-rose-500/10"
                    >
                      ⎋ Sair
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ink-900 via-ink-700 to-ink-800 text-bg shadow-soft ring-1 ring-fg/10">
      <span className="text-display text-base font-bold leading-none">S</span>
      <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />
    </span>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}
