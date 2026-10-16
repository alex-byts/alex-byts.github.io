# Avaliação: GitHub Actions com IA

**Dupla:** Alexandre Salvario Sontag e Eduardo Alves Texeira\
**Repositório:**
[alex-byts/alex-byts.github.io](https://github.com/alex-byts/alex-byts.github.io)

## Tarefa 1: CI a cada commit

-   **Execução verde** (`ci #5`, na `main`):
    <https://github.com/alex-byts/alex-byts.github.io/actions/runs/38321894788>
-   **Execução vermelha** (ramificação `migracao-0002`, PR #1):
    <https://github.com/alex-byts/alex-byts.github.io/actions/runs/38324609839/job/115060278824>
-   **Linha do log com o erro:**
    `Parse error near line 1: near "TABL": syntax error`
-   **Por que testar a migração em SQLite antes do D1:** testar a
    migração localmente permite detectar erros de sintaxe rapidamente,
    sem custo e sem alterar o banco remoto, onde uma migração mal
    escrita pode ser difícil de reverter.

## Tarefa 2: `main` protegida

-   **PR bloqueado e depois liberado** (mesmo PR #1, `migracao-0002`):
    <https://github.com/alex-byts/alex-byts.github.io/pull/1>
    -   **Bloqueado:** o botão de merge ficou desabilitado, com
        `ci / verificar (pull_request)` e `ci / verificar (push)`
        falhando e marcados como **Required**.
    -   **Liberado:** depois da correção do `0002`, os dois checks
        `verificar` ficaram verdes e o botão de merge foi habilitado.
-   **Saída do `git push` direto na `main`, recusado:**

``` text
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Changes must be made through a pull request.
remote: - Required status check "verificar" is expected.
 ! [remote rejected] main -> main (push declined due to repository rule violations)
```

## Tarefa 3: revisão por IA

-   **Workflow `revisao-ia.yml` colocado na `main` pelo PR #2** (a IA
    revisou o próprio PR):
    <https://github.com/alex-byts/alex-byts.github.io/pull/2>
-   **PR #1 também recebeu a revisão da IA antes do merge:**
    <https://github.com/alex-byts/alex-byts.github.io/pull/1>
-   **PR com SQL vulnerável e os dois comentários da IA:** \[PREENCHER
    COM O LINK DO PR\]
-   **PR de teste sem permissão para comentar** (removido `pull-requests: write`):
    <https://github.com/alex-byts/alex-byts.github.io/pull/5>
-   **Trecho do log que comprova a falha de permissão:**

``` text
GraphQL: Resource not accessible by integration (addComment)
Error: Process completed with exit code 1.
```

### Afirmação da IA errada ou irrelevante e por quê

No PR #2, a IA afirmou (achado 5, nível Baixo) que o workflow instala o
Copilot CLI, mas não o executa, e que a instalação parecia
desnecessária. Isso está errado: a ação `actions/ai-inference@v3` chama
o `copilot` internamente, e o log da execução mostra
`Running Copilot CLI: copilot -p <prompt> -s --no-ask-user`. Sem o passo
de instalação, a ação falharia. A IA também apontou (achado 2) que o
`COPILOT_PAT` não fica disponível em PRs de fork. Isso é verdade, mas
irrelevante neste caso, pois os PRs foram criados a partir de
ramificações do próprio repositório. A IA analisou o texto do workflow
sem considerar como a ação funciona internamente e apresentou essa
conclusão com a mesma segurança de achados corretos, como o alerta de
que `head -c 20000` corta diffs grandes sem avisar.

### Problemas encontrados ao configurar

-   Com `actions/ai-inference@v1` (tag antiga, que usa GitHub Models), a
    execução falhou com
    `Error: API error: TypeError: Cannot use 'in' operator to search for 'choices' in OK`.
    A solução foi usar `@v3`, versão que usa o Copilot CLI.
-   Com `@v3` e o modelo padrão, o log de debug mostrou
    `Model "gpt-4.1" from --model flag is not available`. A solução foi
    passar `model: ''` para o Copilot CLI escolher um modelo disponível
    no plano.

## Tarefa 4: migrações D1 depois do merge

-   **Execução do merge que alterou `migrations/`** (`migrar #2`):
    <https://github.com/alex-byts/alex-byts.github.io/actions/runs/38822522461>
-   **Saída de `PRAGMA table_info(sessions);` no D1 remoto:**

``` text
cid | name         | type    | notnull | dflt_value | pk
0   | id_hash      | TEXT    | 0       | null       | 1
1   | issuer       | TEXT    | 1       | null       | 0
2   | subject      | TEXT    | 1       | null       | 0
3   | email        | TEXT    | 0       | null       | 0
4   | display_name | TEXT    | 0       | null       | 0
5   | expires_at   | INTEGER | 1       | null       | 0
6   | created_at   | INTEGER | 1       | null       | 0
7   | user_agent   | TEXT    | 0       | null       | 0
```

-   **Segundo merge sem tocar em `migrations/`** (PR #3, que alterou
    somente o README):
    <https://github.com/alex-byts/alex-byts.github.io/pull/3>
    -   O merge gerou `ci #22` (commit `7a48668`) e
        `pages build and deployment #48`.
    -   Não houve execução do workflow `migrar` para esse commit: a
        execução mais recente continua sendo `migrar #2`, referente ao
        merge do PR #1. O filtro `paths: ['migrations/**']` funcionou.

## Bônus (opcional)

Não realizado.

## Perguntas

### 1. O `ci.yml` roda duas vezes ao fazer push numa ramificação com PR aberto. Por quê, e qual execução o status check da `main` considera?

O `ci.yml` tem dois gatilhos: `push` (que dispara em qualquer
ramificação) e `pull_request` para a `main`. Com um PR aberto, cada push
dispara os dois. No PR apareceram `ci / verificar (push)` e
`ci / verificar (pull_request)`, e ambos estavam marcados como
**Required**, porque a regra exige o check pelo nome `verificar`. Na
prática, os dois precisam passar para liberar o merge.

### 2. Por que um PR vindo de um fork não consegue usar `secrets.COPILOT_PAT`? Qual ataque essa regra impede?

O GitHub não entrega os segredos do repositório de destino a workflows
disparados por PRs de fork. Se entregasse, alguém poderia abrir um PR
com um workflow ou código alterado que imprimisse ou enviasse os
segredos para fora (exfiltração), pois esse código seria executado com
acesso ao `COPILOT_PAT` e ao token da Cloudflare.

### 3. Por que o workflow da Tarefa 3 declara `permissions` em vez de usar as permissões padrão do `GITHUB_TOKEN`?

Para seguir o princípio do menor privilégio: o workflow só precisa ler o
código (`contents: read`) e comentar no PR (`pull-requests: write`). As
permissões padrão podem ser mais amplas, dependendo da configuração do
repositório. Se o workflow ou uma ação for comprometida, o token terá
menos poderes do que teria com permissões excessivas. Isso importa
especialmente aqui, porque o diff do PR é uma entrada não confiável
enviada ao modelo, e a própria IA apontou esse risco no PR #2.

### 4. A revisão da IA pode substituir o status check da Tarefa 2? Justifique com o que observou no item 4 da Tarefa 3.

Não. No PR #2, a IA errou com segurança ao dizer que o Copilot CLI era
instalado, mas não executado, o que é falso. Ela misturou isso com
achados corretos; no PR #1, também não apontou problemas. Isso demonstra
que a revisão por IA pode errar, deixar passar problemas e variar entre
análises. Além disso, o comentário da IA não bloqueia o merge: no PR #2,
o workflow `revisao-ia` chegou a falhar e o botão de merge continuou
liberado, porque somente o check `verificar` era obrigatório. O status
check é a barreira exigida pela regra da `main`; a IA funciona como
segunda opinião, não como substituta da verificação automatizada.
