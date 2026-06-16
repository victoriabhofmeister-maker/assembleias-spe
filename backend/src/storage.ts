import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  CHECKLIST_LEGACY_TITLES,
  CHECKLIST_POS_TEMPLATE,
  CHECKLIST_TEMPLATE,
  PROCURACOES_INICIAIS,
  SPES_DISPONIVEIS,
  type Assembleia,
  type ChecklistItem,
  type Procuracao,
  type Relatorio,
  type Roteiro,
  type Solicitacao,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const ASSEMBLEIAS_FILE = path.join(DATA_DIR, "assembleias.json");
const SOLICITACOES_FILE = path.join(DATA_DIR, "solicitacoes.json");
const PROCURACOES_FILE = path.join(DATA_DIR, "procuracoes.json");
const ROTEIROS_FILE = path.join(DATA_DIR, "roteiros.json");
const RELATORIOS_FILE = path.join(DATA_DIR, "relatorios.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Marcador (no disco persistente) da versão do snapshot de assembleias já aplicado.
const SEED_MARKER_FILE = path.join(DATA_DIR, ".assembleias-seed-version");
// Bumpar sempre que `seed-assembleias.json` for regerado da planilha de cronograma.
// No boot, se a versão no disco diferir, as assembleias são recarregadas do seed
// SEM apagar procurações/solicitações/roteiros/uploads (diferente de resetData).
export const ASSEMBLEIAS_SEED_VERSION = "2026-06-16-cronograma-v2";

async function ensureFile(file: string, initial: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, initial, "utf8");
  }
}

