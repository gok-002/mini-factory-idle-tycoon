import test from 'node:test';
import assert from 'node:assert/strict';
import { MACHINES, ZONES, QUESTS, PATENTS, PRESTIGE, GOLDEN, DAILY, SLOTS_PER_ZONE, TUNING, SAVE_VERSION } from '../src/core/config.js';
import { createDefaultState, sanitizeState } from '../src/core/state.js';
import { Game, dayKey } from '../src/core/sim.js';
import { SaveManager, MemoryStorage, migrate } from '../src/core/save.js';
import { visibleQuests, questDone, claimableCount } from '../src/core/quests.js';
import { prestigeGain, permMult, achMult, offlineCapHours, offlineEfficiency, patentCost, machineBuyCost } from '../src/core/economy.js';
import { computeOffline } from '../src/core/offline.js';

const fresh = (rng) => new Game(createDefaultState(0), undefined, rng);
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('içerik bütünlüğü: 8 bölge x 3 makine, benzersiz kimlikler, artan maliyet', () => {
  assert.equal(ZONES.length, 8);
  assert.equal(MACHINES.length, ZONES.length * SLOTS_PER_ZONE);
  assert.equal(new Set(MACHINES.map((m) => m.id)).size, MACHINES.length);
  assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length);
  MACHINES.forEach((m, i) => {
    assert.equal(m.zone, Math.floor(i / SLOTS_PER_ZONE));
    if (i > 1) assert.ok(m.baseCost > MACHINES[i - 1].baseCost && m.baseValue > MACHINES[i - 1].baseValue);
    assert.ok(Number.isFinite(m.baseCost) && Number.isFinite(m.autoCost) && m.baseTime > 0);
  });
  ZONES.forEach((z, i) => { if (i > 1) assert.ok(z.unlockCost > ZONES[i - 1].unlockCost); });
  assert.ok(QUESTS.length >= 100);
});

test('v1 kaydı (eski oyuncu) güncel şemaya taşınır: ilerleme korunur, yeni içerik kilitli', () => {
  const old = { v: 1, money: 5e9, stats: { produced: 900, sold: 800, earned: 3e10, upgrades: 40, maxIncome: 1e8, taps: 300, offlineEarned: 0 },
    machines: [{ id: 'press', owned: true, level: 80, auto: true }, { id: 'robotarm', owned: true, level: 12, auto: true }],
    zones: [{ id: 'workshop', unlocked: true }, { id: 'robotics', unlocked: true }], quests: { produce10: true, zone3: true }, lastSeen: 1000 };
  const st = new MemoryStorage(); st.setItem('miniFactory.save', JSON.stringify(old));
  const { state, status } = new SaveManager(st).load(2000);
  assert.equal(status, 'ok');
  assert.equal(state.v, SAVE_VERSION);
  assert.equal(state.money, 5e9);
  assert.equal(state.machines[0].level, 80);
  assert.equal(state.machines[8].owned, true);
  assert.equal(state.machines.length, MACHINES.length);
  assert.equal(state.zones[2].unlocked, true);
  assert.equal(state.zones[3].unlocked, false);
  assert.equal(state.quests.zone3, true);
  assert.equal(state.stats.runEarned, 3e10);   // mevcut koşu = şimdiye kadarki kazanç
  assert.equal(state.meta.stars, 0);
  assert.equal(migrate({ v: 1 }).v, SAVE_VERSION);
  assert.equal(migrate({ v: 2 }).v, SAVE_VERSION);
});

test('görev merdiveni: her seriden yalnızca sıradaki görev görünür', () => {
  const g = fresh();
  const vis = visibleQuests(g.state);
  const series = vis.map((q) => q.series);
  assert.equal(new Set(series).size, series.length);
  assert.ok(vis.find((q) => q.id === 'produce10'));
  assert.ok(!vis.find((q) => q.id === 'produced_100'));
  assert.ok(!vis.some((q) => q.zone !== undefined && q.zone > 0));   // kilitli bölge görevleri gizli
  g.state.stats.produced = 10;
  assert.ok(g.claimQuest('produce10') > 0);
  assert.ok(visibleQuests(g.state).find((q) => q.id === 'produced_100'));
});

