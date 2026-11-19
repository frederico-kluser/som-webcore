# Rulesets — adaptação para mantenedor único

Este diretório é a **fonte da verdade** dos rulesets aplicados pelo `oss-enforce.sh`
(a cópia do projeto vence o asset da skill). Os JSONs foram adaptados ao estado
real do repositório: **um mantenedor** (`@frederico-kluser`).

## O que foi adaptado

| Regra original da skill | Estado neste repo | Por quê |
|---|---|---|
| `required_approving_review_count: 2` em `main` | **0** | O GitHub não permite autoaprovação; com 0 revisores, um PR de mantenedor único ficaria bloqueado para sempre |
| `require_code_owner_review: true` | **false** | O único owner é o autor do PR; a revisão de code owner não pode ser satisfeita por ele mesmo |
| `required_approving_review_count: 1` em `release/**` | **0** | Mesma razão; branches de release continuam protegidas por PR, linear history e squash/merge |
| `commit_message_pattern` (ruleset de commits) | **mantido no asset, mas provavelmente rejeitado no plano Free** | A regra de metadata é GitHub Enterprise; o mecanismo portátil é o hook `commit-msg` + o check `build` da CI |
| Files > 3 MB | **não aplicado** | As figuras e os PDFs de pesquisa são grandes; o `.gitignore` mantém PDFs fora do repo e as figuras têm < 1 MB |

## O que **não** foi relaxado

- `main` exige **PR**, `build` verde, **squash-only**, histórico linear, sem delete e sem force-push.
- Tags `v*` são **imutáveis**.
- Nomes de branch seguem `<tipo>/<slug>`; o GitHub rejeita o resto.
- O check `build` roda `scripts/check-docs.py` e valida as mensagens de commit.

## Quando apertar

Quando houver um segundo mantenedor com permissão de escrita:

1. subir `required_approving_review_count` para **1** (ou 2, se houver um time);
2. ligar `require_code_owner_review: true` **só** se o CODEOWNERS tiver um owner
   diferente do autor;
3. reconciliar com `bash scripts/oss-enforce.sh` (a cópia do projeto é a verdade).

> **Transparência:** esta é uma adaptação consciente, não um bypass silencioso. O
> objetivo é manter o cofre fechado para commits diretos sem tornar o projeto
> impossível de manter por uma pessoa.
