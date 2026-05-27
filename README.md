# Seazone — Gestão de Assembleias de SPEs

Sistema interno para o time Jurídico/PMO da Seazone gerenciar assembleias de SPEs (Sociedades de Propósito Específico), com login corporativo, rota pública de solicitação e integrações Slack/Anthropic.

Hackathon Seazone 2026.

## O que faz

- **Dashboard** com filtros (Responsável / Criticidade / Status), views **Lista** (agrupada por mês) e **Kanban** (por status do checklist), com divisória entre futuras e realizadas
- **Estatísticas** consolidadas — números agregados + gráfico por mês + breakdown por responsável e por tipo
- **Checklist pré-assembleia** de 7 etapas por assembleia, com integração Slack (dispara mensagem Block Kit quando uma etapa é concluída)
- **Roteiro de assembleia gerado por IA** — formulário vira roteiro formatado pronto pra ler em voz alta (Claude 3.5 Sonnet)
- **Formulário público `/solicitar`** — sem login, qualquer área da empresa pode pedir uma assembleia com upload de documentos por pauta
- **Controle de procurações** — tabela editável inline com os 22 empreendimentos, link ACS, sócios, status
- **Dark mode** + tipografia editorial (Fraunces + Inter Tight) + paleta warm

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v3 + `@react-oauth/google`
- **Backend**: Node 18+ + Express + TypeScript via `tsx`
- **Auth**: Google Identity Services + JWT em cookie httpOnly
- **Persistência**: arquivos JSON locais em `backend/data/`
- **IA**: Anthropic SDK (`claude-3-5-sonnet-20241022`)
- **Slack**: webhooks Block Kit

## Estrutura

```
backend/         Express + JSON storage + auth + Slack/Anthropic
backend/src/     Código TypeScript
backend/data/    JSONs (gitignored, recriados via seed)
backend/src/seed-assembleias.json  Snapshot inicial das 41 assembleias
frontend/        Vite + React UI
render.yaml      Blueprint pro Render (1 serviço com persistent disk)
```

## Desenvolvimento local

Pré-requisitos: **Node.js 18+**.

```bash
cd backend && npm install
cd ../frontend && npm install

# Em terminais separados:
cd backend && npm run dev      # porta 3001
cd ../frontend && npm run dev  # porta 5173
```

Abra `http://localhost:5173`. A rota pública fica em `/solicitar`.

> **Sem auth configurada localmente:** se `GOOGLE_CLIENT_ID` não estiver no `.env` do backend, a tela de login é pulada (modo dev). Pra testar o fluxo de login, configure as variáveis (ver seção abaixo).

## Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Obrigatória? | Para que serve |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Em produção | OAuth Client ID criado no Google Cloud Console |
| `SESSION_SECRET` | Em produção | String aleatória 32+ chars pra assinar o JWT da sessão |
| `ALLOWED_DOMAINS` | Recomendado | Domínios permitidos, ex: `seazone.com.br` (vírgula-separado) |
| `ALLOWED_EMAILS` | Opcional | Emails específicos além dos domínios |
| `CORS_ORIGIN` | Em produção | URL do frontend, ex: `https://seazone-assembleias.onrender.com` |
| `SLACK_WEBHOOK_URL` | Opcional | Webhook do canal `#assembleias` no Slack |
| `ANTHROPIC_API_KEY` | Opcional | Habilita "Gerar Roteiro com IA" |
| `PORT` | Opcional | Porta do servidor (default 3001) |

### Frontend (`frontend/.env`)

| Variável | Obrigatória? | Para que serve |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Em produção | Mesmo valor de `GOOGLE_CLIENT_ID` do backend |

## Deploy no Render (recomendado)

### 1. Suba o código pro GitHub

```bash
cd ~/Downloads/seazone-assembleias
git remote set-url origin https://github.com/seazone-tech/assembleias-spe.git
git push -u origin main
```

(Crie o repo `assembleias-spe` no org `seazone-tech` antes — vazio, sem README. Ou use `gh repo create seazone-tech/assembleias-spe --private --source=. --push`.)

### 2. Crie o OAuth Client no Google Cloud Console

1. Acesse https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://seazone-assembleias.onrender.com` (prod — ajuste pra URL final)
5. Authorized redirect URIs: pode deixar vazio (usamos só Sign-In with One Tap)
6. Copie o **Client ID** gerado

### 3. Deploy no Render

1. Crie conta em https://render.com (usando GitHub do org `seazone-tech`)
2. **New → Blueprint** → selecione o repositório `seazone-tech/assembleias-spe`
3. O `render.yaml` é detectado e cria 1 Web Service + 1 Disk (1 GB free)
4. No painel do serviço, configure as env vars marcadas como `sync: false`:
   - `GOOGLE_CLIENT_ID`: o Client ID do passo 2
   - `ALLOWED_DOMAINS`: `seazone.com.br`
   - `ALLOWED_EMAILS`: (opcional) emails externos autorizados
   - `SLACK_WEBHOOK_URL`: (opcional)
   - `ANTHROPIC_API_KEY`: (opcional)
   - `SESSION_SECRET`: deixe — o Render gera automaticamente
5. Adicione no frontend (em **Environment**):
   - `VITE_GOOGLE_CLIENT_ID`: mesmo valor do backend
6. Hit **Deploy**. Em ~3 min está no ar em `https://seazone-assembleias.onrender.com`

### 4. (Opcional) Volte ao Google Console e atualize as origins autorizadas

Depois do primeiro deploy, ajuste o **Authorized JavaScript origins** do OAuth Client com a URL final do Render.

## Rotas da API

Públicas:
- `GET /api/health`
- `GET /api/auth/me` — retorna usuário atual ou null
- `POST /api/auth/google` — recebe credential do Google Sign-In
- `POST /api/auth/logout`
- `POST /api/solicitacoes` — formulário público `/solicitar` (com upload)
- `GET /api/solicitacoes/:id/docs/:filename` — download de anexo

Protegidas (exigem cookie de sessão):
- `GET    /api/assembleias`
- `POST   /api/assembleias`
- `PATCH  /api/assembleias/:id/checklist/:index`
- `GET    /api/assembleias/:id/roteiro`
- `POST   /api/assembleias/:id/roteiro/gerar`
- `DELETE /api/assembleias/:id/roteiro`
- `GET    /api/solicitacoes`
- `GET    /api/procuracoes`
- `PATCH  /api/procuracoes/:id`
- `POST   /api/admin/reset-seed`

## Regra de negócio

Edital só faz sentido para **AGE** e **AGO**. Para **RCF / RII / STD / RTD** a UI troca automaticamente o rótulo "Edital" por "Confirmação" e o checklist adapta a etapa 7 para "Confirmar participação dos envolvidos".

## Fluxo de uso

1. **Time interno** (`seazone.com.br`) acessa a URL pública, clica em "Entrar com Google", vê o dashboard.
2. **Áreas externas** (Engenharia, Financeiro, etc.) recebem o link `/solicitar` por Slack/email, preenchem o formulário sem precisar de login, anexam os documentos por pauta.
3. Cada solicitação cai na aba **Solicitações** do dashboard interno + notifica o canal `#assembleias` do Slack.
4. O time abre a assembleia, percorre as 7 etapas do checklist (cada conclusão dispara mensagem automática no Slack), gera o roteiro de leitura via IA, imprime/exporta o checklist em PDF.