test('bölüm görevleri bölge açılınca görünür ve doğru ilerler', () => {
  const g = fresh();
  g.state.zones[1].unlocked = true;
  assert.ok(visibleQuests(g.state).find((q) => q.id === 'ch1_own'));
  for (const i of [3, 4, 5]) g.state.machines[i].owned = true;
  assert.equal(questDone(g.state, QUESTS.find((x) => x.id === 'ch1_own')), true);
  for (const i of [3, 4, 5]) g.state.machines[i].level = 15;
  assert.equal(questDone(g.state, QUESTS.find((x) => x.id === 'ch1_l15')), true);
  g.state.machines[4].level = 14;
  assert.equal(questDone(g.state, QUESTS.find((x) => x.id === 'ch1_l15')), false);
  assert.ok(claimableCount(g.state) >= 1);
});

test('yeniden doğuş: yıldız kazandırır, ilerlemeyi sıfırlar, kalıcıları korur', () => {
  const g = fresh();
  g.state.stats.runEarned = PRESTIGE.base * 100;       // sqrt(100) = 10
  assert.equal(prestigeGain(g.state), 10);
  g.state.money = 123; g.state.machines[0].level = 50; g.state.machines[1].owned = true; g.state.zones[1].unlocked = true;
  g.state.quests.produce10 = true; g.state.settings.sound = false; g.state.stats.taps = 77;
  assert.equal(g.prestige(), 10);
  const s = g.state;
  assert.equal(s.money, TUNING.startMoney);
  assert.equal(s.machines[0].level, 1);
  assert.equal(s.machines[1].owned, false);
  assert.equal(s.zones[1].unlocked, false);
  assert.equal(s.stats.runEarned, 0);
  assert.equal(s.meta.stars, 10); assert.equal(s.meta.totalStars, 10); assert.equal(s.meta.prestiges, 1);
  assert.equal(s.quests.produce10, true);              // görev ödülü tekrar alınamaz
  assert.equal(s.settings.sound, false);
  assert.equal(s.stats.taps, 77);
  assert.ok(Math.abs(permMult(s) - 2 * achMult(s)) < 1e-9);   // yıldız çarpanı 1 + 10*0.1; rozetler ayrıca eklenir
  assert.equal(g.prestige(), 0);                       // kazanç yokken tekrar yenilenemez
});

test('yeniden doğuş çarpanı geliri gerçekten artırır', () => {
  const a = fresh(); a.state.machines[0].auto = true; a.refresh();
  const b = fresh(); b.state.machines[0].auto = true; b.state.meta.totalStars = 20; b.refresh();
  assert.ok(Math.abs(b.income / a.income - 3 * achMult(b.state) / achMult(a.state)) < 1e-9);   // 20 yıldız = x3 (ve bir 'Yıldız Tozu' rozeti)
});

test('Patent Laboratuvarı: yıldız yetmezse alınmaz, yetince etki eder, maks seviyede durur', () => {
  const g = fresh();
  assert.equal(g.buyPatent('offcap'), false);
  g.state.meta.stars = 1000;
  const cost0 = patentCost(PATENTS.find((p) => p.id === 'offcap'), 0);
  assert.equal(g.buyPatent('offcap'), true);
  assert.equal(g.state.meta.stars, 1000 - cost0);
  assert.equal(offlineCapHours(g.state), TUNING.offline.capHours + 2);
  g.buyPatent('offeff');
  assert.ok(Math.abs(offlineEfficiency(g.state) - 0.55) < 1e-9);
  g.buyPatent('discount');
  assert.equal(machineBuyCost(g.state, MACHINES[1]), Math.ceil(MACHINES[1].baseCost * 0.96));
  for (let i = 0; i < 20; i++) { g.state.meta.stars = 1e9; g.buyPatent('tap'); }
  assert.equal(g.state.meta.shop.tap, PATENTS.find((p) => p.id === 'tap').max);
  assert.equal(g.buyPatent('yok'), false);
});

test('Patent: çevrimdışı süre sınırı ve verim hesaba katılır', () => {
  const g = fresh(); g.state.machines[0].auto = true;
  g.state.meta.shop.offcap = 3; g.state.meta.shop.offeff = 4;
  const r = computeOffline(g.state, 100 * 3600);
  assert.equal(r.seconds, (TUNING.offline.capHours + 6) * 3600);
  assert.ok(Math.abs(r.efficiency - 0.7) < 1e-9);
});

