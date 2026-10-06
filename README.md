# PortCont

Sistema web para comparação inteligente de bases de clientes.

## O que é

O **PORTCONT** compara duas bases de clientes (PDF, XLSX, XLS, CSV) e identifica:
- Clientes existentes em ambas as bases
- Clientes apenas na Base A
- Clientes apenas na Base B
- Nomes semelhantes que precisam de revisão humana

O sistema usa **fuzzy matching** avançado para detectar variações de escrita (ex: "ARTUR" vs "ARTHUR", "FERREIRA" vs "FEREIRA").

## Arquitetura

```
portcont/
├── app/                    # Next.js App Router (frontend)
├── components/             # React components
├── services/               # API client
├── types/                  # TypeScript types
├── utils/                  # Helpers
├── api/                    # Vercel Serverless entry point
├── backend/                # Express backend (modular)
│   └── src/
│       ├── app.ts          # Express app
│       ├── server.ts       # Local dev server
│       ├── config/         # Environment config
│       ├── lib/            # Prisma client
│       ├── middlewares/    # Express middlewares
│       └── modules/        # Feature modules
│           ├── comparisons/
│           ├── parsers/
│           ├── matching/
│           ├── equivalences/
│           ├── export/
│           ├── partners/
│           ├── periods/
│           ├── reports/
│           └── storage/
├── prisma/                 # Database schema
├── tests/                  # Unit tests
├── package.json
├── next.config.ts
├── tsconfig.json
├── vercel.json
└── .env.example
```

## Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Express, TypeScript, ES Modules
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Deploy**: Vercel (single deployment)
- **Tests**: Vitest

## Requisitos

- Node.js 18+
- npm
- Conta no Neon (PostgreSQL)
- Conta na Vercel (opcional, para deploy)

## Configuração

### 1. Clonar e instalar

```bash
cd portcont
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

```env
# Database (Neon)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Matching
MATCH_THRESHOLD=95
REVIEW_THRESHOLD=85

# Upload
MAX_UPLOAD_MB=15

# Storage (Vercel Blob - opcional)
BLOB_READ_WRITE_TOKEN=""
```

### 3. Neon PostgreSQL

1. Crie um projeto no [Neon](https://neon.tech)
2. Copie a connection string (pooled)
3. Defina `DATABASE_URL` e `DIRECT_URL` no `.env`
4. Execute as migrations:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Desenvolvimento

```bash
# Terminal 1: Frontend + API (Next.js)
npm run dev

# Terminal 2: Backend Express (opcional, para debug)
npm run dev:backend
```

Acesse: http://localhost:3000

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # Build para produção
npm run start        # Inicia servidor de produção
npm run test         # Roda testes
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run db:generate  # Gera Prisma Client
npm run db:migrate   # Roda migrations (dev)
npm run db:deploy    # Deploy migrations (prod)
npm run db:studio    # Prisma Studio
```

## Deploy na Vercel

1. Conecte o repositório GitHub à Vercel
2. Configure as variáveis de ambiente no painel da Vercel
3. Deploy automático

O `vercel.json` já configura:
- Next.js para o frontend
- Express como Serverless Function em `/api/index.ts`
- Runtime Node.js 18.x (necessário para Prisma)

## Estrutura de Dados

### Parceira → Competência → Comparação

```
RG Sul
└── 2026
    ├── Janeiro
    │   └── Comparação #1
    ├── Fevereiro
    │   └── Comparação #1
    └── Outubro
        ├── Comparação #1 (inicial)
        ├── Comparação #2 (revisão)
        └── Comparação #3 (fechamento)
```

Cada comparação pertence a uma **Parceira** e **Competência (mês/ano)**.

## Matching Inteligente

### Normalização
- Remove prefixos conhecidos (RGSUL -, REDE RGSUL -)
- Remove acentos, pontuação, espaços extras
- Converte para maiúsculas

### Algoritmo
Combina múltiplos fatores:
- Jaro-Winkler (similaridade de strings)
- Levenshtein (distância de edição)
- Token set similarity (interseção de palavras)
- Token order (ordem das palavras)
- Primeiro nome / último sobrenome
- Penalizações por conflitos semânticos

### Thresholds
- **≥ 95**: MATCHED (automático)
- **85-94**: REVIEW (revisão humana)
- **< 85**: DIFFERENT

### Proteções
- Primeiro nome diferente → penalização forte
- Último sobrenome diferente → penalização
- Nomes curtos (≤2 palavras) → threshold mais alto
- Tokens conflitantes → penalização
- Matching 1:1 (uma base B não matcha duas base A)

## Parsers

### PDF
Extrai nomes de arquivos SmartOLT:
- Remove cabeçalhos, rodapés, paginação
- Reconhece nomes quebrados em múltiplas linhas
- Identifica e ignora identificadores técnicos (HWTC, FHTT, MAC, IP, etc.)
- Detecta PDFs incompletos ("1-100 ONUs de 295 exibidas")

### Excel/CSV
- Detecta automaticamente coluna de nome por header ou conteúdo
- Confidence scoring para seleção automática
- Suporta: Nome, Cliente, Assinante, Subscriber, Customer, Razão Social

## API Endpoints

```
GET  /api/health
GET  /api/partners
POST /api/partners
GET  /api/partners/:id
PATCH /api/partners/:id
DELETE /api/partners/:id

GET  /api/periods/:partnerId
GET  /api/periods/:partnerId/:year/:month
POST /api/periods/:partnerId/:year/:month

GET  /api/comparisons
GET  /api/comparisons/:id
POST /api/comparisons (multipart: fileA, fileB, periodId, title?)
POST /api/comparisons/:id/review/:entryId (body: { samePerson: boolean })
DELETE /api/comparisons/:id

GET  /api/reports/comparisons/:id
GET  /api/reports/comparisons/:id/xlsx
GET  /api/reports/monthly/:partnerId/:year/:month
GET  /api/reports/monthly/:partnerId/:year/:month/xlsx
GET  /api/reports/annual/:partnerId/:year
GET  /api/reports/annual/:partnerId/:year/xlsx
```

## Testes

```bash
npm run test
```

Testes incluídos:
- Normalização de nomes
- Fuzzy matching (Artur/Arthur, Ferreira/Fereira, etc.)
- Parsers (PDF multi-linha, Excel, CSV)
- Identificadores técnicos rejeitados
- Deduplicação
- Matching 1:1

## Exportação

Relatórios em XLSX com abas:
- Resumo
- Base A / Base B
- Correspondências
- Somente A / Somente B
- Revisar

Relatórios mensais e anuais consolidados.

## Troubleshooting

### Prisma Client não gerado
```bash
npm run db:generate
```

### Erro de conexão Neon
- Verifique `DATABASE_URL` e `DIRECT_URL`
- Confirme IP permitido no Neon
- Use `DIRECT_URL` para migrations

### Build falha na Vercel
- Confirme `vercel.json` com `functions.api/index.ts`
- Runtime deve ser `nodejs18.x` (não Edge)
- `@prisma/client` em `serverComponentsExternalPackages`

### PDF não extrai nomes
- Verifique se o PDF é texto (não imagem)
- Logs mostram linhas ignoradas e clientes encontrados
- Ajuste `PREFIXES_TO_REMOVE` em `normalizeName.service.ts`

## Limitações Conhecidas

- PDFs baseados em imagem (scanned) não são suportados
- Requer Vercel Blob para persistência de arquivos originais
- Matching conservador pode deixar alguns casos em REVIEW
- Máximo 15MB por arquivo

## Licença

Proprietary - Uso interno.