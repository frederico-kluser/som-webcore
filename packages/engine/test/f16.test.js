import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fromHalfBits, packHalfPairs, toHalfBits } from './helpers/f16.js';

test('known binary16 encodings', () => {
  const cases = [
    [0, 0x0000],
    [-0, 0x8000],
    [1, 0x3c00],
    [-2, 0xc000],
    [0.1, 0x2e66],
    [65504, 0x7bff],
    [65520, 0x7c00], // ties to even rounds the largest finite up to +Inf
    [2 ** -24, 0x0001],
    [2 ** -25, 0x0000], // half of the smallest subnormal: ties to even gives 0
    [3 * 2 ** -25, 0x0002],
    [2 ** -14, 0x0400],
    [Number.POSITIVE_INFINITY, 0x7c00],
  ];
  for (const [value, bits] of cases) {
    assert.equal(toHalfBits(value), bits, `toHalfBits(${value})`);
  }
  assert.ok(Number.isNaN(fromHalfBits(toHalfBits(Number.NaN))));
});

test('every finite binary16 value survives a round trip', () => {
  for (let bits = 0; bits < 0x10000; bits += 1) {
    if (((bits >>> 10) & 0x1f) === 0x1f) continue;
    assert.equal(toHalfBits(fromHalfBits(bits)), bits);
  }
});

test('pairs are packed low half first', () => {
  const [word] = packHalfPairs([1, -2]);
  assert.equal(word & 0xffff, 0x3c00);
  assert.equal(word >>> 16, 0xc000);
  assert.throws(() => packHalfPairs([1]), RangeError);
});
