// Gera backend/src/seed-assembleias.json a partir de _cronograma-rows.md
// (tabela "Cronograma" da planilha Google `11qTKI9o…`, aba principal).
// Rerodar sempre que a planilha mudar e, em seguida, bumpar ASSEMBLEIAS_SEED_VERSION
// em storage.ts para que o re-seed não-destrutivo aplique no boot.
//
//   node backend/src/build-cronograma-seed.mjs
//
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROWS_FILE = path.join(__dirname, "_cronograma-rows.md");
const OUT_FILE = path.join(__dirname, "seed-assembleias.json");

// Mantidos em sincronia com CHECKLIST_TEMPLATE / CHECKLIST_POS_TEMPLATE (types.ts).
const CHECKLIST_TEMPLATE = [
  { titulo: "Comunicar o PMO da solicitação", responsavel: "Jurídico", prazo: "No mesmo dia do recebimento", status: "A fazer" },
  { titulo: "Elaborar apresentação da assembleia", responsavel: "Jurídico", prazo: "Antes da convocação", status: "A fazer" },
  { titulo: "Comunicar documentos faltantes", responsavel: "Jurídico", prazo: "Antes da convocação", status: "A fazer" },
  { titulo: "Convocar a assembleia (prazo mínimo 10 dias)", responsavel: "Jurídico", prazo: "Mínimo 10 dias antes da assembleia", status: "A fazer" },
  { titulo: "Agendar reunião prévia de alinhamento", responsavel: "Jurídico + PMO", prazo: "48h antes da assembleia", status: "A fazer" },
  { titulo: "Realizar reunião prévia de alinhamento", responsavel: "Jurídico + PMO", prazo: "48h antes da assembleia", status: "A fazer" },
];
const CHECKLIST_POS_TEMPLATE = [
  { titulo: "Enviar comunicado/resumo no Slack", responsavel: "Jurídico", prazo: "Até 24h após a assembleia", status: "A fazer" },
  { titulo: "Enviar ata elaborada no WhatsApp para o grupo com o conselho", responsavel: "Jurídico", prazo: "Até 72h após a assembleia", status: "A fazer" },
  { titulo: "Enviar ata para validação dos investidores", responsavel: "Jurídico", prazo: "3 dias úteis para validação", status: "A fazer" },
  { titulo: "Abrir suporte no CSI para assinatura da ata pelos investidores", responsavel: "Jurídico + CSI", prazo: "Até 48h após término da validação", status: "A fazer" },
];

const TIPOS_VALIDOS = new Set(["AGE", "AGO", "RCF", "STD", "RII", "RTD"]);
const CRIT_VALIDAS = new Set(["Alto", "Medio", "Baixo"]);
const FIXED_TS = "2026-06-16T12:00:00.000Z";

function unesc(s) {
  // remove escapes markdown ( \- \[ \] ) e colapsa espaços nas pontas
  return s.replace(/\\([\[\]\-])/g, "$1").trim();
}

function splitRow(line) {
  // "| a | b | c |" -> ["a","b","c"]
  let cells = line.split("|");
  // remove o vazio antes do primeiro pipe e depois do último
  if (cells.length && cells[0].trim() === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1].trim() === "") cells = cells.slice(0, -1);
  return cells.map(unesc);
}

function parseData(raw) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (m) return { iso: `${m[3]}-${m[2]}-${m[1]}`, nota: "" };
  // data não-canônica (ex.: "EM ABERTO …"): vira nota, data fica vazia
  const t = raw.trim();
  if (!t || t === "-") return { iso: "", nota: "" };
  return { iso: "", nota: t };
}

const RESP_CANON = { victoria: "Victoria", mariele: "Mariele", sabrina: "Sabrina", pmo: "PMO", leticia: "Leticia" };
function canonResp(raw) {
  const key = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return RESP_CANON[key] ?? raw.trim();
}

function canonCrit(raw) {
  const key = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (key === "alto") return "Alto";
  if (key === "medio") return "Medio";
  if (key === "baixo") return "Baixo";
  return "Baixo";
}

const lines = readFileSync(ROWS_FILE, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("|"));

const seed = [];
let warns = [];
for (const line of lines) {
  const c = splitRow(line);
  if (c.length < 14) {
    warns.push(`linha com ${c.length} colunas (esperado 14): ${line.slice(0, 60)}…`);
    continue;
  }
  const [dataRaw, tipoRaw, ordemDoDia, dataLimiteEdital, suporteCsi, editalRaw, linkEdital, apresentacao, dptosEnvolvidos, spe, critRaw, respRaw, situacaoRaw, obsRaw] = c;

  const { iso, nota } = parseData(dataRaw);

  let tipo = tipoRaw.trim().toUpperCase();
  let obs = obsRaw;
  if (!TIPOS_VALIDOS.has(tipo)) {
    if (/continuid/i.test(tipoRaw)) {
      tipo = "AGE";
      obs = obs ? `${obs} (AGE continuada)` : "AGE continuada";
    } else {
      warns.push(`tipo desconhecido "${tipoRaw}" (${spe}) → mapeado p/ STD`);
      tipo = "STD";
    }
  }
  if (nota) obs = obs ? `[${nota}] ${obs}` : `[${nota}]`;

  seed.push({
    id: String(seed.length + 1),
    createdAt: FIXED_TS,
    data: iso,
    tipo,
    ordemDoDia,
    dataLimiteEdital,
    suporteCsi,
    editalEnviado: editalRaw.trim().toLowerCase() === "sim",
    linkEdital,
    apresentacao,
    dptosEnvolvidos,
    spe: spe.trim(),
    criticidade: canonCrit(critRaw),
    responsavel: canonResp(respRaw),
    situacao: situacaoRaw,
    observacoes: obs,
    checklist: CHECKLIST_TEMPLATE.map((x) => ({ ...x })),
    checklistPos: CHECKLIST_POS_TEMPLATE.map((x) => ({ ...x })),
  });
}

writeFileSync(OUT_FILE, JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(`OK — ${seed.length} assembleias gravadas em seed-assembleias.json`);
if (warns.length) {
  console.log("\nAvisos:");
  warns.forEach((w) => console.log(" - " + w));
}
// sanity
const tipos = {};
seed.forEach((s) => (tipos[s.tipo] = (tipos[s.tipo] || 0) + 1));
console.log("\nTipos:", JSON.stringify(tipos));
console.log("SPEs distintas:", new Set(seed.map((s) => s.spe)).size);
console.log("Com situação preenchida:", seed.filter((s) => s.situacao.trim()).length);
console.log("Com observações:", seed.filter((s) => s.observacoes.trim()).length);
