import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "seazone_session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function googleClientId(): string {
  const id = getEnv("GOOGLE_CLIENT_ID");
  if (!id) throw new Error("GOOGLE_CLIENT_ID não configurado");
  return id;
}

function sessionSecret(): string {
  const s = getEnv("SESSION_SECRET");
  if (!s) throw new Error("SESSION_SECRET não configurado");
  return s;
}

function allowedDomains(): string[] {
  const raw = getEnv("ALLOWED_DOMAINS") ?? "";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function allowedEmails(): string[] {
  const raw = getEnv("ALLOWED_EMAILS") ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isEmailAllowed(email: string): boolean {
  const e = email.toLowerCase();
  const domains = allowedDomains();
  const emails = allowedEmails();
  if (domains.length === 0 && emails.length === 0) {
    // sem restrição configurada → libera qualquer email Google verificado
    return true;
  }
  if (emails.includes(e)) return true;
  for (const d of domains) {
    if (e.endsWith("@" + d)) return true;
  }
  return false;
}

let _client: OAuth2Client | null = null;
function client(): OAuth2Client {
  if (!_client) _client = new OAuth2Client(googleClientId());
  return _client;
}

export async function verifyGoogleCredential(
  credential: string,
): Promise<SessionUser> {
  const ticket = await client().verifyIdToken({
    idToken: credential,
    audience: googleClientId(),
  });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Token Google sem payload");
  if (!payload.email || !payload.email_verified) {
    throw new Error("Email não verificado pelo Google");
  }
  if (!isEmailAllowed(payload.email)) {
    throw new Error(`Email não autorizado: ${payload.email}`);
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}

export function issueSessionCookie(res: Response, user: SessionUser): void {
  const token = jwt.sign(user, sessionSecret(), {
    expiresIn: "7d",
    audience: "seazone",
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function readSession(req: Request): SessionUser | null {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    COOKIE_NAME
  ];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, sessionSecret(), {
      audience: "seazone",
    }) as SessionUser & jwt.JwtPayload;
    return {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = readSession(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  (req as Request & { user?: SessionUser }).user = user;
  next();
}

export function isAuthConfigured(): boolean {
  return Boolean(getEnv("GOOGLE_CLIENT_ID") && getEnv("SESSION_SECRET"));
}
