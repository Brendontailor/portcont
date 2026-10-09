# PortCont - Patch seguro de identidade visual

## Objetivo
Melhora logotipo de cabeçalho, símbolo e favicon. Mantém integralmente login/JWT, APIs, Prisma, banco, upload, comparação por nome, relatórios, navegação e permissões. **Este ZIP é um patch, não o projeto completo.**

## Aplicação
1. Crie um commit ou backup do seu projeto atual.
2. Extraia o ZIP na **raiz do projeto PortCont**, mesclando as pastas `app`, `components` e `public` e aceitando sobrescrita apenas dos arquivos listados abaixo.
3. Execute `npm ci`, `npm run typecheck`, `npm test` e `npm run build` no projeto com as dependências instaladas.
4. Confira cabeçalho, favicon e login; faça deploy somente depois.
5. Se o navegador mostrar o ícone antigo, force atualização da página e limpe o cache do favicon.

## Arquivos alterados
- `components/Header.tsx` (apenas logo no cabeçalho)
- `components/Header.module.css` (estilos de marca adicionados)
- `app/layout.tsx` (metadados de ícones do Next.js)

## Arquivos incluídos/substituídos
- `public/images/portcont/portcont-mark.svg` (marca compacta para navegação)
- `public/images/portcont/portcont-logo.svg` (logo horizontal)
- `public/images/portcont/favicon-32.png`
- `public/images/portcont/apple-touch-icon.png`
- `public/favicon.ico`

## Achados da auditoria do ZIP original
- `logo.png` tem 2172×724 px e ~1 MB, inadequado para favicon. Foi preservado no projeto original e deixa de ser usado no cabeçalho.
- O ZIP enviado contém `.env` e `.env.local`. **Não compartilhe esse ZIP publicamente**; se contiver credenciais reais, considere trocá-las. O patch não contém essas informações.
- O ZIP também contém logs de desenvolvimento, `tsconfig.tsbuildinfo` e uma pasta de versões antigas. O patch não os altera nem apaga do projeto, evitando excluir dados necessários acidentalmente.
- `.gitignore` já ignora `.env*`, logs e artefatos de build. Confira se algum já foi versionado (`git ls-files`).

## Escopo de validação
- Consistência de nomes e referências checada via análise estática.
- SVG/PNG/ICO gerados e abertos em verificação de arquivo.
- **Testes e build não foram executados** neste ambiente porque o ZIP não contém `node_modules`. Execute-os antes do deploy.

## Reversão
Restaure os três arquivos alterados do commit anterior; os novos recursos em `public` podem permanecer sem uso.
