# RFC-0001 — Contrato de decisão v0

- **Estado:** proposta — período de comentários de 7 dias (regra antes da v0.5, [metodologia, seção 9](../METHODOLOGY.md#decisoes)), aberto em 2026-11-23; aceitação pelo mantenedor, por consenso preguiçoso ([governança](../../GOVERNANCE.md)).
- **Atividade:** `P-02` do [roadmap](../../ROADMAP.md#m1).
- **Implementação de referência:** [`packages/core`](../../packages/core) — tipos em [`packages/core/types/`](../../packages/core/types/index.d.ts), JSON Schema em [`packages/core/schema/questions.schema.json`](../../packages/core/schema/questions.schema.json).
- **Superfície normativa:** [`docs/spec/decisions-api-surface.md`](../spec/decisions-api-surface.md) (`T-05`). Esta RFC não acrescenta nenhum nome a ela.

**Fontes**, com as etiquetas da especificação: **I160** — o código do Chrome 160.0.8174.2 (`third_party/blink/renderer/modules/ai/decision_model.{idl,cc}`, `chrome/browser/ai/*`), o build de referência; **I157** — o mesmo no Chrome 157.0.8103.79; **RT** — as capturas da página de conformidade em `bench/results/2026-11-21-surface-*.json` (Chrome Canary 160.0.8174.2 no Windows e 160.0.8176.2 no macOS); **EX** — o explainer `explainers-by-googlers/decisions-api`, commit `5ce6e10a81f766efaec670282696c0c57ba2de50`; **CR** — o código do Chromium no commit `a9cb86f5` (Canary 160.0.8179.0), lido em 2026-11-23 e resumido em [O padrão na prática](../../ROADMAP.md#padrao-pratica) e na [pesquisa 03](../../research/03-modelos-maiores-sem-travas-de-memoria.md).

---

## 1. Motivação

A API pública deste projeto é a Decisions API do Chrome, sem nomes próprios ([Padrão de uso e de chamada](../../ROADMAP.md#padrao-chamada)). A `T-05` fixou a **forma**; falta fixar o **comportamento**: o que a biblioteca faz em volta da forma para que o mesmo código rode, sem mudar uma linha, sobre o `DecisionModel` nativo e sobre a biblioteca — validação, estados de disponibilidade, download com gesto do usuário, `monitor`, `preference`, erros, e o ciclo de vida da memória, que é onde a bancada do marco T falhou no iPhone ([ADR 0005](../adr/0005-replanejamento-capacidade-e-memoria.md)). Falta também dizer o que fica de fora da superfície (catálogo, orçamento, licenças) e como cada pergunta vira a entrada de cada formato de modelo.

## 2. Proposta

### 2.1 A superfície

A da especificação, sem acréscimos: `DecisionModel.availability()`, `DecisionModel.create()`, `decide()`, `destroy()` e `preference`; os dicionários, enums e o resultado indexado pelo `id` da pergunta. O módulo exporta `DecisionModel`: **o nativo, quando a página tem um** (a biblioteca nunca se instala por cima), e o da biblioteca nos outros casos. A aplicação escreve o mesmo código nos dois.

O **perfil de versão** é o Chrome 160 (I160): `score` com 2 a 11 níveis, `context` ignorado (o 157 o aceitava; o 160 o removeu e, como membro desconhecido de um dicionário WebIDL, ele é ignorado), e o `devTrialBackend` do Dev Trial convertido como o 160 converte — valor fora do enum é `TypeError`; `"language-model"` dá `"unavailable"`, porque a biblioteca não tem um modelo de linguagem; os outros três valores são atendidos pelo modelo da biblioteca. Nenhum dos dois membros entra nos tipos (especificação, seção 3).

### 2.2 O comportamento do Chrome

| Comportamento | Regra | Fonte |
|---|---|---|
| Conversão das opções | dicionários WebIDL, membros em ordem lexicográfica (os herdados primeiro): membro obrigatório ausente ou valor fora do enum é `TypeError` com o caminho (“Failed to read the 'type' property from 'DecisionModelQuestion': …”) | I160, RT |
| Validação do esquema | a `ValidateQuestions` do Blink, com as mesmas mensagens: 1 a 16 perguntas; `id` e `prompt` não vazios (sem contar espaços); `id` único; `boolean` sem opções (lista vazia aceita); `choice` com 2 a 26 opções; `score` com 2 a 11 níveis quando houver opções (lista vazia conta); `label` não vazio e único na pergunta | I160 (`ValidateQuestions`), RT |
| Prefixo das mensagens | `Failed to execute 'availability' on 'DecisionModel': ` (ou `'create'`, `'decide'`) | RT |
| Idiomas | tag BCP 47 inválida é `RangeError` “Invalid language tag: …”; idioma que o modelo não cobre dá `"unavailable"`; o TS-Ettin declara só inglês, como o backend padrão do Chrome | I160, RT |
| Modalidade | `expectedInputs[].type` diferente de `"text"`: `availability()` → `"unavailable"`; `create()` → `NotSupportedError` “Only 'text' expectedInputs modality is currently supported.” | I160, RT |
| `availability()` | `questions` pode faltar; quatro estados: `"available"` (o degrau escolhido está verificado no cache local, sem rede), `"downloadable"` (cabe no aparelho e na política, mas não está no cache), `"downloading"` (download em curso), `"unavailable"` (nada cabe, idioma ou modalidade sem suporte) | I160, EX, RT |
| `create()` sem gesto | com o modelo `"downloadable"` ou `"downloading"` e sem ativação transitória do usuário → `NotAllowedError` “Requires a user gesture when availability is "downloading" or "downloadable".”; nada é baixado. A ativação é lida no momento da chamada | I157, I160, RT |
| `monitor` | o callback é chamado **antes** da verificação do gesto (RT: lista de eventos vazia na recusa); eventos `downloadprogress` com `total` = 1 e `loaded` de 0 a 1, crescentes, o primeiro 0 e o último 1, mesmo quando o modelo já estava no cache | RT |
| `signal` | `create()` com sinal abortado rejeita com o `reason` do sinal; abortar durante o download desiste da espera dessa chamada, sem cancelar o download partilhado | EX; a mensagem do Chrome nesse caso não foi capturada |
| `decide()` | entrada em branco → `TypeError` “DecisionModel.decide() input cannot be empty.”; sinal abortado ou sessão destruída → `AbortError` “signal is aborted without reason”, com o prefixo de `'decide'` | I160, RT |
| Entrada grande demais | `QuotaExceededError`; nada é truncado. O limite é do modelo, em tokens (8.192 no TS-Ettin) | I160 (mapeamento de erros); CR: o backend padrão aceita até 8.192 caracteres |
| `new DecisionModel()` | `TypeError` “Failed to construct 'DecisionModel': Illegal constructor”; `DecisionModel.length` 0; métodos e atributo enumeráveis; `Symbol.toStringTag` `"DecisionModel"` | RT |
| Resultado | um decodificador para todos os modelos: notas negativas e NaN viram 0; o vetor é normalizado pela soma; `label` é a opção mais provável (a primeira no empate); `confidence` é a probabilidade dela; `expectedScore`, só em `score`, é Σ valor × p (valor = o rótulo numérico quando todos são números finitos, senão a posição 1…N); `boolean` tem os rótulos `"true"` e `"false"`; `score` sem opções, `"1"` a `"5"`; membros em ordem lexicográfica; números em float32 | I160 (`DecodeResult`, `SetScoreValues`), RT |

**API idêntica não quer dizer probabilidades idênticas.** As probabilidades dependem do modelo; a calibração (temperatura por tipo de pergunta e número de opções) é de cada modelo e acontece antes do decodificador.

### 2.3 Ciclo de vida da memória

À moda do Chrome (CR): o backend padrão é um serviço único que atende a todas as sessões, e o modelo cai depois de 60 s ocioso. Na biblioteca:

1. **Um modelo por página e por degrau**, partilhado por todas as sessões, com contagem de referências. A memória não cresce com o número de `create()`.
2. **O esquema é traduzido uma vez, no `create()`** (tokenização das instruções e das opções); cada `decide()` acrescenta só a entrada e faz uma passada.
3. **`destroy()` libera a sessão**; a última sessão a sair descarrega o modelo (GPU e memória do host). Uma sessão coletada sem `destroy()` também libera a sua parte (`FinalizationRegistry`).
4. **Descarga por ociosidade**: sem decisão por `idleUnloadMs` (60.000 ms por padrão, como o Chrome), o modelo sai da GPU; também em `pagehide`. As sessões continuam válidas.
5. **Voltar não exige rede**: o próximo `decide()` recarrega o modelo do cache local (OPFS, `A-02`; até lá, o cache HTTP), sem novo gesto — o modelo já está `"available"`.
6. **Uma decisão de cada vez** por modelo; `destroy()` durante uma decisão faz essa decisão rejeitar com `AbortError` e adia a descarga até ela terminar.

Medir que a memória não cresce com o número de `create()` no motor de verdade é critério da `K-05` (critério global 10).

### 2.4 `preference`

O Chrome recebe `preference` e o devolve no atributo, mas nenhum backend o lê (CR). A biblioteca o usa para escolher o **degrau** (o modelo da escada da [trilha C](../../ROADMAP.md#trilha-c)):

| Valor | Degrau escolhido |
|---|---|
| `"speed"` | o menor degrau que cumpre o alvo de qualidade da pergunta |
| `"capability"` | o maior degrau que cabe no orçamento de memória **medido** do aparelho (`C-01`) e na política de licenças |
| `"auto"` (padrão) | a escolha por aparelho (`B-07`); enquanto um degrau estiver carregado na página, `"auto"` o reutiliza em vez de carregar um segundo modelo |

Na PoC há um degrau só (TS-Ettin-17M), e os três valores dão o mesmo. Se o membro sair da implementação do Chrome, a escolha fica só no ponto de configuração — o código da aplicação não muda.

### 2.5 O ponto de configuração separado

Tudo o que é nosso fica **fora** da superfície, numa função do módulo:

```js
import { DecisionModel, configure } from "@som-web/core";

configure({
  catalog: "/models/catalog.json",  // padrão: o catálogo que vem com a biblioteca
  downloadBudgetBytes: 30_000_000,  // padrão: nenhum nosso; vale o orçamento medido do aparelho
  licenses: ["permissive"],         // padrão: só licenças permissivas (models/catalog.schema.json)
  idleUnloadMs: 60_000,             // padrão: 60 s, como o Chrome
});
```

A chamada é opcional e única, antes do primeiro `availability()` ou `create()`. **Apagá-la não muda nenhuma outra linha**: valem os padrões. Chave desconhecida ou valor inválido é erro, para que um erro de digitação não caia num padrão em silêncio. Diagnóstico (motor, degrau, bytes) também fica fora da superfície.

### 2.6 A interface interna de backend

O `DecisionModel` da biblioteca roda sobre um backend ([`types/backend.d.ts`](../../packages/core/types/backend.d.ts)), que a aplicação nunca vê: `languages`; `select({ preference, resident, config })` → `{ tier, availability }`; `load({ tier, onProgress })` → um modelo com `compile(pergunta)` (no `create()`), `score(compilados, entrada)` (notas não negativas na ordem das opções, já calibradas; erro de nome `QuotaExceededError` quando não cabe) e `unload()`. A `K-05` implementa o backend sobre o fork; a bancada já o liga aos motores do marco T (`engine=core-jh-webgpu`).

## 3. Tradução para o formato de cada modelo

A biblioteca traduz cada pergunta no `create()`, uma vez; o decodificador da seção 2.2 vale para todos.

### 3.1 TS-Ettin (o `dinah.py` do checkpoint)

Igual à bancada ([`bench/spike-mobile/README.md`](../../bench/spike-mobile/README.md#tradução-para-o-ts-ettin), `engines/ts-ettin.js`, `reference/run_reference.py`). Cada pergunta vira uma sequência `[CLS] prompt [SEP] entrada [SEP] [OPT] opção₁ [OPT] opção₂ …`; cada opção é lida no seu `[OPT]`:

| Pergunta | `qtype` | Texto das opções | Rótulos no resultado |
|---|---|---|---|
| `boolean` | `noul` (0) | `"The statement above is false."` e o próprio `prompt` | `"true"` (a opção do `prompt`), `"false"` |
| `choice` | `choice` (1) | `description`, ou o `label` sem descrição | os `label` |
| `score` | `score` (2) | `description` ou `label`; sem opções, `"1"` a `"5"` | os `label` |

Probabilidades: `softmax(logits / T)`, com `T = calibration.temperature[qtype][min(max(k, 2), 9) − 2]` do `config.json` (hoje 1,0 em toda parte: o cartão diz que o modelo não está calibrado). A cabeça de confiança (`conf_logit`) não é usada: o Chrome define `confidence` como a maior probabilidade. Sequência acima de `max_length` (8.192) → `QuotaExceededError`.

### 3.2 `decision-ai/option-reader@1`

É o formato do manifesto `decision_ai.json` do repositório do TS-Ettin (SHA-256 `12dd0696…`, no [catálogo](../../models/catalog.json)), lido na revisão fixada em 2026-11-23 **[MEDIDO]**. Ele descreve o mesmo leitor de opções num grafo ONNX, e a tradução é a da seção 3.1, com os nomes do manifesto:

| Campo do manifesto | Valor no TS-Ettin-17M | Uso na tradução |
|---|---|---|
| `tokens` | `cls` `[CLS]`, `sep` `[SEP]`, `pad` `[PAD]`, `option` `[OPT]` | montagem da sequência |
| `question_types` | `noul` 0, `choice` 1, `score` 2 | `boolean` → `noul`; `choice` → `choice`; `score` → `score` |
| `noul_false_default` | `"The statement above is false."` | a opção “falso” de uma pergunta `boolean` |
| `max_length` · `pad_multiple` | 8.192 · 64 | limite (`QuotaExceededError`) e preenchimento do lote |
| `inputs` | `ids`, `pad_mask`, `opt_positions`, `opt_mask`, `qtype` | o lote: IDs, máscara, posição de cada `[OPT]`, máscara das opções, tipo da pergunta |
| `outputs` | `logits`, `conf_logit` | `logits` → probabilidades; `conf_logit` não é usado |
| `files` · `sha256` | `onnx/model_8bit.onnx`, `tokenizer.json`, com os hashes | o que baixar e conferir |

O manifesto não traz a temperatura: um modelo desse formato sem `config.json` usa T = 1.

### 3.3 A API `/v1/systemone`

O contrato público dos modelos System One (a API da TypeSafe AI, que o `transformers serve` reproduz). Lido em `transformers` 5.24.0 (`cli/serving/systemone.py` e `decision/template_utils.py`) **[REPORTADO]**: a requisição é `{ model, state, questions: { nome: pergunta }, assets }`, com até 64 perguntas dos tipos `noul`, `choice` e `score`, cada uma com `instructions` e `criteria`.

| Decisions API | `/v1/systemone` | Volta para o resultado |
|---|---|---|
| a entrada de `decide()` | `state` (texto) | — |
| `id` | o nome da pergunta em `questions` | a chave do resultado |
| `boolean`, `prompt` | `{ "type": "noul", "instructions": prompt }` | `noul` é P(verdadeiro): `probabilities` = `{ "true": noul, "false": 1 − noul }` |
| `choice`, `prompt`, opções | `{ "type": "choice", "instructions": prompt, "criteria": { label: description ou null } }` | `probabilities` da resposta, já indexadas pelo `label` |
| `score`, `prompt`, níveis | `{ "type": "score", "instructions": prompt, "criteria": [description ou label, …] }` (sem opções: `"1"` a `"5"`) | as chaves da resposta são posições em base 0 (`"0"`, `"1"`, …): a posição i volta para o i-ésimo `label` |

Os campos derivados da resposta — `choice`, `score` (média em base 0), `legend` e `confidence` (o excesso sobre a distribuição uniforme, não a maior probabilidade) — são descartados: `label`, `confidence` e `expectedScore` saem do decodificador da seção 2.2, para que o resultado seja o do Chrome.

## 4. Exemplos

O exemplo do roadmap e os quatro casos de uso do explainer compilam contra os tipos sem alteração ([`packages/core/types-check/`](../../packages/core/types-check/roadmap-example.ts)). Com o módulo e o ponto de configuração:

```js
import { DecisionModel, configure } from "@som-web/core";

configure({ licenses: ["permissive"] }); // opcional: apagar esta linha não muda as outras

const schema = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  questions: [
    { id: "wants_refund", type: "boolean", prompt: "Does the customer ask for a refund?" },
    { id: "urgency", type: "score", prompt: "From 1 (low) to 5 (high), how urgent is it?" },
  ],
  preference: "speed",
};

if ((await DecisionModel.availability(schema)) !== "unavailable") {
  button.onclick = async () => {               // o gesto que o download exige
    const model = await DecisionModel.create({
      ...schema,
      monitor(m) { m.addEventListener("downloadprogress", (e) => bar.value = e.loaded); },
    });
    const result = await model.decide("I was charged twice and I need this fixed today.");
    // result.urgency -> { confidence, expectedScore, id, label, probabilities }
    model.destroy();
  };
}
```

## 5. Verificação

| O que | Como | Resultado |
|---|---|---|
| Os 72 resultados de validação iguais aos do Chrome | a página de conformidade (`bench/spike-mobile/surface.html`), **sem alteração**, sobre a biblioteca (`?engine=core-jh-webgpu`, Chrome Canary 160 sem a flag da API, no Mac mini) e `compare_surface.py` contra as capturas nativas do Canary 160 no macOS e no Windows | 72 comparados, **0 diferenças** nos dois **[MEDIDO: [`2026-11-23-surface-macmini-core-jh-webgpu-canary-160.json`](../../bench/results/2026-11-23-surface-macmini-core-jh-webgpu-canary-160.json)]** |
| A sessão | a mesma captura: `create()` sem gesto recusado como no nativo; com gesto (clique pelo DevTools), `create()`, `decide()` com entrada vazia, sinal abortado, `destroy()` e `decide()` depois de `destroy()` com os mesmos erros e mensagens; membros e tipos do resultado iguais | igual **[MEDIDO]** |
| Os mesmos casos em Node, antes e depois do download | `packages/core/test/conformance.test.js` repete cada caso das capturas nativas sobre a biblioteca, com um backend sem modelo | 72 + 72 iguais, na CI em Linux, macOS e Windows |
| A página sobre a API nativa | as capturas do `T-05` e do `T-03` | [`2026-11-21-surface-macmini-chrome-canary-160.json`](../../bench/results/2026-11-21-surface-macmini-chrome-canary-160.json) e as demais |
| Ciclo de vida, `preference`, cota, configuração, decodificador | `packages/core/test/{lifecycle,decode}.test.js` | na CI |
| JSON Schema | `packages/core/test/schema.test.js`: para cada caso das capturas, “válido pelo esquema” = “aceito pelo Chrome”, salvo os 4 que JSON Schema não exprime | na CI |
| Tipos | `tsc` sobre os exemplos do explainer e do roadmap | na CI (`npm run lint`) |

## 6. Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Superfície própria (`som.decide`, `SOM.load`) | contra a regra da API idêntica; o código da aplicação mudaria entre o nativo e a biblioteca |
| Acompanhar o explainer, e não a implementação | a implementação é o que roda; o explainer não tem `preference` e já divergiu dela (especificação, seção 7) |
| Devolver `expectedScore` e `score` lado a lado já agora, como sugere a [pesquisa 03](../../research/03-modelos-maiores-sem-travas-de-memoria.md) | o Chrome 160 não devolve `score`; o resultado deixaria de ser idêntico. Entra quando a implementação mudar (seção 8) |
| Um Worker e um modelo por `create()`, como o polyfill do GoogleChromeLabs | cada sessão com a sua cópia do modelo: é a trava de memória que o projeto existe para evitar |
| Truncar a entrada que não cabe | o Chrome responde com erro de cota no backend padrão; truncar em silêncio muda a resposta sem aviso |
| Configuração dentro de `create()` (opções extras) | é um nome próprio na superfície; um membro desconhecido seria ignorado pelo nativo e mudaria o comportamento só na biblioteca |

## 7. Impacto

- **Compatibilidade:** é a primeira superfície pública do projeto; nada publicado quebra. O pacote continua privado até a `A-08`.
- **Padronização:** a biblioteca vira uma segunda implementação da mesma superfície, em qualquer navegador com WebGPU, o que dá evidência para o explainer (`S-02`, `S-04`): as diferenças de comportamento que precisamos reproduzir (perfil de versão, `devTrialBackend`, `preference` sem efeito no Chrome) viram lacunas documentadas.
- **Aplicações:** o mesmo código roda sobre o nativo e sobre a biblioteca; o que é nosso fica num ponto removível.

## 8. Mudanças pendentes e a regra

**Regra:** a superfície só muda quando a implementação do Chrome mudar; a referência é um build fixado (hoje o 160) e a mudança entra por PR, com nova captura da página de conformidade.

Pendentes em 2026-11-23 **[REPORTADO]** ([O padrão na prática](../../ROADMAP.md#padrao-pratica), pesquisa 03):

- o **PR #8 do explainer** e o **CL 8788005** (abertos) renomeiam `expectedScore` para `score`, com 2 a 10 níveis em base 0 e obrigatórios; o polyfill do GoogleChromeLabs (2.1.2) já os segue e, por isso, difere do Chrome atual;
- outros CLs: o Laya como backend (o `create()` dos `laya_*` falha até o CL 8797626), a pontuação de opções em grupo e a temperatura no backend de linguagem;
- a **issue #9** mediu que tirar o `context` piorou os acertos (78/116 para 68/116), sem resposta.

## 9. Questões em aberto

1. **Mensagens não capturadas:** `create()` com sinal abortado, com idioma sem suporte, com modelo `"unavailable"` e `QuotaExceededError` (o Chrome não o disparou na captura). A biblioteca usa o `reason` do sinal e mensagens próprias, listadas no código; quando houver captura, elas passam a ser as do Chrome.
2. **Notas todas zero** no decodificador: não observado no Chrome; a biblioteca devolve a distribuição uniforme.
3. **Workers:** o Chrome expõe a API a workers atrás de outra flag, sem teste nosso; a `K-05` roda o motor num Worker, mas a superfície exposta a workers fica para quando houver captura.
4. **`downloading`:** com um modelo por página, o estado só aparece entre abas que partilham o cache; o comportamento entre abas fica para a `A-02` (OPFS).
5. **`preference` com vários degraus:** dois `create()` com preferências que escolhem degraus diferentes carregariam dois modelos; a regra de `"auto"` reutilizar o residente evita o caso comum, e a `B-07` decide o resto.
