import test from 'node:test';
import assert from 'node:assert/strict';
import { fittedFontSize } from '../../src/components/hall/fitText.mjs';

// The loops fittedFontSize replaced, kept here as the reference: one measurement per pixel step.
const whileLoop = (start, floor, limit, width) => { let size = start; while (width(size) > limit && size > floor) size -= 1; return size; };
const doLoop = (start, floor, limit, width) => { let size = start, font; do { font = size--; } while (width(font) > limit && size > floor - 1); return font; };

// Monotonic widths with rounding and per-size hinting jitter, as real fonts give.
const widths = [
  s => s * 5.31,
  s => Math.round(s * 7.9 + (Math.sin(s * 1.7) * 2)),
  s => Math.ceil(s * 3.2) + (s % 3 === 0 ? 1 : 0),
  s => s * 11.04 + 0.4,
];

test('fittedFontSize equals the stepping searches for fitting, clamped and fractional starts', () => {
  for (const width of widths) {
    for (const start of [158, 139, 290, 184.32, 60, 13.5]) {
      for (const limit of [20, 300, 500, 1050, 1300, 5000]) {
        for (const floor of [12, 41, 96]) {
          const counted = { n: 0 };
          const measured = s => { counted.n++; return width(s); };
          const fitted = fittedFontSize(start, floor, limit, measured);
          assert.equal(fitted, whileLoop(start, floor, limit, width), `while: width#${widths.indexOf(width)} start ${start} limit ${limit} floor ${floor}`);
          assert.equal(fitted, doLoop(start, floor, limit, width), `do: width#${widths.indexOf(width)} start ${start} limit ${limit} floor ${floor}`);
          assert.ok(counted.n <= 6, `few measurements (${counted.n})`);
        }
      }
    }
  }
});
