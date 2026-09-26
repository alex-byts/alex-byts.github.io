## Passo 1 — Estrutura do projeto e configuração inicial

Reorganizei o repositório para separar `public/` (conteúdo estático) de `functions/`
(Pages Functions), conforme exigido pelo Cloudflare Pages — as duas pastas precisam
ser irmãs na raiz, senão as Functions não são reconhecidas.

**Dificuldade:** o Build output directory estava vazio no painel do Cloudflare,
então o site continuava servindo o `index.html` antigo mesmo depois de mover os
arquivos. Corrigi apontando para `public` e forçando um novo deploy.