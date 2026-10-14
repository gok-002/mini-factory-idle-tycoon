import test from 'node:test';
import assert from 'node:assert/strict';
import { TUNING, MACHINES, QUESTS, UPGRADES, machineReq } from '../src/core/config.js';
import { createDefaultState } from '../src/core/state.js';
import { Game } from '../src/core/sim.js';
import {
  levelUpCost, maxAffordableLevels, itemValue, cycleTime, incomePerSec, levelMult,
  milestoneCount, storageCap, throughput, trackCost,
} from '../src/core/economy.js';
import { computeOffline } from '../src/core/offline.js';
import { formatNum } from '../src/core/format.js';

const fresh = () => new Game(createDefaultState(0));
const run = (g, sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) g.update(dt); };

test('başlangıç değerleri: 100 para, tek makine, 3 sn, ürün başına 10', () => {
  const g = fresh();
  assert.equal(g.state.money, 100);
  assert.equal(g.state.machines.filter((m) => m.owned).length, 1);
  assert.equal(cycleTime(MACHINES[0], g.state.machines[0]), 3);
  assert.equal(itemValue(MACHINES[0], g.state.machines[0]), 10);
  assert.equal(levelUpCost(MACHINES[0], 1), 75);
});

test('otomatik makine 3 sn\'de bir ürün üretir ve satış bandı sonunda para kazandırır', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  run(g, 2.95);
  assert.equal(g.state.stats.produced, 0);
  run(g, 0.1);                                  // 3.05 sn
  assert.equal(g.state.stats.produced, 1);
  assert.equal(g.state.stats.sold, 0);          // bantta
  run(g, TUNING.beltTravelTime + 0.1);
  assert.equal(g.state.stats.sold, 1);
  assert.equal(g.state.money, 110);
  run(g, 60 - 5.35);                            // 60 sn toplam
  assert.equal(g.state.stats.produced, 20);
});

test('manuel makine dokunmadan üretmez; dokunuş ilerletir', () => {
  const g = fresh();
  run(g, 10);
  assert.equal(g.state.stats.produced, 0);
  g.tap(0); g.tap(0);
  assert.equal(g.state.stats.produced, 0);
  g.tap(0);                                     // 3. dokunuş = 3 sn
  assert.equal(g.state.stats.produced, 1);
});

test('yetersiz parayla satın alma/yükseltme yapılamaz, para değişmez', () => {
  const g = fresh();
  g.state.money = 74;
  assert.equal(g.levelUp(0), false);
  assert.equal(g.buyAuto(0), false);
  assert.equal(g.buyMachine(1), false);
  assert.equal(g.buyTrack(0, 'speed'), false);
  assert.equal(g.state.money, 74);
  assert.equal(g.state.machines[0].level, 1);
});

test('yükseltme parayı düşürür, seviye artar, hızlı çift dokunuş fazladan harcamaz', () => {
  const g = fresh();
  g.state.money = 75;
  assert.equal(g.levelUp(0), true);
  assert.equal(g.state.money, 0);
  assert.equal(g.levelUp(0), false);            // ikinci hızlı dokunuş
  assert.equal(g.state.machines[0].level, 2);
});

test('makine satın alma sırayla ve tek sefer', () => {
  const g = fresh();
  g.state.money = 1e6;
  g.state.machines[0].level = 20;               // seviye şartı sağlanmış
  assert.equal(g.buyMachine(2), false);         // 2. makineyi atlayamazsın
  assert.equal(g.buyMachine(1), true);
  const left = g.state.money;
  assert.equal(g.buyMachine(1), false);
  assert.equal(g.state.money, left);
  assert.equal(g.buyMachine(3), false);         // bölge kilitli
});

test('makine satın almak için önceki makinenin seviyesi yeterli olmalı', () => {
  const g = fresh();
  g.state.money = 1e9;
  const need = machineReq(1);
  g.state.machines[0].level = need - 1;
  assert.deepEqual(g.machineBlock(1), { type: 'level', need, have: need - 1 });
  assert.equal(g.buyMachine(1), false);
  assert.equal(g.state.money, 1e9);
  g.state.machines[0].level = need;
  assert.equal(g.machineBlock(1), null);
  assert.equal(g.buyMachine(1), true);
});

test('üretim hızı yükseltmesi süreyi gerçekten kısaltır', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  g.state.money = 1e6;
  g.buyTrack(0, 'speed');
  const t = cycleTime(MACHINES[0], g.state.machines[0]);
  assert.ok(Math.abs(t - 2.7) < 1e-9);
  run(g, 27.2);
  assert.equal(g.state.stats.produced, 10);
});

test('depolama kapasitesi dolunca makine bekler, para yoktan oluşmaz', () => {
  const g = fresh();
  const m = g.state.machines[0];
  m.auto = true; m.speed = 12;                  // çok hızlı
  m.level = 1;
  run(g, 30);
  // bant doluyken en fazla kapasite kadar ürün bantta bekler
  assert.ok(g.rt[0].count <= storageCap(m));
  assert.ok(g.state.stats.produced - g.state.stats.sold <= storageCap(m));
  const expected = g.state.stats.sold * itemValue(MACHINES[0], m);
  assert.ok(Math.abs(g.state.money - 100 - expected) < 1e-6);
});

