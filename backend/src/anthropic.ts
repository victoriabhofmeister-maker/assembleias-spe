import Anthropic from "@anthropic-ai/sdk";
import {
  TIPO_POR_EXTENSO,
  type Assembleia,
  type RoteiroFormulario,
} from "./types.js";

function fmtData(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function buildPrompt(a: Assembleia, f: RoteiroFormulario): string {
  const tipoExtenso = TIPO_POR_EXTENSO[a.tipo] ?? a.tipo;
  const ordens =
    a.ordemDoDia.trim() ||
    "_(nenhuma ordem do dia informada — gerar bloco genérico de pauta única)_";

  return `Você é um assistente especializado em gestão condominial e assembleias de SPEs (Sociedades de Propósito Específico) do setor imobiliário brasileiro.

Gere um roteiro completo, profissional e pronto para ser lido em voz alta durante uma assembleia, com base nos dados abaixo:

DADOS DA ASSEMBLEIA:
- SPE / Empreendimento: ${a.spe}
- Tipo: ${a.tipo} (${tipoExtenso})
- Data: ${fmtData(a.data)}
- Presidente da mesa: ${f.presidente || "_não informado_"}
- Secretário(a): ${f.secretario || "_não informado_"}
- Quórum necessário: ${f.quorum}
- Departamentos envolvidos: ${a.dptosEnvolvidos || "—"}
- Responsável Seazone: ${a.responsavel || "_não informado_"}
- Ordens do dia: ${ordens}
- Link da apresentação: ${f.linkApresentacao || "_não informado_"}
- Observações especiais: ${f.observacoes || "_nenhuma_"}

O roteiro deve conter EXATAMENTE as seguintes seções, nessa ordem, com o texto completo pronto para ser lido:

═══════════════════════════════
SEÇÃO 1 — ABERTURA E COMBINADOS INICIAIS
═══════════════════════════════
Texto de boas-vindas formal e cordial, mencionando o nome do empreendimento, data e tipo da assembleia.
Em seguida, os combinados iniciais obrigatórios:
- Quem está presidindo e quem está secretariando
- Regras de fala: solicitar a palavra levantando a mão, aguardar ser reconhecido pelo presidente antes de falar
- Respeito mútuo: todos têm direito de se expressar, discordâncias devem ser manifestadas com cordialidade
- Tempo de fala: objetivo e pontual para que a assembleia avance dentro do prazo
- Registro: lembrar que a reunião está sendo registrada em ata pelo secretário
- Se houver observações especiais no campo "Observações", incorporar como aviso/orientação aqui

═══════════════════════════════
SEÇÃO 2 — VERIFICAÇÃO DE QUÓRUM
═══════════════════════════════
Texto padrão para verificação e registro do quórum. Se quórum = "Não atingido", incluir orientação sobre o que fazer (segunda convocação ou assembleia com qualquer número conforme estatuto).

═══════════════════════════════
SEÇÃO 3 — ROTEIRO PONTO A PONTO DAS ORDENS DO DIA
═══════════════════════════════
Para CADA ordem do dia informada, gerar um bloco com:
  [PAUTA X de Y] — {nome da pauta}
  - Texto de introdução para o presidente ler apresentando aquela pauta
  - Espaço sinalizado para apresentação/fala dos envolvidos: "▶ Momento de apresentação / fala dos envolvidos"
  - Texto para abertura de deliberação: como convocar a votação, formas de manifestação (a favor / contra / abstenção)
  - Texto de encerramento da pauta após votação: registrar resultado e passar para próxima

═══════════════════════════════
SEÇÃO 4 — ENCERRAMENTO
═══════════════════════════════
- Texto agradecendo a participação de todos
- Informar que a ata será elaborada e enviada pelo responsável Seazone (${a.responsavel || "_não informado_"})
- Informar prazo padrão de envio da ata: até 30 dias úteis após a assembleia
- Encerramento formal da sessão pelo presidente

Retorne APENAS o roteiro, sem explicações adicionais. Use formatação clara com títulos em maiúsculas e separadores visuais entre seções. O tom deve ser formal mas acessível, adequado para ser lido em voz alta para condôminos.`;
}

export async function gerarRoteiroIA(
  a: Assembleia,
  f: RoteiroFormulario,
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY não configurada no .env do backend. Adicione a chave e reinicie o servidor.",
    };
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(a, f);

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!texto.trim()) return { ok: false, error: "Resposta vazia da API" };
    return { ok: true, texto };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Falha na API Anthropic: ${msg}` };
  }
}
