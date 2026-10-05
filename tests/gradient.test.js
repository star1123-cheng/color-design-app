import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGradient } from '../src/color/gradient.js';
import { checkGradient } from '../src/color/rules.js';

test('全幅型與淺色型漸層：各色相都符合 4.4', () => {
  const fails = [];
  for (let h = 0; h < 360; h += 15) {
    for (const type of ['full', 'light']) {
      const g = makeGradient([0.65, 0.12, h], { type });
      assert.equal(g.length, 5);
      const r = checkGradient(g.map((c) => c.oklch));
      if (!r.ok) fails.push(`${type} H${h}`);
    }
  }
  assert.deepEqual(fails, []);
});

test('漸層由淺到深', () => {
  const g = makeGradient([0.6, 0.1, 240]);
  for (let i = 1; i < g.length; i++) assert.ok(g[i].oklch[0] < g[i - 1].oklch[0]);
});
