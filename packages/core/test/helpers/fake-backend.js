// A decision backend with no model behind it, for the contract tests: it counts loads and unloads
// and answers fixed scores, so only the library's own behaviour is under test.

/**
 * @param {{ availability?: import('../../types/index.js').Availability, scores?: (layout: import('../../types/backend.js').QuestionLayout, input: string) => number[], loadDelayMs?: number, quotaTokens?: number }} [options]
 */
export function fakeBackend(options = {}) {
  const stats = { selects: 0, loads: 0, unloads: 0, compiles: 0, scores: 0, progress: /** @type {number[]} */ ([]) };
  let cached = false;
  const availability = options.availability ?? 'downloadable';
  /** @type {import('../../types/backend.js').DecisionBackend & { stats: typeof stats }} */
  const backend = {
    stats,
    languages: ['en'],
    async select() {
      stats.selects += 1;
      return { tier: 'fake-17m', availability: availability === 'downloadable' && cached ? 'available' : availability };
    },
    async load({ onProgress }) {
      stats.loads += 1;
      for (const f of [0.25, 0.5, 0.75]) {
        onProgress(f);
        if (options.loadDelayMs) await new Promise((r) => setTimeout(r, options.loadDelayMs));
      }
      cached = true;
      return {
        compile(_question, layout) {
          stats.compiles += 1;
          return layout;
        },
        async score(compiled, input) {
          stats.scores += 1;
          if (options.quotaTokens && input.length > options.quotaTokens) {
            const error = new Error(`The request needs ${input.length} tokens, above the model limit of ${options.quotaTokens}.`);
            error.name = 'QuotaExceededError';
            throw error;
          }
          return compiled.map((layout) => {
            const l = /** @type {import('../../types/backend.js').QuestionLayout} */ (layout);
            return options.scores ? options.scores(l, input) : l.labels.map((_, i) => i + 1);
          });
        },
        unload() {
          stats.unloads += 1;
        },
      };
    },
  };
  return backend;
}