async function readJson<T>(file: string): Promise<T[]> {
  await ensureFile(file, "[]");
  const raw = await fs.readFile(file, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJson<T>(file: string, rows: T[]): Promise<void> {
  await ensureFile(file, "[]");
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

function migrateChecklist(checklist: ChecklistItem[] | undefined): {
  next: ChecklistItem[];
  changed: boolean;
} {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return { next: CHECKLIST_TEMPLATE.map((c) => ({ ...c })), changed: true };
  }
  // Remove etapas legadas preservando os demais status
  const filtered = checklist.filter((c) => !CHECKLIST_LEGACY_TITLES.has(c.titulo));
  const byTitulo = new Map(filtered.map((c) => [c.titulo, c] as const));
  // Sincroniza com o template atual (pode ter sido expandido)
  let needsRewrite = filtered.length !== checklist.length;
  const next = CHECKLIST_TEMPLATE.map((tpl) => {
    const existing = byTitulo.get(tpl.titulo);
    if (!existing) needsRewrite = true; // etapa nova adicionada ao template
    return existing ? { ...tpl, status: existing.status } : { ...tpl };
  });
  if (filtered.length !== CHECKLIST_TEMPLATE.length) needsRewrite = true;
  if (needsRewrite) return { next, changed: true };
  return { next: checklist, changed: false };
}

function migrateChecklistPos(checklist: ChecklistItem[] | undefined): {
  next: ChecklistItem[];
  changed: boolean;
} {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return { next: CHECKLIST_POS_TEMPLATE.map((c) => ({ ...c })), changed: true };
  }
  const byTitulo = new Map(checklist.map((c) => [c.titulo, c] as const));
  let needsRewrite = false;
  const next = CHECKLIST_POS_TEMPLATE.map((tpl) => {
    const existing = byTitulo.get(tpl.titulo);
    if (!existing) needsRewrite = true;
    return existing ? { ...tpl, status: existing.status } : { ...tpl };
  });
  if (checklist.length !== CHECKLIST_POS_TEMPLATE.length) needsRewrite = true;
  if (needsRewrite) return { next, changed: true };
  return { next: checklist, changed: false };
}

export async function readAssembleias(): Promise<Assembleia[]> {
  const rows = await readJson<Assembleia>(ASSEMBLEIAS_FILE);
  let mutated = false;
  for (const a of rows) {
    const pre = migrateChecklist(a.checklist);
    if (pre.changed) {
      a.checklist = pre.next;
      mutated = true;
    }
    const pos = migrateChecklistPos(a.checklistPos);
    if (pos.changed) {
      a.checklistPos = pos.next;
      mutated = true;
    }
    // Backfill de campos adicionados depois (linhas antigas no disco persistente).
    for (const k of ["linkEdital", "situacao", "observacoes"] as const) {
      if (typeof (a as Partial<Assembleia>)[k] !== "string") {
        (a as Record<string, unknown>)[k] = "";
        mutated = true;
      }
    }
  }
  if (mutated) await writeJson(ASSEMBLEIAS_FILE, rows);
  return rows;
}

export async function writeAssembleias(rows: Assembleia[]): Promise<void> {
  await writeJson(ASSEMBLEIAS_FILE, rows);
}

export async function appendAssembleia(row: Assembleia): Promise<void> {
  const rows = await readAssembleias();
  rows.push(row);
  await writeAssembleias(rows);
}

export async function updateAssembleia(
  id: string,
  patch: (a: Assembleia) => Assembleia,
): Promise<Assembleia | null> {
  const rows = await readAssembleias();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = patch(rows[idx]);
  await writeAssembleias(rows);
  return rows[idx];
}

export async function readSolicitacoes(): Promise<Solicitacao[]> {
  const rows = await readJson<Solicitacao>(SOLICITACOES_FILE);
  let mutated = false;
  for (const r of rows) {
    if (!Array.isArray((r as Partial<Solicitacao>).indicacoes)) {
      (r as Solicitacao).indicacoes = [];
      mutated = true;
    }
  }
  if (mutated) await writeJson(SOLICITACOES_FILE, rows);
  return rows;
}

export async function appendSolicitacao(row: Solicitacao): Promise<void> {
  const rows = await readSolicitacoes();
  rows.push(row);
  await writeJson(SOLICITACOES_FILE, rows);
}

type LegacyProcuracao = Partial<Procuracao> & {
  dataAssembleia?: string;
  pautas?: string;
  socio?: string;
  socios?: unknown;
};

function normalizeSocios(raw: unknown): Procuracao["socios"] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (x): x is { nome?: unknown; percentualCapital?: unknown; temProcuracaoValida?: unknown; outorgado?: unknown } =>
          x !== null && typeof x === "object",
      )
      .map((x) => ({
        nome: typeof x.nome === "string" ? x.nome : "",
        percentualCapital:
          typeof x.percentualCapital === "number"
            ? x.percentualCapital
            : Number(x.percentualCapital) || 0,
        temProcuracaoValida: Boolean(x.temProcuracaoValida),
        outorgado: typeof x.outorgado === "string" ? x.outorgado : "",
      }));
  }
  if (typeof raw === "string" && raw.trim()) {
    // legado: campo socios era textarea livre → quebra por linha/separador
    const parts = raw
      .split(/[\n;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.map((nome) => ({
      nome,
      percentualCapital: 0,
      temProcuracaoValida: false,
      outorgado: "",
    }));
  }
  return [];
}

export async function readProcuracoes(): Promise<Procuracao[]> {
  await ensureFile(PROCURACOES_FILE, "[]");
  const legacy = await readJson<LegacyProcuracao>(PROCURACOES_FILE);

  if (legacy.length === 0) {
    const rows: Procuracao[] = SPES_DISPONIVEIS.map((spe) => {
      const seed = PROCURACOES_INICIAIS.find((p) => p.spe === spe);
      return {
        id: randomUUID(),
        spe,
        codigoSpe: seed?.codigoSpe ?? "",
        responsavel: seed?.responsavel ?? "",
        contato: "",
        linkAcs: "",
        socios: [],
        possuiProcuracao: null,
        observacoes: "",
      };
    });
    await writeJson(PROCURACOES_FILE, rows);
    return rows;
  }

  let mutated = false;
  const rows: Procuracao[] = legacy.map((row) => {
    const before = JSON.stringify(row);
    const normalized: Procuracao = {
      id: typeof row.id === "string" ? row.id : randomUUID(),
      spe: typeof row.spe === "string" ? row.spe : "",
      codigoSpe: typeof row.codigoSpe === "string" ? row.codigoSpe : "",
      responsavel: typeof row.responsavel === "string" ? row.responsavel : "",
      contato: typeof row.contato === "string" ? row.contato : "",
      linkAcs: typeof row.linkAcs === "string" ? row.linkAcs : "",
      socios: normalizeSocios(row.socios),
      possuiProcuracao:
        row.possuiProcuracao === true || row.possuiProcuracao === false
          ? row.possuiProcuracao
          : null,
      observacoes: typeof row.observacoes === "string" ? row.observacoes : "",
    };

    // backfill via seed
    const seed = PROCURACOES_INICIAIS.find((p) => p.spe === normalized.spe);
    if (seed) {
      if (!normalized.codigoSpe.trim() && seed.codigoSpe) {
        normalized.codigoSpe = seed.codigoSpe;
      }
      if (!normalized.responsavel.trim() && seed.responsavel) {
        normalized.responsavel = seed.responsavel;
      }
    }

    if (JSON.stringify(normalized) !== before) mutated = true;
    return normalized;
  });

  if (mutated) await writeJson(PROCURACOES_FILE, rows);
  return rows;
}

export async function updateProcuracao(
  id: string,
  patch: Partial<Procuracao>,
): Promise<Procuracao | null> {
  const rows = await readProcuracoes();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...patch, id: rows[idx].id, spe: rows[idx].spe };
  await writeJson(PROCURACOES_FILE, rows);
  return rows[idx];
}

