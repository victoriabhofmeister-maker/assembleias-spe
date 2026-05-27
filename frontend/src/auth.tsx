import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  authConfigured: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { user: AuthUser | null; authConfigured: boolean };
      setUser(body.user);
      setAuthConfigured(body.authConfigured);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loginWithGoogle = useCallback(async (credential: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? `Falha ao autenticar (${res.status})`);
      }
      setUser(body.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, authConfigured, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function LoginScreen() {
  const { loginWithGoogle, error, loading } = useAuth();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-md surface p-8 md:p-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ink-900 via-ink-700 to-ink-800 text-bg shadow-soft ring-1 ring-fg/10">
            <span className="text-display text-base font-bold leading-none">S</span>
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-bg" />
          </span>
          <div>
            <p className="text-eyebrow">Seazone · interno</p>
            <h1 className="text-display text-xl font-semibold leading-tight">
              Gestão de Assembleias
            </h1>
          </div>
        </div>

        <p className="text-sm text-fg/80 mb-8">
          Acesso restrito ao time da Seazone. Entre com sua conta corporativa do Google
          para continuar.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            <strong>Não foi possível entrar:</strong> {error}
          </div>
        )}

        {!clientId ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-800 dark:text-amber-300">
            <strong>VITE_GOOGLE_CLIENT_ID não configurado no frontend.</strong>
            <p className="mt-1 text-xs opacity-90">
              Defina no <code>frontend/.env</code> e rode <code>npm run build</code> de novo.
            </p>
          </div>
        ) : (
          <GoogleOAuthProvider clientId={clientId}>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={(cred) => {
                  if (cred.credential) {
                    loginWithGoogle(cred.credential).catch(() => {
                      /* já tratado em context */
                    });
                  }
                }}
                onError={() => {
                  // efêmero, o Google em si falhou
                  console.error("Google login error");
                }}
                useOneTap={false}
                size="large"
                text="signin_with"
                shape="rectangular"
                locale="pt-BR"
              />
            </div>
          </GoogleOAuthProvider>
        )}

        {loading && (
          <p className="mt-4 text-center text-xs text-muted-fg">Verificando sessão…</p>
        )}

        <div className="mt-8 border-t border-line pt-4 text-center text-xs text-muted-fg">
          Não é do time? Use o{" "}
          <a href="/solicitar" className="underline hover:text-accent">
            formulário público de solicitação
          </a>
          .
        </div>
      </div>
    </div>
  );
}
