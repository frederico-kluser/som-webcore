# Governança — SOM WebCore

> Quem decide o quê, e como alguém passa a decidir também.
> Complementa o [guia de contribuição](CONTRIBUTING.md) (o dia a dia) e a [metodologia](docs/METHODOLOGY.md) (como se trabalha).

## 1. Compromisso

O projeto existe para que a decisão local vire uma capacidade padrão dos navegadores (ver [ROADMAP.md](ROADMAP.md#valor)). A governança serve a esse fim:

- **Neutralidade.** O projeto não pertence a fornecedor de modelo, de navegador ou de nuvem. Nenhum modelo, formato ou backend tem privilégio na API por razão comercial.
- **Abertura.** Decisões que afetam quem usa o SDK são tomadas em público, por escrito, com tempo para comentar.
- **Dispensabilidade.** Uma implementação nativa nos navegadores é o resultado desejado, não uma ameaça. Decisões que dificultem essa transição são rejeitadas.

## 2. Papéis

| Papel | Quem é | O que pode | Como se chega lá |
|---|---|---|---|
| **Participante** | Qualquer pessoa que abre issue, comenta, testa ou envia benchmark | Propor, discutir, reportar | Participando |
| **Contribuidor** | Quem teve pelo menos um PR aceito | O anterior, e assumir atividades do roadmap | Um PR com merge |
| **Revisor de área** | Contribuidor com histórico numa área (`kernels`, `formato`, `sdk`, `modelos`, `benchmarks`, `padronização`, `docs`) | Aprovar PRs da sua área; é listado no `CODEOWNERS` | Convite de um mantenedor depois de contribuições consistentes na área — tipicamente 5 PRs relevantes ou 3 meses de revisão ativa |
| **Mantenedor** | Responsável pelo repositório | Fazer merge, publicar releases, fechar portões, aceitar RFCs, convidar revisores | Convite por consenso dos mantenedores, entre revisores de área ativos |

Hoje há **um mantenedor** ([@frederico-kluser](https://github.com/frederico-kluser)). Enquanto for assim:

- todo PR passa pelos checks obrigatórios e por squash merge, inclusive os do mantenedor;
- o mantenedor não precisa de aprovação externa para fazer merge, porque o GitHub não permite autoaprovação — mas RFCs e mudanças de critério de portão **esperam o período de comentários** mesmo assim;
- quando houver um segundo mantenedor, a exigência de aprovação sobe para 1 (o procedimento está em `.github/rulesets/README.md`).

Papéis não são vitalícios: quem fica 6 meses sem atividade passa a emérito, e volta quando quiser retomar.

## 3. Como se decide

| Tipo de decisão | Mecanismo | Quem fecha |
|---|---|---|
| Correção, teste, documentação, refatoração interna | PR com revisão | Revisor da área ou mantenedor |
| Escolha de arquitetura interna | [ADR](docs/METHODOLOGY.md#decisoes) no PR | Mantenedor |
| API pública, contrato de decisão, formato `.sombin`, esquema do catálogo, explainer | [RFC](docs/METHODOLOGY.md#decisoes) com período de comentários | Mantenedores, por consenso preguiçoso |
| Resultado de um portão do roadmap | ADR com a evidência contra cada critério | Mantenedores |
| Mudança de critério de portão | ADR **antes** da medição | Mantenedores |
| Entrada de modelo no catálogo | PR com licença, revisão, hashes e fonte da métrica | Revisor de `modelos` |
| Mudança nesta governança ou na licença | RFC com 30 dias de comentários | Todos os mantenedores |

**Consenso preguiçoso.** Uma proposta é aceita se, ao fim do período de comentários, não houver objeção fundamentada em aberto. Objeção fundamentada explica o problema e, de preferência, aponta um caminho. Silêncio é concordância.

**Quando não há consenso.** Os mantenedores decidem por maioria simples; com um único mantenedor, ele decide e registra o motivo na ADR ou na RFC. A decisão pode ser reaberta com evidência nova — não com insistência.

**Critério de desempate.** Entre duas opções tecnicamente defensáveis, vence a que: (1) mantém a API mais próxima de algo padronizável; (2) é mais simples para quem programa; (3) tem evidência medida; (4) é reversível.

## 4. Padronização

- A trilha S do roadmap é parte do projeto, não uma atividade paralela de alguém.
- Quem representa o projeto em grupos de padronização fala em nome do que está escrito no explainer e nas RFCs aceitas — posições novas voltam ao repositório antes de serem defendidas fora.
- Feedback de grupos de padronização é registrado em issues públicas com o rótulo `padronização`.
- O explainer e as especificações são escritos em inglês e licenciados de forma compatível com a contribuição a grupos do W3C.

## 5. Propriedade intelectual

- **Licença.** Código e documentação sob Apache-2.0. Contribuições entram sob a mesma licença (entrada = saída).
- **Origem das contribuições.** Cada commit de código declara a origem com `Signed-off-by` (Developer Certificate of Origin 1.1). Não há CLA.
- **Modelos.** O repositório não contém pesos. Cada entrada do catálogo declara a licença do modelo; o seletor padrão só admite licenças permissivas.
- **Nome e marca.** “SOM WebCore” identifica este projeto. Nomes de modelos, empresas e produtos de terceiros pertencem aos seus donos; o projeto não é afiliado a eles.

## 6. Conduta e conflitos

- Vale o [Código de Conduta](CODE_OF_CONDUCT.md).
- Desacordo técnico resolve-se com evidência, na issue ou no PR. Se travar, qualquer participante pode pedir a decisão de um mantenedor, que responde por escrito.
- Problema de conduta vai para o contato do Código de Conduta, não para issue pública.
- Vulnerabilidade de segurança segue o [SECURITY.md](SECURITY.md).

## 7. Transparência

- Roadmap, ADRs, RFCs, relatórios de portão e errata da pesquisa são públicos e versionados.
- O projeto não recolhe telemetria de quem usa o SDK.
- Patrocínio ou financiamento, se existir, é declarado no README e não compra prioridade no roadmap nem lugar no catálogo.
