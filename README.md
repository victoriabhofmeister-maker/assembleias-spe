# Seazone — Gestão de Assembleias de SPEs

Sistema interno para o time Jurídico/PMO da Seazone gerenciar assembleias de SPEs (Sociedades de Propósito Específico) do portfólio imobiliário, substituindo o controle manual em planilha.

Hackathon Seazone 2026.

## O que faz

- **Dashboard** com 41 assembleias pré-cadastradas, em **Lista** ou **Kanban**, com filtros por Responsável, Criticidade e Status (Próximas / Realizadas)
- **Checklist pré-assembleia** de 7 etapas por assembleia, com integração Slack que dispara notificação automática quando uma etapa é concluída
- **Roteiro de assembleia gerado por IA** (Claude) — formulário de dados básicos vira roteiro formatado pronto pra ler em voz alta, com botão de imprimir/PDF
- **Formulário público `/solicitar`** — link que qualquer área da empresa pode usar pra pedir uma nova assembleia, com upload obrigatório dos documentos por pauta marcada
- **Controle de procurações** — tabela editável inline com os 22 empreendimentos, link da ACS, sócios, status de procuração

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v3
- **Backend**: Node.js + Express + TypeScript (rodando via `tsx watch`)
- **Persistência**: arquivos JSON locais em `backend/data/` (sem banco — escopo de hackathon)
- **IA**: Anthropic SDK (`claude-3-5-sonnet-20241022`) para geração de roteiro
- **Slack**: Webhooks com Block Kit (sem app/bot — apenas POST direto)

## Estrutura

```
backend/        Express + JSON storage + Slack/Anthropic
frontend/       Vite + React UI
backend/data/   JSON files (ignorado no git, exceto o seed inicial)
```

## Como rodar localmente

Pré-requisitos: **Node.js 18+** e **npm**.

```bash
# 1. Instalar dependências
cd backend && npm install
cd ../frontend && npm install

# 2. Configurar variáveis de ambiente (opcional)
cd ../backend
cp .env.example .env
# editar .env e preencher SLACK_WEBHOOK_URL e/ou ANTHROPIC_API_KEY

# 3. Subir o backend (porta 3001)
npm run dev

# 4. Em outro terminal, subir o frontend (porta 5173)
cd ../frontend
npm run dev
```

Abrir `http://localhost:5173` no navegador.

A rota pública de solicitação fica em `http://localhost:5173/solicitar` — pode ser compartilhada com qualquer pessoa da empresa.

## Variáveis de ambiente

| Variável | Obrigatória? | Para que serve |
|---|---|---|
| `SLACK_WEBHOOK_URL` | Não | Dispara mensagens no Slack quando assembleia é criada, solicitação chega, ou etapa do checklist é concluída |
| `ANTHROPIC_API_KEY` | Não | Habilita o botão "✨ Gerar Roteiro com IA" na aba Roteiro de cada assembleia |
| `PORT` | Não | Porta do backend (default 3001) |

Sem essas variáveis o app continua funcionando normalmente — só os disparos Slack e a geração de roteiro ficam desativados (com mensagens amigáveis quando o usuário tenta usar).

## Seed inicial

`backend/data/assembleias.json` traz 41 assembleias reais do controle atual, incluindo as 5 sem data definida. O seed também popula:

- 22 procurações (uma por empreendimento) com Código SPE e Responsável já preenchidos
- Pontos focais por área (CSI: Luiza, Engenharia: Francisco, PMO: Cris, Financeiro: Rafa)
- Lista de tipos de pauta com documentos obrigatórios por pauta

## API

Backend expõe em `http://localhost:3001`:

- `GET    /api/health`
- `GET    /api/assembleias`
- `POST   /api/assembleias`
- `PATCH  /api/assembleias/:id/checklist/:index` *(dispara Slack se status=Concluído)*
- `GET    /api/assembleias/:id/roteiro`
- `POST   /api/assembleias/:id/roteiro/gerar` *(chama Anthropic)*
- `DELETE /api/assembleias/:id/roteiro`
- `GET    /api/procuracoes`
- `PATCH  /api/procuracoes/:id`
- `GET    /api/solicitacoes`
- `POST   /api/solicitacoes` *(multipart com uploads)*
- `GET    /api/solicitacoes/:id/docs/:filename`

## Regra de negócio importante

Edital só faz sentido para **AGE** e **AGO**. Para **RCF / RII / STD / RTD** a UI troca automaticamente o rótulo "Edital" por "Confirmação", e o alerta de pendência fala em "participação não confirmada" no lugar de "edital não enviado". A etapa 7 do checklist também se adapta — vira "Confirmar participação dos envolvidos".
