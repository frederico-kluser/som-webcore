// The usage example of ROADMAP.md ("Padrão de uso e de chamada"), unchanged, compiled against
// decision-model.d.ts. If this stops compiling, the declarations and the roadmap disagree.
export {};

const schema = {
  expectedInputs: [{ type: "text", languages: ["pt", "en"] }],
  questions: [
    { id: "quer_reembolso", type: "boolean", prompt: "O cliente pede reembolso?" },
    {
      id: "assunto",
      type: "choice",
      prompt: "Qual é o assunto da mensagem?",
      options: [
        { label: "pagamento", description: "Cobrança, fatura ou estorno" },
        { label: "entrega", description: "Prazo, rastreio ou extravio" },
        { label: "outro", description: "Qualquer outro assunto" }
      ]
    },
    { id: "urgencia", type: "score", prompt: "De 1 (baixa) a 5 (alta), qual a urgência?" }
  ]
} satisfies DecisionModelCreateOptions;

const status = await DecisionModel.availability(schema);
if (status === "available" || status === "downloadable") {
  const model = await DecisionModel.create(schema);
  const result = await model.decide("Fui cobrado duas vezes e preciso disso resolvido hoje.");
  // result.assunto  -> { id, label, confidence, probabilities }
  // result.urgencia -> { id, label, confidence, probabilities, expectedScore }
  model.destroy();
  void result;
}
