/**
 * The first size of start, start − 1, start − 2, … at which the text fits (`width(size) <= limit`) or the size
 * reaches `floor`: what the canvas code used to find by setting a new font and measuring once per pixel step.
 * Text width is proportional to the font size, so one measurement predicts the answer and two or three more
 * confirm it, with the same result. The step-by-step search cost up to ~170 measureText calls, each a font at a
 * new size: 548 ms of one phone exhibit's preparation at CPU ×4 (2026-10-05).
 *
 * @param {number} start the size the search starts at
 * @param {number} floor the search stops at this size or below, fitting or not
 * @param {number} limit the widest the text may be
 * @param {(size: number) => number} width sets the font at `size` and measures the text
 * @returns {number}
 */
export function fittedFontSize(start, floor, limit, width) {
  const fits = size => size <= floor || width(size) <= limit;
  const first = width(start);
  if (first <= limit || start <= floor) return start;
  let k = Math.max(1, Math.ceil(start - start * limit / first));
  while (k > 1 && fits(start - (k - 1))) k--;
  while (!fits(start - k)) k++;
  return start - k;
}
