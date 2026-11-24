// The JSON Schema of the question schema against Chrome: for every case of the surface capture,
// "valid by the schema" must equal "accepted by Chrome's availability()", except where JSON Schema
// cannot say what Chrome checks (listed in the schema's $comment).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(new URL('../schema/questions.schema.json', import.meta.url), 'utf8'));
const native = JSON.parse(readFileSync(new URL('../../../bench/results/2026-11-21-surface-macmini-chrome-canary-160.json', import.meta.url), 'utf8'));

// Chrome rejects these, and the schema cannot: duplicates by property, BCP 47, the Dev Trial enum.
const BEYOND_JSON_SCHEMA = new Set(['duplicate-question-id', 'duplicate-option-label', 'languages-invalid-tag', 'backend-bogus']);

test('the schema accepts what Chrome accepts and rejects what Chrome rejects', () => {
  // ajv is CommonJS: its class is the default export at run time.
  const validate = new (/** @type {any} */ (Ajv2020))({ allErrors: true, strict: true }).compile(schema);
  let compared = 0;
  for (const c of native.cases) {
    const value = c.schema ?? {};
    const chromeAccepts = c.availability.ok;
    const schemaAccepts = validate(value);
    if (BEYOND_JSON_SCHEMA.has(c.name)) {
      assert.equal(chromeAccepts, false, c.name);
      assert.equal(schemaAccepts, true, `${c.name}: the schema now catches it — remove it from the list`);
      continue;
    }
    compared += 1;
    assert.equal(schemaAccepts, chromeAccepts, `${c.name}: ${JSON.stringify(validate.errors)}`);
  }
  assert.equal(compared, native.cases.length - BEYOND_JSON_SCHEMA.size);
});
