## Caso 1: retorno sem cookie temporário

- **Preparação:** iniciado o login com Google (/oauth/login/google) em uma janela normal do navegador, interrompendo o fluxo na tela de escolha de conta do Google (antes de conceder o consentimento). A URL de autorização do Google foi copiada nesse ponto.
- **Pedido enviado:** a mesma URL de autorização foi colada em uma janela anônima (sem o cookie __Host-oauth-tx que havia sido definido na janela original), e o login foi concluído normalmente do lado do Google.
- **Resultado esperado:** a rota de retorno deve recusar a resposta por falta do cookie de transação, sem criar sessão.
- **Resultado observado:** a rota de retorno respondeu "Transação ausente", e nenhuma sessão foi criada. Comportamento conforme esperado.

## Caso 2: state alterado

- **Preparação:** iniciado o login com Google (/oauth/login/google), gerando uma transação válida e o cookie __Host-oauth-tx no navegador. O fluxo foi interrompido antes de conceder consentimento ao Google.
- **Pedido enviado:** acessada manualmente a rota de retorno (/oauth/callback/google) com valores de code e state inventados, mantendo o cookie de transação da etapa anterior.
- **Resultado esperado:** a rota de retorno deve recusar a resposta antes de trocar o código, por não corresponder o state ao valor registrado na transação.
- **Resultado observado:** a rota respondeu "State inválido". Comportamento conforme esperado.
## Caso 3: reutilização da transação

- **Preparação:** concluído um login com Google até a criação da sessão. A URL de retorno bem-sucedida (/oauth/callback/google?code=...&state=...) foi copiada a partir da aba Network do navegador.
- **Pedido enviado:** a mesma URL de retorno foi reaberta em uma nova aba do mesmo navegador.
- **Resultado esperado:** a transação já terá sido removida do D1 e a repetição deverá falhar.
- **Resultado observado:** a rota respondeu "Transação ausente". Isso ocorre porque o próprio processamento bem-sucedido do primeiro callback já limpa o cookie __Host-oauth-tx do navegador (parte do fluxo normal de finalização), então a segunda tentativa é barrada antes mesmo de consultar a linha da transação no banco — que também já teria sido apagada. A reutilização, de qualquer forma, é impedida com sucesso.
## Caso 4: sessão expirada

- **Preparação:** concluído um login (Google), com sessão ativa e válida.
- **Pedido enviado:** executado UPDATE sessions SET expires_at = 0; no console do banco D1, seguido de recarregamento da página (F5).
- **Resultado esperado:** /api/me deve responder 401, e a página deve indicar que não há sessão.
- **Resultado observado:** a página exibiu "Nenhuma sessão neste navegador.", com os links de login visíveis novamente. Comportamento conforme esperado.
## Caso 5: origem inválida na saída

- **Preparação:** com uma sessão válida aberta em https://alex-byts-github-io.pages.dev, foi aberta uma aba em outra origem (instagram.com).
- **Pedido enviado:** executado no console dessa outra origem: fetch("https://alex-byts-github-io.pages.dev/oauth/logout", { method: "POST", credentials: "include" }).
- **Resultado esperado:** a rota deve recusar a operação por origem inválida.
- **Resultado observado:** a requisição foi bloqueada pelo próprio navegador antes de sair da máquina, por violar a Content Security Policy (CSP) definida pelo site de origem (instagram.com), com a mensagem "Refused to connect because it violates the document's Content Security Policy". Isso demonstra uma camada de defesa do navegador atuando antes mesmo de a checagem de Origin do nosso backend (logout.js) precisar ser exercitada — ambas as camadas, em conjunto, impedem o ataque.
**
## Caso 6: reutilização do cookie revogado

- **Preparação:** com uma sessão válida criada após o login com Google, foi copiado temporariamente o valor do cookie `__Host-session` pelas ferramentas de desenvolvimento do navegador.

- **Pedido enviado:** realizado o logout normalmente pela aplicação. Em seguida, o mesmo valor do cookie `__Host-session` foi restaurado no navegador e foi feita uma nova consulta à rota `/api/me`.

- **Resultado esperado:** a rota `/api/me` deve responder `401`, pois a sessão correspondente ao cookie já foi removida do banco D1 durante o logout.

- **Resultado observado:** a rota `/api/me` respondeu `401` e a aplicação indicou que não havia sessão ativa. O cookie revogado não conseguiu restaurar a sessão. Comportamento conforme esperado.
