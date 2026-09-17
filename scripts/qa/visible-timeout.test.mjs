// The hall's startup budget counts visible time only: a tab opened in the background (throttled timers) must
// not expire into the CSS fallback before the visitor looks at it (2026-09-16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleTimeout } from '../../src/components/hall/visibleTimeout.mjs';

/** Fake clock + document: timers fire only when the clock is advanced past their deadline. */
function harness() {
  let now = 0;
  const timers = new Map();
  let id = 0;
  const listeners = new Set();
  const doc = {
    hidden: false,
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
  const env = {
    document: doc,
    now: () => now,
    setTimeout: (cb, t) => { timers.set(++id, { at: now + t, cb }); return id; },
    clearTimeout: (t) => timers.delete(t),
  };
  return {
    env,
    doc,
    listeners,
    advance(ms) {
      now += ms;
      for (const [key, timer] of [...timers]) if (timer.at <= now) { timers.delete(key); timer.cb(); }
    },
    setHidden(hidden) { doc.hidden = hidden; for (const fn of [...listeners]) fn(); },
    pending: () => timers.size,
  };
}

test('fires after the budget when the document stays visible', () => {
  const h = harness();
  let fired = 0;
  visibleTimeout(1000, () => fired++, h.env);
  h.advance(999);
  assert.equal(fired, 0);
  h.advance(1);
  assert.equal(fired, 1);
  assert.equal(h.listeners.size, 0, 'listener removed after firing');
});

test('hidden time does not count toward the budget', () => {
  const h = harness();
  let fired = 0;
  visibleTimeout(1000, () => fired++, h.env);
  h.advance(400);
  h.setHidden(true);
  assert.equal(h.pending(), 0, 'timer disarmed while hidden');
  h.advance(60000);
  assert.equal(fired, 0, 'a minute in the background must not expire the budget');
  h.setHidden(false);
  h.advance(599);
  assert.equal(fired, 0);
  h.advance(1);
  assert.equal(fired, 1, 'the remaining 600 ms of visible time expire it');
});

test('starting hidden arms only once the document becomes visible', () => {
  const h = harness();
  h.doc.hidden = true;
  let fired = 0;
  visibleTimeout(500, () => fired++, h.env);
  assert.equal(h.pending(), 0);
  h.advance(5000);
  h.setHidden(false);
  h.advance(500);
  assert.equal(fired, 1);
});

test('cancel stops the timer and drops the listener', () => {
  const h = harness();
  let fired = 0;
  const cancel = visibleTimeout(500, () => fired++, h.env);
  cancel();
  assert.equal(h.pending(), 0);
  assert.equal(h.listeners.size, 0);
  h.setHidden(true);
  h.setHidden(false);
  h.advance(5000);
  assert.equal(fired, 0);
});
