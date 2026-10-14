import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESTIGE } from '../src/core/config.js';
import { createDefaultState } from '../src/core/state.js';
import { Game } from '../src/core/sim.js';
import { prestigeUnlocked, prestigeProgress, prestigeNeed } from '../src/core/economy.js';

test('Patent Laboratuvarı yeni oyunda kilitli; şart ve ilerleme hesaplanır', () => {
  const s = createDefaultState(0);
  assert.equal(prestigeUnlocked(s), false);
  assert.equal(prestigeNeed(), PRESTIGE.base);
  assert.equal(prestigeProgress(s), 0);
  s.stats.runEarned = 5000;                               // başlangıç eşiğinin altında
  assert.equal(prestigeProgress(s), 0);
  let prev = 0;
  for (const e of [1e5, 1e6, 1e7, 1e8, 1e9]) {            // kazandıkça ilerleme artar
    s.stats.runEarned = e;
    const p = prestigeProgress(s);
    assert.ok(p > prev && p < 1);
    prev = p;
  }
  s.stats.runEarned = PRESTIGE.base - 1;
  assert.equal(prestigeUnlocked(s), false);
  assert.ok(prestigeProgress(s) < 1 + 1e-9);
});

test('yeterli kazanca ulaşınca kilit açılır ve bildirim bir kez gelir', () => {
  const events = [];
  const g = new Game(createDefaultState(0), (t) => events.push(t));
  g.state.stats.runEarned = PRESTIGE.base;
  g.refresh();
  assert.equal(prestigeUnlocked(g.state), true);
  assert.equal(prestigeProgress(g.state), 1);
  assert.equal(events.filter((e) => e === 'patentUnlocked').length, 1);
  g.refresh(); g.refresh();
  assert.equal(events.filter((e) => e === 'patentUnlocked').length, 1);
});

test('zaten açık olan oyuncuya (yeniden doğuş yapmış) açılış bildirimi verilmez ve kilit geri kapanmaz', () => {
  const events = [];
  const st = createDefaultState(0);
  st.meta.prestiges = 2; st.meta.totalStars = 30;
  const g = new Game(st, (t) => events.push(t));
  assert.equal(events.includes('patentUnlocked'), false);
  assert.equal(prestigeUnlocked(g.state), true);
  g.state.stats.runEarned = 0;                            // yenilemeden sonra kazanç sıfırlanır
  assert.equal(prestigeUnlocked(g.state), true);
});

test('günlük hediyeden yıldız gelmişse de laboratuvar açılır', () => {
  const st = createDefaultState(0);
  st.meta.totalStars = 1;
  assert.equal(prestigeUnlocked(st), true);
});
