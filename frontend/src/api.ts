import type {
  Assembleia,
  AssembleiaInput,
  ChecklistStatus,
  Procuracao,
  Roteiro,
  RoteiroFormulario,
  Solicitacao,
} from "./types";

const BASE = "/api";

export async function listAssembleias(): Promise<Assembleia[]> {
  const res = await fetch(`${BASE}/assembleias`);
  if (!res.ok) throw new Error(`GET falhou: ${res.status}`);
  return res.json();
}

export interface CreateAssembleiaResult {
  assembleia: Assembleia;
  slack: { ok: boolean; error?: string };
}

export async function createAssembleia(input: AssembleiaInput): Promise<CreateAssembleiaResult> {
  const res = await fetch(`${BASE}/assembleias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `POST falhou: ${res.status}`);
  return body as CreateAssembleiaResult;
}

export async function updateChecklist(
  id: string,
  index: number,
  status: ChecklistStatus,
): Promise<Assembleia> {
  const res = await fetch(`${BASE}/assembleias/${id}/checklist/${index}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `PATCH falhou: ${res.status}`);
  return body as Assembleia;
}

export async function listSolicitacoes(): Promise<Solicitacao[]> {
  const res = await fetch(`${BASE}/solicitacoes`);
  if (!res.ok) throw new Error(`GET falhou: ${res.status}`);
  return res.json();
}

export interface CreateSolicitacaoResult {
  solicitacao: Solicitacao;
  slack: { ok: boolean; error?: string };
}

export async function createSolicitacao(form: FormData): Promise<CreateSolicitacaoResult> {
  const res = await fetch(`${BASE}/solicitacoes`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `POST falhou: ${res.status}`);
  return body as CreateSolicitacaoResult;
}

export async function listProcuracoes(): Promise<Procuracao[]> {
  const res = await fetch(`${BASE}/procuracoes`);
  if (!res.ok) throw new Error(`GET falhou: ${res.status}`);
  return res.json();
}

export async function patchProcuracao(
  id: string,
  patch: Partial<Procuracao>,
): Promise<Procuracao> {
  const res = await fetch(`${BASE}/procuracoes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `PATCH falhou: ${res.status}`);
  return body as Procuracao;
}

export async function getRoteiro(assembleiaId: string): Promise<Roteiro | null> {
  const res = await fetch(`${BASE}/assembleias/${assembleiaId}/roteiro`);
  if (!res.ok) throw new Error(`GET roteiro falhou: ${res.status}`);
  return res.json();
}

export async function gerarRoteiro(
  assembleiaId: string,
  form: RoteiroFormulario,
): Promise<Roteiro> {
  const res = await fetch(`${BASE}/assembleias/${assembleiaId}/roteiro/gerar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Geração falhou: ${res.status}`);
  return body as Roteiro;
}

export async function deleteRoteiro(assembleiaId: string): Promise<void> {
  const res = await fetch(`${BASE}/assembleias/${assembleiaId}/roteiro`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`DELETE roteiro falhou: ${res.status}`);
}
