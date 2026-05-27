import type { Assembleia, Criticidade, Solicitacao } from "./types.js";

const EMOJI: Record<Criticidade, string> = {
  Alto: "🔴",
  Medio: "🟡",
  Baixo: "🟢",
};

const LABEL_TIPO: Record<string, string> = {
  AGE: "Assembleia Geral Extraordinária",
  RCF: "Reunião do Conselho Fiscal",
  STD: "Subscrição/Transferência de Direitos",
  RII: "Reunião de Investidores/Incorporadores",
  RTD: "Reunião Técnica/Deliberativa",
};

function fmtData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function buildSlackPayload(a: Assembleia) {
  const emoji = EMOJI[a.criticidade] ?? "⚪";
  const tipoLabel = LABEL_TIPO[a.tipo] ?? a.tipo;

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Nova Assembleia — ${a.spe}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Data:*\n${fmtData(a.data)}` },
        { type: "mrkdwn", text: `*Tipo:*\n${a.tipo} — ${tipoLabel}` },
        { type: "mrkdwn", text: `*SPE:*\n${a.spe}` },
        { type: "mrkdwn", text: `*Criticidade:*\n${emoji} ${a.criticidade}` },
        { type: "mrkdwn", text: `*Responsável:*\n${a.responsavel || "_não definido_"}` },
        { type: "mrkdwn", text: `*Suporte CSI:*\n${a.suporteCsi || "—"}` },
        { type: "mrkdwn", text: `*Data limite edital:*\n${fmtData(a.dataLimiteEdital)}` },
        { type: "mrkdwn", text: `*Edital enviado:*\n${a.editalEnviado ? "✅ Sim" : "❌ Não"}` },
        { type: "mrkdwn", text: `*Apresentação:*\n${a.apresentacao || "—"}` },
        { type: "mrkdwn", text: `*Dptos envolvidos:*\n${a.dptosEnvolvidos || "—"}` },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Ordem do dia:*\n${a.ordemDoDia || "_(sem descrição)_"}`,
      },
    },
  ];

  if (a.criticidade === "Alto") {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text:
            "⚠️ *Deliberação crítica.* Garantir presença do responsável, conferir quórum estatutário e validar minuta antes do envio do edital.",
        },
      ],
    });
  } else {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Registro criado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
        },
      ],
    });
  }

  return {
    text: `${emoji} Nova assembleia ${a.tipo} — ${a.spe} (${fmtData(a.data)})`,
    blocks,
  };
}

export function buildSolicitacaoPayload(s: Solicitacao) {
  const tipoLabel = LABEL_TIPO[s.tipo] ?? s.tipo;
  const pautas = s.ordensDoDia.length ? s.ordensDoDia.join(", ") : "—";
  const observacoes = s.observacoes.trim() ? s.observacoes.trim() : "—";

  const linhas = [
    "🏢 *Nova solicitação de assembleia*",
    `*SPE:* ${s.spe}`,
    `*Tipo:* ${s.tipo} — ${tipoLabel}`,
    `*Ordens do dia:* ${pautas}`,
    `*Solicitante:* ${s.nomeSolicitante} — ${s.departamentoSolicitante}`,
    `*Observações:* ${observacoes}`,
  ];
  const text = linhas.join("\n");

  return {
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: linhas[0] },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*SPE:*\n${s.spe}` },
          { type: "mrkdwn", text: `*Tipo:*\n${s.tipo} — ${tipoLabel}` },
          {
            type: "mrkdwn",
            text: `*Solicitante:*\n${s.nomeSolicitante} — ${s.departamentoSolicitante}`,
          },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Ordens do dia:* ${pautas}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Observações:* ${observacoes}` },
      },
    ],
  };
}

async function postSlack(payload: unknown): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, error: "SLACK_WEBHOOK_URL não configurado" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Slack respondeu ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendAssembleiaToSlack(a: Assembleia) {
  return postSlack(buildSlackPayload(a));
}

export async function sendSolicitacaoToSlack(s: Solicitacao) {
  return postSlack(buildSolicitacaoPayload(s));
}

function dadosLinha(a: Assembleia): string {
  return `${a.spe} — ${a.tipo} — ${a.data ? fmtData(a.data) : "data a definir"}`;
}