async function readRoteirosMap(): Promise<Record<string, Roteiro>> {
  await ensureFile(ROTEIROS_FILE, "{}");
  const raw = await fs.readFile(ROTEIROS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeRoteirosMap(map: Record<string, Roteiro>): Promise<void> {
  await ensureFile(ROTEIROS_FILE, "{}");
  await fs.writeFile(ROTEIROS_FILE, JSON.stringify(map, null, 2), "utf8");
}

export async function readRoteiro(assembleiaId: string): Promise<Roteiro | null> {
  const map = await readRoteirosMap();
  return map[assembleiaId] ?? null;
}

export async function saveRoteiro(roteiro: Roteiro): Promise<void> {
  const map = await readRoteirosMap();
  map[roteiro.assembleiaId] = roteiro;
  await writeRoteirosMap(map);
}

export async function resetData(): Promise<void> {
  // Restaura assembleias a partir do snapshot embarcado em src/seed-assembleias.json
  const seedFile = path.resolve(__dirname, "./seed-assembleias.json");
  try {
    const raw = await fs.readFile(seedFile, "utf8");
    await ensureFile(ASSEMBLEIAS_FILE, "[]");
    await fs.writeFile(ASSEMBLEIAS_FILE, raw, "utf8");
  } catch {
    // se o snapshot não estiver disponível, ao menos zera o arquivo
    await ensureFile(ASSEMBLEIAS_FILE, "[]");
    await fs.writeFile(ASSEMBLEIAS_FILE, "[]", "utf8");
  }
  // Apaga os demais (procuracoes recria do seed na próxima leitura)
  for (const file of [SOLICITACOES_FILE, PROCURACOES_FILE, ROTEIROS_FILE]) {
    try {
      await fs.unlink(file);
    } catch {
      /* ignore */
    }
  }
  // Limpa uploads
  try {
    const entries = await fs.readdir(UPLOADS_DIR);
    await Promise.all(
      entries.map((e) =>
        fs.rm(path.join(UPLOADS_DIR, e), { recursive: true, force: true }),
      ),
    );
  } catch {
    /* ignore */
  }
}

// Recarrega APENAS as assembleias a partir do snapshot embarcado, se a versão
// gravada no disco persistente diferir de ASSEMBLEIAS_SEED_VERSION. Preserva
// solicitações, procurações, roteiros, relatórios e uploads — ao contrário de
// resetData(). Idempotente: roda no máximo uma vez por bump de versão.
export async function applyAssembleiasSeedIfNeeded(
  force = false,
): Promise<{ applied: boolean; count: number }> {
  let current = "";
  try {
    current = (await fs.readFile(SEED_MARKER_FILE, "utf8")).trim();
  } catch {
    current = "";
  }
  if (!force && current === ASSEMBLEIAS_SEED_VERSION) {
    const rows = await readJson<Assembleia>(ASSEMBLEIAS_FILE);
    return { applied: false, count: rows.length };
  }

  const seedFile = path.resolve(__dirname, "./seed-assembleias.json");
  let count = 0;
  try {
    const raw = await fs.readFile(seedFile, "utf8");
    await ensureFile(ASSEMBLEIAS_FILE, "[]");
    await fs.writeFile(ASSEMBLEIAS_FILE, raw, "utf8");
    const parsed = JSON.parse(raw);
    count = Array.isArray(parsed) ? parsed.length : 0;
  } catch (err) {
    console.error("[seazone] falha ao aplicar seed de assembleias:", err);
    return { applied: false, count: 0 };
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SEED_MARKER_FILE, ASSEMBLEIAS_SEED_VERSION, "utf8");
  console.log(
    `[seazone] seed de assembleias aplicado (v${ASSEMBLEIAS_SEED_VERSION}): ${count} assembleias`,
  );
  return { applied: true, count };
}

async function readRelatoriosMap(): Promise<Record<string, Relatorio>> {
  await ensureFile(RELATORIOS_FILE, "{}");
  const raw = await fs.readFile(RELATORIOS_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeRelatoriosMap(map: Record<string, Relatorio>): Promise<void> {
  await ensureFile(RELATORIOS_FILE, "{}");
  await fs.writeFile(RELATORIOS_FILE, JSON.stringify(map, null, 2), "utf8");
}

export async function readRelatorio(assembleiaId: string): Promise<Relatorio | null> {
  const map = await readRelatoriosMap();
  return map[assembleiaId] ?? null;
}

export async function saveRelatorio(relatorio: Relatorio): Promise<void> {
  const map = await readRelatoriosMap();
  map[relatorio.assembleiaId] = relatorio;
  await writeRelatoriosMap(map);
}

export async function deleteRelatorio(assembleiaId: string): Promise<boolean> {
  const map = await readRelatoriosMap();
  if (!map[assembleiaId]) return false;
  delete map[assembleiaId];
  await writeRelatoriosMap(map);
  return true;
}

export async function deleteRoteiro(assembleiaId: string): Promise<boolean> {
  const map = await readRoteirosMap();
  if (!map[assembleiaId]) return false;
  delete map[assembleiaId];
  await writeRoteirosMap(map);
  return true;
}
