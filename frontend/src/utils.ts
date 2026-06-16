import type { Assembleia, ChecklistStatus, Criticidade } from "./types";
import { temEdital } from "./types";

export function fmtData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function diasAte(iso: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const alvo = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function pendencias(a: Assembleia): string[] {
  const list: string[] = [];
  if (!a.editalEnviado) {
    list.push(temEdital(a.tipo) ? "edital não enviado" : "participação não confirmada");
  }
  if (!a.responsavel.trim()) list.push("sem responsável");
  if (!a.apresentacao.trim() || a.apresentacao.trim().toLowerCase() === "não")
    list.push("apresentação não confirmada");
  return list;
}

export function isProximaComPendencias(a: Assembleia): boolean {
  const d = diasAte(a.data);
  if (d === null) return false;
  if (d < 0 || d > 7) return false;
  return pendencias(a).length > 0;
}

export function isRealizada(a: Assembleia): boolean {
  // Etapa salva (via drag) é a fonte de verdade quando presente.
  if (a.etapa) return a.etapa === "realizada";
  if (!a.data) return false;
  const d = diasAte(a.data);
  return d !== null && d < 0;
}

// SLA: data-limite = createdAt + slaDays dias corridos. Atrasado = hoje > limite
// e a etapa ainda não está concluída.
export function slaInfo(
  a: Assembleia,
  item: { slaDays?: number; status: ChecklistStatus },
): { dueLabel: string; overdue: boolean; dueISO: string } | null {
  if (typeof item.slaDays !== "number" || !a.createdAt) return null;
  const base = new Date(a.createdAt);
  if (isNaN(base.getTime())) return null;
  const due = new Date(base);
  due.setDate(due.getDate() + item.slaDays);
  due.setHours(23, 59, 59, 999);
  const concluido = item.status === "Concluído";
  const overdue = !concluido && Date.now() > due.getTime();
  const dd = String(due.getDate()).padStart(2, "0");
  const mm = String(due.getMonth() + 1).padStart(2, "0");
  return {
    dueLabel: `${dd}/${mm}`,
    overdue,
    dueISO: `${due.getFullYear()}-${mm}-${dd}`,
  };
}

// Há alguma etapa pré-assembleia com SLA vencido e não concluída?
export function temSlaAtrasado(a: Assembleia): boolean {
  return (a.checklist ?? []).some((c) => slaInfo(a, c)?.overdue);
}

export function progressoChecklist(a: Assembleia): { done: number; total: number; pct: number } {
  const total = a.checklist?.length ?? 0;
  const done = a.checklist?.filter((c) => c.status === "Concluído").length ?? 0;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export const CRITICIDADE_EMOJI: Record<Criticidade, string> = {
  Alto: "🔴",
  Medio: "🟡",
  Baixo: "🟢",
};

export const CRITICIDADE_BADGE: Record<Criticidade, string> = {
  Alto: "bg-red-100 text-red-800 ring-1 ring-red-200",
  Medio: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  Baixo: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
};

export const STATUS_BADGE: Record<ChecklistStatus, string> = {
  "A fazer": "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  "Em andamento": "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  Concluído: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
};

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
