import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager, MemoryStorage } from '../src/core/save.js';
import { createDefaultState, sanitizeState } from '../src/core/state.js';
import { Game } from '../src/core/sim.js';
import { SAVE_KEY, MACHINES, TUNING } from '../src/core/config.js';

test('kaydet -> yeniden yükle: ilerleme korunur', () => {
  const store = new MemoryStorage();
  const sm = new SaveManager(store);
  const g = new Game(createDefaultState(1000));
  g.state.money = 12345;
  g.state.machines[0].level = 12; g.state.machines[0].auto = true; g.state.machines[0].speed = 3;
  g.state.machines[1].owned = true;
  g.state.zones[1].unlocked = true;
  g.state.quests.produce10 = true;
  g.state.stats.produced = 77;
  g.state.settings.sound = false;
  assert.equal(sm.save(g.state), true);

  const { state, status } = new SaveManager(store).load(2000);
  assert.equal(status, 'ok');
  assert.equal(state.money, 12345);
  assert.equal(state.machines[0].level, 12);
  assert.equal(state.machines[0].auto, true);
  assert.equal(state.machines[0].speed, 3);
  assert.equal(state.machines[1].owned, true);
  assert.equal(state.zones[1].unlocked, true);
  assert.equal(state.quests.produce10, true);
  assert.equal(state.stats.produced, 77);
  assert.equal(state.settings.sound, false);
  assert.equal(state.lastSeen, 1000);
});

test('kayıt yoksa yeni oyun', () => {
  const r = new SaveManager(new MemoryStorage()).load();
  assert.equal(r.status, 'new');
  assert.equal(r.state.money, TUNING.startMoney);
});

test('bozuk JSON oyunu açılmaz hale getirmez; yedekten kurtarır', () => {
  const store = new MemoryStorage();
  const sm = new SaveManager(store);
  const s = createDefaultState(); s.money = 999;
  sm.save(s);
  s.money = 1500; sm.save(s);                   // yedek = 999'luk kayıt
  store.setItem(SAVE_KEY, '{bozuk json!!');
  const r = sm.load();
  assert.equal(r.status, 'recovered');
  assert.equal(r.state.money, 999);

  store.setItem(SAVE_KEY + '.bak', 'çöp');
  const r2 = sm.load();
  assert.equal(r2.status, 'corrupt');
  assert.equal(r2.state.money, TUNING.startMoney);
});

test('eksik/yanlış tipli alanlar varsayılana döner, kötü değerler kırpılır', () => {
  const s = sanitizeState({
    v: 1, money: 'abc', stats: null, machines: [{ id: 'press', level: -5, speed: 999, auto: 'evet' }, { id: 'ghost', owned: true }],
    zones: 'x', quests: { produce10: true, yok: true, sell100: 'true' }, lastSeen: 'dün', settings: 5, boosts: [{ mult: 9999, until: Date.now() + 1e6 }, null],
  });
  assert.equal(s.money, TUNING.startMoney);
  assert.equal(s.machines.length, MACHINES.length);
  assert.equal(s.machines[0].level, 1);
  assert.equal(s.machines[0].speed, 12);
  assert.equal(s.machines[0].auto, false);
  assert.equal(s.quests.produce10, true);
  assert.equal(s.quests.yok, undefined);
  assert.equal(s.quests.sell100, undefined);
  assert.ok(Number.isFinite(s.lastSeen));
  assert.equal(s.boosts.length, 1);
  assert.equal(s.boosts[0].mult, 100);
});

test('NaN/Infinity para ve gelecekteki zaman damgası temizlenir', () => {
  const now = 5e12;
  const s = sanitizeState({ money: Infinity, lastSeen: now + 1e9, machines: [] }, now);
  assert.equal(s.money, TUNING.startMoney);
  assert.equal(s.lastSeen, now);
  const s2 = sanitizeState({ money: -50 });
  assert.equal(s2.money, 0);
});

test('sahipsiz makinenin yükseltmeleri sıfırlanır (hileli/bozuk kayıt)', () => {
  const s = sanitizeState({ machines: [{ id: 'painter', owned: false, level: 50, auto: true }] });
  assert.equal(s.machines[1].level, 1);
  assert.equal(s.machines[1].auto, false);
});

test('depolama yazma hatası fırlatmaz', () => {
  const bad = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} };
  const sm = new SaveManager(bad);
  assert.equal(sm.save(createDefaultState()), false);
  assert.ok(sm.lastError);
});

test('depolama okuma hatası oyunu açılır bırakır', () => {
  const bad = { getItem: () => { throw new Error('denied'); }, setItem() {}, removeItem() {} };
  const r = new SaveManager(bad).load();
  assert.equal(r.status, 'corrupt');
  assert.equal(r.state.money, TUNING.startMoney);
});

test('görev ödülü kayıt/yükleme sonrası tekrar alınamaz', () => {
  const store = new MemoryStorage();
  const sm = new SaveManager(store);
  const g = new Game(createDefaultState());
  for (let i = 0; i < 30; i++) { g.tap(0); for (let k = 0; k < 20; k++) g.update(0.05); }
  assert.ok(g.claimQuest('produce10') > 0);
  sm.save(g.state);
  const g2 = new Game(sm.load().state);
  const money = g2.state.money;
  assert.equal(g2.claimQuest('produce10'), 0);
  assert.equal(g2.state.money, money);
});

test('yeniden başlatma + çevrimdışı: aynı süre için iki kez kazanç yok', () => {
  const store = new MemoryStorage();
  const sm = new SaveManager(store);
  const g = new Game(createDefaultState(0));
  g.state.machines[0].auto = true;
  g.touch(1000); sm.save(g.state);

  const now = 1000 + 3 * 3600 * 1000;
  const g2 = new Game(sm.load(now).state);
  const r = g2.applyOffline(now);
  assert.ok(r.earned > 0);
  sm.save(g2.state);
  const g3 = new Game(sm.load(now + 1000).state);           // 1 sn sonra tekrar aç
  assert.equal(g3.applyOffline(now + 1000), null);
  assert.equal(g3.state.money, g2.state.money);
});
