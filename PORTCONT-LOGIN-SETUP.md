# PortCont - ativação do login

A autenticação já está implementada. O projeto **reutiliza o `JWT_SECRET` que já existe na Vercel**. Não crie outro e não substitua o valor atual apenas por causa do login.

## 1. Vercel

Mantenha as variáveis de produção que já existem, principalmente:

```env
DATABASE_URL=...
DIRECT_URL=...
JWT_SECRET=...
```

O `JWT_SECRET` atual será usado para assinar e validar a sessão do PortCont. Ele deve continuar secreto e não pode começar com `NEXT_PUBLIC_`.

**Não é necessário colocar `ADMIN_USERNAME` e `ADMIN_PASSWORD` na Vercel.** Eles servem somente para criar o primeiro usuário no Neon através do seed.

## 2. Aplicar a migration no Neon

No computador local, use um `.env` apontando para o mesmo Neon de produção e mantenha o `JWT_SECRET` já existente se for testar o login localmente:

```env
DATABASE_URL=...
DIRECT_URL=...
JWT_SECRET=<mesmo segredo já usado pelo PortCont>
```

Depois execute:

```bash
npm install
npm run db:generate
npm run db:deploy
```

Isso cria/atualiza a tabela `User`.

## 3. Criar o único usuário

Temporariamente, acrescente no `.env` **local**:

```env
ADMIN_USERNAME=<seu usuário>
ADMIN_PASSWORD=<sua senha inicial forte>
```

Execute:

```bash
npm run db:seed
```

O seed:

- preserva as 24 parceiras;
- cria apenas o primeiro usuário se ainda não existir;
- não duplica usuário;
- grava somente o hash `scrypt` da senha no Neon.

Depois que o usuário for criado, remova `ADMIN_USERNAME` e `ADMIN_PASSWORD` do `.env` local se desejar. O login normal **não depende** dessas duas variáveis.

## 4. O que fica permanentemente na Vercel

Para autenticação, somente o `JWT_SECRET` já existente precisa permanecer. O usuário e o hash da senha ficam no Neon.

Fluxo:

```text
/login
  ↓
usuário + senha digitados
  ↓
API consulta User no Neon
  ↓
valida o hash da senha
  ↓
cria cookie HttpOnly assinado com o JWT_SECRET existente
```

## 5. Deploy

Depois da migration e do seed:

1. faça commit/push;
2. deixe a Vercel redeployar;
3. acesse `/login`;
4. entre com o usuário/senha criados no seed.

## 6. Rotas protegidas

Exigem sessão:

- `/api/partners/*`
- `/api/periods/*`
- `/api/comparisons/*`
- `/api/reports/*`

Públicas:

- `/api/health`
- `/api/auth/login`
- `/api/auth/me` (responde 401 sem sessão)
- `/api/auth/logout`

As páginas internas também são protegidas pelo `middleware.ts`.
