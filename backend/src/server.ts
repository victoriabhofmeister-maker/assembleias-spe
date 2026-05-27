import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearSessionCookie,
  isAuthConfigured,
  issueSessionCookie,
  readSession,
  requireAuth,
  verifyGoogleCredential,
} from "./auth.js";
import {
  appendAssembleia,
  appendSolicitacao,
  deleteRoteiro,
  readAssembleias,
  readProcuracoes,
  readRoteiro,
  readSolicitacoes,
  resetData,
  saveRoteiro,
  updateAssembleia,
  updateProcuracao,
  UPLOADS_DIR,
} from "./storage.js";
import { sendAssembleiaToSlack, sendEtapaToSlack, sendSolicitacaoToSlack } from "./slack.js";
import { gerarRoteiroIA } from "./anthropic.js";
import {
  CHECKLIST_TEMPLATE,
  type Assembleia,
  type AssembleiaInput,
  type ChecklistStatus,
  type Criticidade,
  type DepartamentoSolicitante,
  type DocumentoUpload,
  type Indicacao,
  type QuorumStatus,
  type Roteiro,
  type RoteiroFormulario,
  type Solicitacao,
  type TipoAssembleia,
} from "./types.js";

const app = express();

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Public routes: /api/health, /api/auth/*, POST /api/solicitacoes
app.use("/api", (req: Request, res: Response, next) => {
  if (!isAuthConfigured()) return next();
  const isPublic =
    req.path === "/health" ||
    req.path.startsWith("/auth/") ||
    (req.path === "/solicitacoes" && req.method === "POST");
  if (isPublic) return next();
  return requireAuth(req, res, next);
});

const TIPOS: TipoAssembleia[] = ["AGE", "AGO", "RCF", "STD", "RII", "RTD"];
const CRITICIDADES: Criticidade[] = ["Alto", "Medio", "Baixo"];
const STATUS_CHECKLIST: ChecklistStatus[] = ["A fazer", "Em andamento", "Concluído"];
const DEPARTAMENTOS: DepartamentoSolicitante[] = [
  "Engenharia",
  "Financeiro",
  "Jurídico",
  "PMO",
  "Outros",
];

await fs.mkdir(UPLOADS_DIR, { recursive: true });

const ALLOWED_UPLOAD_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
]);
const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const id = (_req as Request & { _solicitacaoId?: string })._solicitacaoId;
      const dir = id ? path.join(UPLOADS_DIR, id) : UPLOADS_DIR;
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^\w.\-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXT.has(ext) && ALLOWED_UPLOAD_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.originalname}`));
    }
  },
});

function validateAssembleia(body: unknown): { ok: true; value: AssembleiaInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Corpo inválido" };
  const b = body as Record<string, unknown>;

  const required = ["data", "tipo", "ordemDoDia", "spe", "criticidade"];
  for (const k of required) {
    if (!b[k] || typeof b[k] !== "string") return { ok: false, error: `Campo obrigatório: ${k}` };
  }
  if (!TIPOS.includes(b.tipo as TipoAssembleia)) return { ok: false, error: "Tipo inválido" };
  if (!CRITICIDADES.includes(b.criticidade as Criticidade)) return { ok: false, error: "Criticidade inválida" };

  const value: AssembleiaInput = {
    data: String(b.data),
    tipo: b.tipo as TipoAssembleia,
    ordemDoDia: String(b.ordemDoDia),
    dataLimiteEdital: String(b.dataLimiteEdital ?? ""),
    suporteCsi: String(b.suporteCsi ?? ""),
    editalEnviado: Boolean(b.editalEnviado),
    apresentacao: String(b.apresentacao ?? ""),
    dptosEnvolvidos: String(b.dptosEnvolvidos ?? ""),
    spe: String(b.spe),
    criticidade: b.criticidade as Criticidade,
    responsavel: String(b.responsavel ?? ""),
  };
  return { ok: true, value };
}

app.get("/api/assembleias", async (_req: Request, res: Response) => {
  const rows = await readAssembleias();
  res.json(rows.sort((a, b) => (a.data < b.data ? 1 : -1)));
});

app.post("/api/assembleias", async (req: Request, res: Response) => {
  const parsed = validateAssembleia(req.body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const row: Assembleia = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...parsed.value,
    checklist: CHECKLIST_TEMPLATE.map((c) => ({ ...c })),
  };
  await appendAssembleia(row);

  const slack = await sendAssembleiaToSlack(row);
  res.status(201).json({ assembleia: row, slack });
});

app.patch("/api/assembleias/:id/checklist/:index", async (req: Request, res: Response) => {
  const { id, index } = req.params;
  const i = Number(index);
  const status = (req.body?.status ?? "") as ChecklistStatus;
  if (!STATUS_CHECKLIST.includes(status)) {
    return res.status(400).json({ error: "Status inválido" });
  }
  let mudouParaConcluido = false;
  const updated = await updateAssembleia(id, (a) => {
    if (!Number.isInteger(i) || i < 0 || i >= a.checklist.length) return a;
    const before = a.checklist[i].status;
    a.checklist[i] = { ...a.checklist[i], status };
    if (status === "Concluído" && before !== "Concluído") mudouParaConcluido = true;
    return a;
  });
  if (!updated) return res.status(404).json({ error: "Assembleia não encontrada" });

  if (mudouParaConcluido) {
    sendEtapaToSlack(i, updated).then((r) => {
      if (!r.ok) console.error(`[seazone] Slack etapa ${i + 1} falhou:`, r.error);
    }).catch((err) => {
      console.error(`[seazone] Slack etapa ${i + 1} erro:`, err);
    });
  }

  res.json(updated);
});

app.get("/api/solicitacoes", async (_req: Request, res: Response) => {
  const rows = await readSolicitacoes();
  res.json(rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)));
});

app.post(
  "/api/solicitacoes",
  (req: Request, _res: Response, next) => {
    (req as Request & { _solicitacaoId?: string })._solicitacaoId = randomUUID();
    next();
  },
  upload.any(),
  async (req: Request, res: Response) => {
    const id = (req as Request & { _solicitacaoId?: string })._solicitacaoId!;
    const b = req.body as Record<string, string | undefined>;

    if (!b.nomeSolicitante || !b.spe || !b.tipo || !b.departamentoSolicitante) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }
    if (!DEPARTAMENTOS.includes(b.departamentoSolicitante as DepartamentoSolicitante)) {
      return res.status(400).json({ error: "Departamento inválido" });
    }
    if (!TIPOS.includes(b.tipo as TipoAssembleia)) {
      return res.status(400).json({ error: "Tipo inválido" });
    }

    let ordens: string[] = [];
    try {
      const raw = b.ordensDoDia ?? "[]";
      const parsed = JSON.parse(raw);
      ordens = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      ordens = [];
    }

    let indicacoes: Indicacao[] = [];
    try {
      const raw = b.indicacoes ?? "[]";
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        indicacoes = parsed
          .filter(
            (x): x is { ordemDoDia: string; campo: string; valor: string } =>
              x && typeof x === "object" && typeof x.ordemDoDia === "string" &&
              typeof x.campo === "string" && typeof x.valor === "string" && x.valor.trim() !== "",
          )
          .map((x) => ({
            ordemDoDia: x.ordemDoDia,
            campo: x.campo,
            valor: x.valor,
          }));
      }
    } catch {
      indicacoes = [];
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const fixLatin = (s: string) => Buffer.from(s, "latin1").toString("utf8");
    const documentos: DocumentoUpload[] = files.map((f) => {
      const tag = fixLatin(f.fieldname).split("::");
      return {
        ordemDoDia: tag[0] ?? "Geral",
        nomeDocumento: tag[1] ?? fixLatin(f.originalname),
        filename: f.filename,
        originalName: fixLatin(f.originalname),
        mimetype: f.mimetype,
        size: f.size,
      };
    });

    const row: Solicitacao = {
      id,
      createdAt: new Date().toISOString(),
      nomeSolicitante: String(b.nomeSolicitante),
      departamentoSolicitante: b.departamentoSolicitante as DepartamentoSolicitante,
      spe: String(b.spe),
      dataPretendida: String(b.dataPretendida),
      tipo: b.tipo as TipoAssembleia,
      ordensDoDia: ordens,
      outraOrdemDescricao: String(b.outraOrdemDescricao ?? ""),
      observacoes: String(b.observacoes ?? ""),
      documentos,
      indicacoes,
      status: "Pendente de análise",
    };
    await appendSolicitacao(row);

    const slack = await sendSolicitacaoToSlack(row);
    res.status(201).json({ solicitacao: row, slack });
  },
);

app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? "Arquivo excede o limite de 10MB."
        : `Erro de upload: ${err.message}`;
    return res.status(400).json({ error: msg });
  }
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Erro interno" });
});

app.get("/api/solicitacoes/:id/docs/:filename", async (req: Request, res: Response) => {
  const { id, filename } = req.params;
  const safe = filename.replace(/[^\w.\-]/g, "_");
  const filePath = path.join(UPLOADS_DIR, id, safe);
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "Arquivo não encontrado" });
  }
});

app.get("/api/procuracoes", async (_req: Request, res: Response) => {
  const rows = await readProcuracoes();
  res.json(rows);
});

app.patch("/api/procuracoes/:id", async (req: Request, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of ["codigoSpe", "responsavel", "contato", "linkAcs", "observacoes"]) {
    if (typeof b[k] === "string") patch[k] = b[k];
  }
  if (b.possuiProcuracao === true || b.possuiProcuracao === false || b.possuiProcuracao === null) {
    patch.possuiProcuracao = b.possuiProcuracao;
  }
  if (Array.isArray(b.socios)) {
    patch.socios = b.socios
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
  const updated = await updateProcuracao(req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Procuração não encontrada" });
  res.json(updated);
});

const QUORUM_VALS: QuorumStatus[] = [
  "Unanimidade",
  "Maioria absoluta",
  "Maioria simples",
  "Destituição administrador-sócio",
  "Exclusão extrajudicial",
  "A verificar",
];

function validateRoteiroForm(body: unknown): RoteiroFormulario | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const quorum = String(b.quorum ?? "A verificar") as QuorumStatus;
  if (!QUORUM_VALS.includes(quorum)) return null;
  return {
    linkApresentacao: String(b.linkApresentacao ?? ""),
    presidente: String(b.presidente ?? ""),
    secretario: String(b.secretario ?? ""),
    quorum,
    observacoes: String(b.observacoes ?? ""),
  };
}

app.get("/api/assembleias/:id/roteiro", async (req: Request, res: Response) => {
  const r = await readRoteiro(req.params.id);
  res.json(r);
});

app.post("/api/assembleias/:id/roteiro/gerar", async (req: Request, res: Response) => {
  const form = validateRoteiroForm(req.body);
  if (!form) return res.status(400).json({ error: "Formulário inválido" });

  const rows = await readAssembleias();
  const assembleia = rows.find((a) => a.id === req.params.id);
  if (!assembleia) return res.status(404).json({ error: "Assembleia não encontrada" });

  const result = await gerarRoteiroIA(assembleia, form);
  if (!result.ok) return res.status(502).json({ error: result.error });

  const roteiro: Roteiro = {
    assembleiaId: assembleia.id,
    formulario: form,
    roteiro: result.texto,
    geradoEm: new Date().toISOString(),
  };
  await saveRoteiro(roteiro);
  res.status(201).json(roteiro);
});

app.delete("/api/assembleias/:id/roteiro", async (req: Request, res: Response) => {
  const ok = await deleteRoteiro(req.params.id);
  res.json({ ok });
});

app.post("/api/admin/reset-seed", async (_req: Request, res: Response) => {
  try {
    await resetData();
    const rows = await readAssembleias();
    res.json({ ok: true, assembleias: rows.length });
  } catch (err) {
    res
      .status(500)
      .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    slackConfigured: Boolean(process.env.SLACK_WEBHOOK_URL),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    authConfigured: isAuthConfigured(),
  });
});

// === Auth ===
app.get("/api/auth/me", (req: Request, res: Response) => {
  if (!isAuthConfigured()) {
    res.json({ user: null, authConfigured: false });
    return;
  }
  const user = readSession(req);
  res.json({ user, authConfigured: true });
});

app.post("/api/auth/google", async (req: Request, res: Response) => {
  if (!isAuthConfigured()) {
    res.status(503).json({ error: "Autenticação não configurada no servidor" });
    return;
  }
  const credential = (req.body as { credential?: string })?.credential;
  if (!credential || typeof credential !== "string") {
    res.status(400).json({ error: "Credential ausente" });
    return;
  }
  try {
    const user = await verifyGoogleCredential(credential);
    issueSessionCookie(res, user);
    res.json({ user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(401).json({ error: msg });
  }
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// === Static frontend em produção ===
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDist));
  app.get("*", (req: Request, res: Response, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`[seazone] backend ouvindo em http://localhost:${port}`);
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.warn("[seazone] aviso: SLACK_WEBHOOK_URL não configurado — envios ao Slack vão falhar");
  }
});
