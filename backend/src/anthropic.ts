import Anthropic from "@anthropic-ai/sdk";
import {
  TIPO_POR_EXTENSO,
  type Assembleia,
  type RoteiroFormulario,
} from "./types.js";

function friendlyAnthropicError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|invalid x-api-key|authentication_error/i.test(msg)) {
    return "Chave da API Anthropic inválida ou ausente. Atualize a variável ANTHROPIC_API_KEY nas configurações do servidor (Render) com uma chave válida.";
  }
  if (/404|not_found|model/i.test(msg)) {
    return `Modelo indisponível na API Anthropic (${msg}).`;
  }
  return `Falha na API Anthropic: ${msg}`;
}

function buildPromptRelatorio(a: Assembleia, transcricao: string): string {
  const tipoExtenso = TIPO_POR_EXTENSO[a.tipo] ?? a.tipo;
  return `Você é um assistente jurídico especializado em assembleias de SPEs (Sociedades de Propósito Específico) do setor imobiliário brasileiro.

Analise a transcrição abaixo de uma assembleia já realizada e produza um RELATÓRIO PÓS-ASSEMBLEIA estruturado, conciso e útil pro time Jurídico/PMO.

DADOS DA ASSEMBLEIA:
- SPE / Empreendimento: ${a.spe}
- Tipo: ${a.tipo} (${tipoExtenso})
- Data: ${fmtData(a.data)}
- Responsável Seazone: ${a.responsavel || "_não informado_"}
- Ordem do dia originalmente prevista: ${a.ordemDoDia || "_não informada_"}

TRANSCRIÇÃO:
"""
${transcricao}
"""

Produza o relatório nas seguintes seções, na ordem:

═══════════════════════════════
SEÇÃO 1 — RESUMO EXECUTIVO
═══════════════════════════════
Em 2-3 parágrafos: o que aconteceu na assembleia, quem participou (se citado), tom geral da reunião.

═══════════════════════════════
SEÇÃO 2 — DELIBERAÇÕES TOMADAS
═══════════════════════════════
Lista enumerada de cada deliberação. Pra cada uma:
- Pauta deliberada
- Resultado da votação (a favor / contra / abstenção, se mencionado)
- Quórum atingido (se mencionado)
- Status: APROVADA / REJEITADA / ADIADA

═══════════════════════════════
SEÇÃO 3 — COMPROMISSOS E PRÓXIMOS PASSOS
═══════════════════════════════
Lista de tarefas que ficaram pendentes, com responsável (se identificado) e prazo (se mencionado).

═══════════════════════════════
SEÇÃO 4 — PONTOS DE ATENÇÃO PRO JURÍDICO
═══════════════════════════════
Riscos identificados, dúvidas técnicas, divergências entre sócios, qualquer coisa que peça ação do Jurídico.

═══════════════════════════════
SEÇÃO 5 — PAUTAS NÃO TRATADAS (se houver)
═══════════════════════════════
Comparar a "Ordem do dia originalmente prevista" com as pautas efetivamente deliberadas. Listar o que foi pulado ou adiado.

Retorne APENAS o relatório, sem comentários adicionais. Use formatação clara com títulos das seções em MAIÚSCULAS e separadores visuais. Tom: profissional, direto, sem encheção.`;
}

export async function gerarRelatorioAtaIA(
  a: Assembleia,
  transcricao: string,
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "ANTHROPIC_API_KEY não configurada no .env do backend. Adicione a chave e reinicie o servidor.",
    };
  }
  if (!transcricao || transcricao.trim().length < 50) {
    return { ok: false, error: "Transcrição muito curta (mínimo 50 caracteres)." };
  }
  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: buildPromptRelatorio(a, transcricao) }],
    });
    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (!texto.trim()) return { ok: false, error: "Resposta vazia da API" };
    return { ok: true, texto };
  } catch (err) {
    return { ok: false, error: friendlyAnthropicError(err) };
  }
}

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
      model: "claude-sonnet-4-6",
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
    return { ok: false, error: friendlyAnthropicError(err) };
  }
}
