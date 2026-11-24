// The same roadmap example through the module, plus the separate configuration point: removing the
// configure() call changes no other line (RFC-0001 §5).
import { DecisionModel, configure, type DecisionModelCreateOptions } from '@som-web/core';

configure({ licenses: ['permissive'], idleUnloadMs: 60_000 });

const schema = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  questions: [
    { id: 'wants_refund', type: 'boolean', prompt: 'Does the customer ask for a refund?' },
    { id: 'urgency', type: 'score', prompt: 'From 1 (low) to 5 (high), how urgent is it?' },
  ],
  preference: 'speed',
} satisfies DecisionModelCreateOptions;

const status = await DecisionModel.availability(schema);
if (status === 'available' || status === 'downloadable') {
  const controller = new AbortController();
  const model = await DecisionModel.create({ ...schema, signal: controller.signal, monitor(m) { m.addEventListener('downloadprogress', (e) => console.log(e.loaded)); } });
  const result = await model.decide('I was charged twice.', { signal: controller.signal });
  const score: number | undefined = result.urgency.expectedScore;
  const preference: 'auto' | 'speed' | 'capability' = model.preference;
  model.destroy();
  void score;
  void preference;
}