test('Miras Makineler: yeniden doğuşta hazır otomatik makineler ve bölgeleri', () => {
  const g = fresh();
  g.state.meta.shop.heritage = 2;                       // 4 makine
  g.state.stats.runEarned = PRESTIGE.base * 4;
  g.prestige();
  assert.equal(g.state.machines.filter((m) => m.owned && m.auto).length, 4);
  assert.equal(g.state.zones[1].unlocked, true);
  assert.ok(g.income > 0);
});

test('Altın Kasa: gelir yokken çıkmaz, çıkınca dokununca ödül bir kez verilir', () => {
  const g = fresh(seq(0, 0.9, 0.5));
  g.goldenTimer = 1;
  g.update(2); assert.equal(g.golden, null);            // gelir yok
  g.state.machines[0].auto = true; g.refresh();
  g.goldenTimer = 1;
  for (let i = 0; i < 8; i++) g.update(0.25);
  assert.ok(g.golden);
  const before = g.state.money;
  const r = g.collectGolden(1000);
  assert.equal(r.frenzy, false);
  assert.ok(g.state.money > before && r.reward > 0);
  assert.equal(g.collectGolden(1000), null);            // iki kez toplanamaz
  assert.equal(g.state.stats.golden, 1);
});

test('Altın Kasa coşku bonusu geliri x3 yapar ve süresi dolunca biter', () => {
  const g = fresh(seq(0.05));
  g.state.machines[0].auto = true; g.refresh(0);
  const base = g.income;
  g.goldenTimer = 0; g.update(0.1);
  assert.equal(g.collectGolden(0).frenzy, true);
  assert.ok(Math.abs(g.income / base - GOLDEN.frenzyMult) < 1e-9);
  g.refresh(GOLDEN.frenzySecs * 1000 + 1);
  assert.ok(Math.abs(g.income / base - 1) < 1e-9);
});

test('Altın Kasa kaçırılırsa kaybolur', () => {
  const g = fresh(seq(0.5));
  g.state.machines[0].auto = true; g.refresh();
  g.goldenTimer = 0; g.update(0.1);
  assert.ok(g.golden);
  for (let i = 0; i < 60; i++) g.update(0.25);
  assert.equal(g.golden, null);
});

test('günlük hediye: günde bir kez, seri artar, kaçırılınca sıfırlanır, 7. günde yıldız', () => {
  const g = fresh();
  const day = (n) => new Date(2026, 5, 1 + n, 12).getTime();
  assert.equal(g.claimDaily(day(0)).day, 1);
  assert.equal(g.claimDaily(day(0)), null);             // aynı gün ikinci kez yok
  assert.equal(g.claimDaily(day(1)).day, 2);
  assert.equal(g.claimDaily(day(3)).day, 1);            // bir gün kaçırıldı -> seri sıfır
  for (let n = 4; n <= 9; n++) g.claimDaily(day(n));    // gün 2..7
  assert.equal(g.state.daily.streak, 7);
  assert.equal(g.state.meta.stars, DAILY.starsOnLastDay);
  assert.equal(g.claimDaily(day(10)).day, 1);           // 7'den sonra başa döner
  assert.equal(dayKey(day(0)), '2026-06-01');
});

test('günlük hediye parası: gelirden hesaplanır, en az minimum', () => {
  const g = fresh();
  assert.equal(g.claimDaily(Date.now()).money, DAILY.minMoney);
  const g2 = fresh(); g2.state.machines[0].auto = true; g2.state.meta.totalStars = 1e6; g2.refresh();
  assert.ok(g2.claimDaily(Date.now()).money > DAILY.minMoney);
});

test('meta/günlük bozuk kayıtta güvenli: negatif/NaN yıldız temizlenir', () => {
  const s = sanitizeState({ meta: { stars: -5, totalStars: 'x', prestiges: 3.7, shop: { income: 999, yok: 5 } }, daily: { last: 'bugün', streak: 99 } });
  assert.equal(s.meta.stars, 0);
  assert.equal(s.meta.prestiges, 3);
  assert.equal(s.meta.shop.income, PATENTS.find((p) => p.id === 'income').max);
  assert.equal(s.meta.shop.yok, undefined);
  assert.equal(s.daily.last, '');
  assert.equal(s.daily.streak, 7);
});
