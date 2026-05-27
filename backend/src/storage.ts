import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  CHECKLIST_LEGACY_TITLES,
  CHECKLIST_TEMPLATE,
  PROCURACOES_INICIAIS,
  SPES_DISPONIVEIS,
  type Assembleia,
  type ChecklistItem,
  type Procuracao,
  type Roteiro,
  type Solicitacao,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const ASSEMBLEIAS_FILE = path.join(DATA_DIR, "assembleias.json");
const SOLICITACOES_FILE = path.join(DATA_DIR, "solicitacoes.json");
const PROCURACOES_FILE = path.join(DATA_DIR, "procuracoes.json");
const ROTEIROS_FILE = path.join(DATA_DIR, "roteiros.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

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
  // Remove etapas legadas (Pipe + canal Slack) preservando os demais status
  const filtered = checklist.filter((c) => !CHECKLIST_LEGACY_TITLES.has(c.titulo));
  if (filtered.length !== checklist.length) {
    // Para cada item do template novo, tenta achar pelo título; senão, mantém "A fazer"
    const byTitulo = new Map(filtered.map((c) => [c.titulo, c] as const));
    const next = CHECKLIST_TEMPLATE.map((tpl) => {
      const existing = byTitulo.get(tpl.titulo);
      return existing
        ? { ...tpl, status: existing.status }
        : { ...tpl };
    });
    return { next, changed: true };
  }
  // Se já tem só as 5, garante que estão no template oficial (em caso de drift)
  if (checklist.length === CHECKLIST_TEMPLATE.length) {
    return { next: checklist, changed: false };
  }
  return { next: checklist, changed: false };
}

export async function readAssembleias(): Promise<Assembleia[]> {
  const rows = await readJson<Assembleia>(ASSEMBLEIAS_FILE);
  let mutated = false;
  for (const a of rows) {
    const { next, changed } = migrateChecklist(a.checklist);
    if (changed) {
      a.checklist = next;
      mutated = true;
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

export async function deleteRoteiro(assembleiaId: string): Promise<boolean> {
  const map = await readRoteirosMap();
  if (!map[assembleiaId]) return false;
  delete map[assembleiaId];
  await writeRoteirosMap(map);
  return true;
}
