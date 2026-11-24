// IEEE 754 binary16 on the CPU: the host side of "weights in FP16, arithmetic in f32"
// (ROADMAP §6.2, decision 2). Test helper for P-03; K-02 brings the engine's own converter.

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/**
 * Rounds a number to the nearest binary16 (ties to even) and returns its 16 bits.
 * @param {number} value
 * @returns {number}
 */
export function toHalfBits(value) {
  f32[0] = value;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  const exp = (x >>> 23) & 0xff;
  let mant = x & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  const e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mant |= 0x800000;
    const shift = 14 - e;
    let half = mant >>> shift;
    const rem = mant & ((1 << shift) - 1);
    const halfway = 1 << (shift - 1);
    if (rem > halfway || (rem === halfway && (half & 1))) half += 1;
    return sign | half;
  }
  let half = (e << 10) | (mant >>> 13);
  const rem = mant & 0x1fff;
  // A carry out of the mantissa moves into the exponent, which is the right result (up to +Inf).
  if (rem > 0x1000 || (rem === 0x1000 && (half & 1))) half += 1;
  return sign | half;
}

/**
 * Decodes 16 binary16 bits to a number (exact: every binary16 value is a binary64 value).
 * @param {number} bits
 * @returns {number}
 */
export function fromHalfBits(bits) {
  const sign = bits & 0x8000 ? -1 : 1;
  const e = (bits >>> 10) & 0x1f;
  const m = bits & 0x3ff;
  if (e === 0) return sign * m * 2 ** -24;
  if (e === 0x1f) return m ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * (1 + m / 1024) * 2 ** (e - 15);
}

/**
 * Packs pairs of binary16 values into u32 words, the low half first — the layout that
 * WGSL `unpack2x16float` reads (`.x` = bits 0–15, `.y` = bits 16–31).
 * @param {ArrayLike<number>} values even length
 * @returns {Uint32Array}
 */
export function packHalfPairs(values) {
  if (values.length % 2 !== 0) throw new RangeError('packHalfPairs needs an even length');
  const out = new Uint32Array(values.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = (toHalfBits(values[2 * i]) | (toHalfBits(values[2 * i + 1]) << 16)) >>> 0;
  }
  return out;
}
