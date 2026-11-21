# Como contribuir com o SOM WebCore

Obrigado pelo interesse. Este guia explica **o que** dá para fazer hoje, **como** uma mudança entra no projeto e **qual barra** ela precisa passar.

> **English speakers:** issues and pull requests in English are welcome. The working language of the documentation is Brazilian Portuguese until v1.0; specifications and standards material are written in English.

Ao participar, você concorda com o [Código de Conduta](CODE_OF_CONDUCT.md).

**Leia primeiro:** [ROADMAP.md](ROADMAP.md) (o que está planejado e em que ordem) · [docs/METHODOLOGY.md](docs/METHODOLOGY.md) (como trabalhamos) · [docs/STRUCTURE.md](docs/STRUCTURE.md) (onde cada coisa vive) · [GOVERNANCE.md](GOVERNANCE.md) (quem decide).

---

## 1. Formas de contribuir

O projeto está na fase de planejamento auditado: **ainda não há código de runtime**. Isso não impede contribuições valiosas — várias das mais úteis não exigem escrever código.

| Forma | O que é | Por onde começar |
|---|---|---|
| **Conferir a pesquisa** | Achar um número inconsistente, uma citação que não abre, uma afirmação sem fonte primária | Abra uma issue “Research erratum” com a seção, a fonte primária e a data da consulta. Ver [research/ERRATA.md](research/ERRATA.md) |
| **Medir no seu dispositivo** | Rodar o harness de benchmark e enviar o relatório | A partir da atividade `P-11`. Um arquivo JSON por dispositivo em `bench/results/` |
| **Testar modelos** | Verificar se um checkpoint de decisão é compatível; conferir licença, arquitetura e paridade | Issue “Model compatibility report” |
| **Código** | Assumir uma atividade do roadmap | [Seção 2](#atividades) |
| **Documentação e tradução** | Corrigir, esclarecer, traduzir para inglês | PR direto para correções pequenas |
| **Padronização** | Comentar o explainer, apontar prior art, contar um caso de uso real | Issues com o rótulo `padronização` |
| **Segurança** | Reportar uma vulnerabilidade | **Nunca** em issue pública — siga o [SECURITY.md](SECURITY.md) |

---

<a id="atividades"></a>
## 2. Como assumir uma atividade do roadmap

O roadmap é um grafo de atividades com dependências. O processo:

1. **Escolha** uma atividade no [ROADMAP.md](ROADMAP.md) cujo estado seja `a fazer` e cujas dependências estejam **todas** `feito`. As ondas de execução listadas em cada marco mostram o que pode andar em paralelo.
2. **Procure a issue** com o ID no título (`[P-05] …`). Se não existir, abra uma usando o modelo “Roadmap task”.
3. **Avise** comentando na issue. Uma atividade tem um dono por vez; no máximo duas atividades em curso por pessoa.
4. **Confira se está pronta para começar**: o critério de aceite é verificável como está escrito? Se não for, o primeiro PR é a correção do roadmap.
5. **Trabalhe em PRs pequenos.** Uma atividade `L` costuma ser vários PRs; cada um deixa o `main` funcionando.
6. **Conclua** no PR que demonstra o critério de aceite: mude o estado da atividade na tabela e rode `python3 scripts/roadmap.py render`.

Sem notícias por 14 dias, a atividade volta a ficar disponível — sem ressentimento; basta avisar quando retomar.

Atividades marcadas `S` nas primeiras ondas de cada marco são boas portas de entrada.

---

## 3. Ambiente

### Hoje — fase de documentação

Só é preciso Git e Python 3.10 ou superior, sem pacotes extras:

```bash
git clone https://github.com/<seu-usuario>/som-webcore.git
cd som-webcore
git remote add upstream https://github.com/frederico-kluser/som-webcore.git

python3 scripts/check-docs.py      # contrato de documentação: links, âncoras, tabelas, DAG do roadmap
python3 scripts/roadmap.py check   # só o DAG
python3 scripts/roadmap.py waves   # o que pode andar em paralelo
```

Esses dois comandos são exatamente o que a CI executa. Se passam na sua máquina, passam lá.

### A partir da atividade `P-03` — fase de código

O workspace de código nasce na atividade `P-03`. As versões de Rust e de Node ficarão fixadas no próprio repositório (`rust-toolchain.toml`, `.nvmrc`), e este guia ganhará os comandos reais de build e teste no mesmo PR que os criar. Até lá, não há nada para compilar.

---

## 4. Como uma mudança entra

1. **Fork e branch.** Contribuidores externos trabalham num fork; mantenedores, numa branch efêmera do repositório principal.
2. **Nome da branch:** `<tipo>/<slug>`, com tipo de uma lista fechada e slug curto em kebab-case.

   | Tipo | Para quê | Exemplo |
   |---|---|---|
   | `feat` | funcionalidade nova | `feat/gemm-kernel` |
   | `fix` | correção | `fix/rope-theta-local` |
   | `docs` | documentação | `docs/errata-ettin` |
   | `perf` | desempenho | `perf/fused-geglu` |
   | `test` | testes | `test/tokenizer-parity` |
   | `refactor` · `style` · `build` · `ci` · `revert` · `hotfix` | como o nome diz | `ci/wasm-build` |

   No repositório principal, o GitHub recusa nomes fora desse padrão. Datas e nomes de pessoas não entram no slug.
3. **Commits Convencionais.** `tipo(escopo): descrição`, no imperativo, com no máximo 72 caracteres.

   ```text
   feat(core): add gemm kernel with parity test
   fix(docs): corrigir theta do RoPE local do Ettin
   docs(roadmap): marcar P-04 como feito
   feat(format)!: change manifest layout

   BREAKING CHANGE: arquivos .sombin v0 deixam de ser lidos.
   ```

   Tipos aceitos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. A CI valida as mensagens no job obrigatório `build`.
4. **Mantenha a branch atualizada por merge** — `git fetch upstream && git merge upstream/main`. **Nunca rebase, nunca force-push** numa branch com PR aberto: o histórico de revisão se perde, e o merge final é squash de qualquer forma.
5. **Abra o PR contra `main`.** O **título do PR é a mensagem do commit final** (squash), então segue a mesma convenção. Preencha o modelo: o quê, por quê, como, e a atividade do roadmap.
6. **Checks verdes e revisão.** Conversas resolvidas, CI verde.
7. **Squash merge** feito por um mantenedor; a branch é apagada.

Commits diretos em `main` são recusados pelo GitHub — vale para todo mundo, mantenedor incluído.

---

## 5. A barra, por tipo de mudança

| Se o PR… | Então precisa de… |
|---|---|
| toca um caminho numérico (kernel, referência CPU, quantização, tokenizador) | suíte de paridade verde; teste novo que cubra a mudança |
| alega ganho de desempenho | relatório antes e depois, gerado pelo harness, na mesma máquina; sem regressão acima de 5% em outro caminho |
| muda a API pública, o contrato de decisão, o formato `.sombin` ou o esquema do catálogo | [RFC](docs/METHODOLOGY.md#decisoes) aceita antes |
| faz uma escolha de arquitetura | [ADR](docs/METHODOLOGY.md#decisoes) no mesmo PR |
| acrescenta um número à documentação | [rótulo de evidência](docs/METHODOLOGY.md#rotulos) e fonte primária com data |
| corrige a pesquisa | entrada em `research/ERRATA.md`, marcação no relatório e correção do README no mesmo PR |
| adiciona um modelo ao catálogo | licença SPDX, revisão de origem, hashes e fonte datada da métrica de qualidade |
| adiciona uma dependência de runtime | justificativa: tamanho, licença, alternativa considerada |
| corrige um bug | teste de regressão que falha sem a correção |
| conclui uma atividade do roadmap | estado atualizado na tabela e `python3 scripts/roadmap.py render` |

Dois princípios resolvem a maioria das dúvidas: **paridade antes de velocidade** e **nenhuma otimização sem medição**. Um PR que deixa o código mais complexo sem relatório de ganho será recusado, por melhor que pareça.

---

## 6. Revisão

- Há um mantenedor; a resposta a um PR costuma levar alguns dias. PRs pequenos e focados andam mais rápido.
- A revisão procura, nesta ordem: corretude, evidência, simplicidade, aderência à estrutura, documentação.
- Discordar é normal. Traga dados — um teste, uma medição, uma fonte primária.
- Uma revisão pode pedir que a mudança vire RFC ou ADR. Não é burocracia: é o registro que permite a outra pessoa entender a decisão daqui a um ano.

---

## 7. Origem e licença das contribuições

- Tudo o que entra no repositório é licenciado sob **Apache-2.0**, a mesma licença do projeto.
- A partir da fase de código (atividade `P-03`), cada commit declara a origem com `Signed-off-by` — o [Developer Certificate of Origin 1.1](https://developercertificate.org/). Basta usar `git commit -s`. Não há CLA.
- Não copie código de projetos com licença incompatível. Ao **estudar** kernels de outros projetos (a seção 13.F do README lista onde olhar), traga o algoritmo e o layout de bits, com teste de paridade — não o arquivo.
- Pesos de modelos não entram no repositório.

---

## 8. Contribuições assistidas por IA

São aceitas, com a mesma barra de qualquer outra:

- quem abre o PR responde por ele — entende a mudança, rodou os testes, conferiu as afirmações;
- toda citação foi aberta; todo número tem rótulo e fonte;
- pesquisa gerada por IA entra como hipótese até ser verificada pelo [procedimento da metodologia](docs/METHODOLOGY.md#pesquisa). A auditoria que originou a errata deste repositório é o motivo da regra.

Agentes de código que operam no repositório seguem o `AGENTS.md`.

---

## 9. Reportar problemas

- **Bug:** modelo “Bug report”, com reprodução mínima, navegador e versão, sistema e dados do adaptador de GPU.
- **Erro na pesquisa ou na documentação:** modelo “Research erratum”.
- **Ideia:** modelo “Feature request” — ou uma discussão, se ainda estiver crua.
- **Vulnerabilidade:** só pelo canal privado descrito no [SECURITY.md](SECURITY.md).

---

## 10. Reconhecimento

- O changelog e as notas de release creditam cada mudança a quem a fez.
- Relatórios de benchmark e erratas aceitas contam como contribuição.
- Contribuição consistente numa área leva a convite para revisor — o caminho está em [GOVERNANCE.md](GOVERNANCE.md).