test('seviye maliyeti: toplu alım tek tek alımla aynı toplamı verir', () => {
  const def = MACHINES[0];
  let sum = 0;
  for (let l = 1; l <= 10; l++) sum += levelUpCost(def, l, 1);
  const bulk = levelUpCost(def, 1, 10);
  assert.ok(Math.abs(bulk - sum) <= 10);        // tavan yuvarlama farkı
  const n = maxAffordableLevels(def, 1, bulk);
  assert.ok(n >= 10 && levelUpCost(def, 1, n) <= bulk);
  assert.equal(maxAffordableLevels(def, 1, 10), 0);
});

test('Max alımı bütçeyi aşmaz', () => {
  const g = fresh();
  g.state.money = 5000;
  g.levelUp(0, -1);
  assert.ok(g.state.money >= 0);
  assert.ok(g.state.machines[0].level > 1);
});

test('kilometre taşları değeri ikiye katlar; maliyetler monoton artar', () => {
  assert.equal(milestoneCount(9), 0);
  assert.equal(milestoneCount(10), 1);
  assert.equal(levelMult(10), 20);
  for (const d of MACHINES) {
    let prev = 0;
    for (let l = 1; l < 100; l++) { const c = levelUpCost(d, l); assert.ok(c > prev && Number.isFinite(c)); prev = c; }
    for (const t of Object.keys(UPGRADES)) assert.ok(trackCost(d, t, 1) > trackCost(d, t, 0));
  }
});

test('gelir yalnızca otomatik makinelerden hesaplanır', () => {
  const g = fresh();
  assert.equal(incomePerSec(g.state), 0);
  g.state.machines[0].auto = true;
  assert.ok(Math.abs(incomePerSec(g.state) - 10 / 3) < 1e-9);
});

test('çevrimdışı kazanç: verimlilik ve üst sınır', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  const rate = incomePerSec(g.state);
  const r1 = computeOffline(g.state, 3600);
  assert.ok(Math.abs(r1.earned - rate * 3600 * TUNING.offline.efficiency) < 1e-6);
  const r2 = computeOffline(g.state, 100 * 3600);
  assert.equal(r2.capped, true);
  assert.ok(Math.abs(r2.earned - rate * TUNING.offline.capHours * 3600 * TUNING.offline.efficiency) < 1e-6);
  assert.equal(computeOffline(g.state, -50).earned, 0);
  assert.equal(computeOffline(g.state, NaN).earned, 0);
  assert.equal(computeOffline(createDefaultState(0), 3600).earned, 0); // otomasyon yok
});

test('çevrimdışı kazanç iki kez alınamaz', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  g.state.lastSeen = 0;
  const r = g.applyOffline(2 * 3600 * 1000);
  assert.ok(r && r.earned > 0);
  const money = g.state.money;
  assert.equal(g.applyOffline(2 * 3600 * 1000), null);
  assert.equal(g.state.money, money);
  assert.equal(g.applyOffline(2 * 3600 * 1000 + 500), null);    // 0.5 sn: ihmal
  assert.equal(g.state.money, money);
});

test('saat geri alınırsa kazanç olmaz', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  g.state.lastSeen = 1e12;
  assert.equal(g.applyOffline(1e12 - 3600 * 1000), null);
});

test('görevler ilerler ve ödül yalnızca bir kez alınır', () => {
  const g = fresh();
  const q = QUESTS.find((x) => x.id === 'produce10');
  assert.equal(g.claimQuest('produce10'), 0);   // henüz bitmedi
  for (let i = 0; i < 30; i++) { g.tap(0); run(g, 1); } // 10 ürün (bant boşalsın diye bekleyerek)
  assert.ok(g.state.stats.produced >= 10);
  const before = g.state.money;
  const r = g.claimQuest('produce10');
  assert.equal(r, q.reward.money);
  assert.equal(g.state.money, before + r);
  assert.equal(g.claimQuest('produce10'), 0);
  assert.equal(g.state.money, before + r);
});

test('bölge açma: önceki bölge tamamlanmadan açılmaz', () => {
  const g = fresh();
  g.state.money = 1e12;
  for (let i = 0; i < 3; i++) g.state.machines[i].level = 60;
  assert.equal(g.unlockZone(1), false);
  g.buyMachine(1); g.buyMachine(2);
  assert.equal(g.unlockZone(1), true);
  assert.equal(g.buyMachine(3), true);
  assert.equal(g.unlockZone(1), false);         // tekrar açılamaz
});

test('geçersiz değerler paraya sızmaz', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  g._earn(NaN); g._earn(-5); g._earn(Infinity);
  assert.equal(g.state.money, 100);
  g.update(NaN); g.update(-1); g.update(Infinity);
  assert.equal(g.state.money, 100);
  assert.equal(g._spend(NaN), false);
});

test('büyük dt (arka plan dönüşü) tek karede aşırı üretim yapmaz', () => {
  const g = fresh();
  g.state.machines[0].auto = true;
  g.update(3600);
  assert.ok(g.state.stats.produced <= 1);
});

test('sayı biçimlendirme', () => {
  assert.equal(formatNum(0), '0');
  assert.equal(formatNum(NaN), '0');
  assert.equal(formatNum(999), '999');
  assert.equal(formatNum(1234), '1.23K');
  assert.equal(formatNum(999999), '1M');
  assert.equal(formatNum(1.5e9), '1.5B');
  assert.equal(throughput(MACHINES[0], createDefaultState().machines[0]) > 0, true);
});