export function buildSlackPayloadEtapa(
  etapaIndex: number,
  a: Assembleia,
): { text: string; blocks: unknown[] } | null {
  const spe = a.spe;
  const tipo = a.tipo;
  const data = a.data ? fmtData(a.data) : "data a definir";
  const pauta = a.ordemDoDia.trim() || "(não informada)";
  const dptos = a.dptosEnvolvidos.trim() || "—";
  const responsavel = a.responsavel.trim() || "—";

  const section = (text: string) => ({
    type: "section",
    text: { type: "mrkdwn", text },
  });
  const ctx = (text: string) => ({
    type: "context",
    elements: [{ type: "mrkdwn", text }],
  });

  // Checklist agora tem 5 etapas (índices 0-4):
  // 0 = Comunicar o PMO da solicitação
  // 1 = Análise da pauta e verificação de deliberações críticas
  // 2 = Elaborar apresentação da assembleia
  // 3 = Comunicar documentos faltantes
  // 4 = Convocar a assembleia (prazo mínimo 10 dias) / Confirmar participação
  switch (etapaIndex) {
    case 0:
      return {
        text: `📢 PMO comunicado — ${dadosLinha(a)}`,
        blocks: [
          section("📢 *PMO comunicado sobre a assembleia*"),
          section(
            `> *SPE:* ${dadosLinha(a)}\n` +
              `> *Pauta(s):* ${pauta}\n` +
              `> *Dpto solicitante:* ${dptos}\n` +
              `> O PMO foi notificado no canal PMO-JURÍDICO e na daily.`,
          ),
          ctx(`Responsável Seazone: ${responsavel}`),
        ],
      };
    case 1:
      return {
        text: `🔍 Análise de pauta concluída — ${dadosLinha(a)}`,
        blocks: [
          section("🔍 *Análise de pauta concluída*"),
          section(
            `> *SPE:* ${dadosLinha(a)}\n> *Pauta(s) analisada(s):* ${pauta}\n` +
              `> Verificação de deliberações críticas e controle de procurações realizada.`,
          ),
        ],
      };
    case 2:
      return {
        text: `🖥️ Apresentação elaborada — ${dadosLinha(a)}`,
        blocks: [
          section("🖥️ *Apresentação elaborada*"),
          section(
            `> *SPE:* ${dadosLinha(a)}\n` +
              `> Apresentação preparada contemplando todas as pautas e deliberações previstas.`,
          ),
        ],
      };
    case 3:
      return {
        text: `📎 Documentos verificados — ${dadosLinha(a)}`,
        blocks: [
          section("📎 *Documentos verificados*"),
          section(
            `> *SPE:* ${dadosLinha(a)}\n` +
              `> Documentos faltantes comunicados ao departamento solicitante.`,
          ),
        ],
      };
    case 4: {
      const temEditalTipo = tipo === "AGE" || tipo === "AGO";
      if (temEditalTipo) {
        return {
          text: `✅ Assembleia convocada — ${spe} (${data})`,
          blocks: [
            section("✅ *Assembleia convocada formalmente*"),
            section(
              `> *SPE:* ${spe}\n> *Tipo:* ${tipo}\n> *Data:* ${data}\n` +
                `> *Pauta(s):* ${pauta}\n> *Responsável:* ${responsavel}\n` +
                `> Convocação enviada com antecedência mínima de 10 dias. ` +
                `⚠️ *REUNIÃO PRÉVIA DE ALINHAMENTO: 48h antes da assembleia.*`,
            ),
          ],
        };
      }
      return {
        text: `✅ Participação confirmada — ${spe} (${data})`,
        blocks: [
          section("✅ *Participação confirmada*"),
          section(
            `> *SPE:* ${spe}\n> *Tipo:* ${tipo}\n> *Data:* ${data}\n` +
              `> *Pauta(s):* ${pauta}\n> *Responsável:* ${responsavel}\n` +
              `> Todos os participantes confirmaram presença na reunião. ` +
              `⚠️ *REUNIÃO PRÉVIA DE ALINHAMENTO: 48h antes da reunião.*`,
          ),
        ],
      };
    }
    default:
      return null;
  }
}

export async function sendEtapaToSlack(index: number, a: Assembleia) {
  const payload = buildSlackPayloadEtapa(index, a);
  if (!payload) return { ok: false, error: `Etapa ${index} sem mapeamento` };
  return postSlack(payload);
}

// === Checklist pós-assembleia ===
export function buildSlackPayloadEtapaPos(
  etapaIndex: number,
  a: Assembleia,
): { text: string; blocks: unknown[] } | null {
  const section = (text: string) => ({
    type: "section",
    text: { type: "mrkdwn", text },
  });
  const linha = dadosLinha(a);

  switch (etapaIndex) {
    case 0: // Comunicado/resumo no Slack
      return {
        text: `📣 Comunicado pós-assembleia — ${linha}`,
        blocks: [
          section("📣 *Comunicado pós-assembleia enviado*"),
          section(`> *SPE:* ${linha}\n> Resumo da assembleia compartilhado no canal em até 24h.`),
        ],
      };
    case 1: // Ata no WhatsApp
      return {
        text: `📄 Ata enviada no WhatsApp — ${linha}`,
        blocks: [
          section("📄 *Ata elaborada e enviada no WhatsApp*"),
          section(
            `> *SPE:* ${linha}\n> Ata enviada ao grupo com o conselho em até 72h após a assembleia.`,
          ),
        ],
      };
    case 2: // Ata para validação
      return {
        text: `🔎 Ata em validação — ${linha}`,
        blocks: [
          section("🔎 *Ata enviada para validação dos investidores*"),
          section(
            `> *SPE:* ${linha}\n> Prazo de validação: 3 dias úteis.`,
          ),
        ],
      };
    case 3: // CSI assinatura
      return {
        text: `✍️ Suporte CSI aberto pra assinatura — ${linha}`,
        blocks: [
          section("✍️ *Suporte CSI aberto para assinatura da ata*"),
          section(
            `> *SPE:* ${linha}\n> Ticket aberto em até 48h após o término da validação dos investidores.`,
          ),
        ],
      };
    default:
      return null;
  }
}

export async function sendEtapaPosToSlack(index: number, a: Assembleia) {
  const payload = buildSlackPayloadEtapaPos(index, a);
  if (!payload) return { ok: false, error: `Etapa pós ${index} sem mapeamento` };
  return postSlack(payload);
}
