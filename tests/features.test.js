import test from 'node:test';
import assert from 'node:assert/strict';
import { MACHINES, ACHIEVEMENTS, ACH_BONUS, MISSIONS, RUSH, SAVE_VERSION } from '../src/core/config.js';
import { createDefaultState, sanitizeState } from '../src/core/state.js';
import { Game } from '../src/core/sim.js';
import { achMult, achCount, permMult, incomePerSec } from '../src/core/economy.js';
import { METRICS } from '../src/core/quests.js';
import { computeOffline } from '../src/core/offline.js';
import { encodeSave, decodeSave } from '../src/core/savecode.js';
import { SaveManager, MemoryStorage, migrate } from '../src/core/save.js';
import { Feedback } from '../src/services/audio.js';

const fresh = (events, rng) => new Game(createDefaultState(0), events ? (t, a, b, c) => events.push([t, a, b, c]) : undefined, rng);
const run = (g, sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) g.update(dt); };
const noon = (d) => new Date(2026, 5, d, 12).getTime();   // yerel öğlen: gün anahtarı kararlı

// ------------------------------------------------------------------ rozetler
test('rozet içeriği: benzersiz kimlik, geçerli ölçüt, artan hedefler', () => {
  assert.equal(ACHIEVEMENTS.length, 50);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const last = {};
  for (const a of ACHIEVEMENTS) {
    assert.ok(METRICS[a.metric], 'bilinmeyen ölçüt: ' + a.metric);
    assert.ok(a.title && a.desc && a.target > 0 && a.tier >= 0 && a.tier <= 3);
    if (last[a.metric] !== undefined) assert.ok(a.target > last[a.metric], 'hedefler artmalı: ' + a.id);
    last[a.metric] = a.target;
  }
});

test('rozet şart sağlanınca bir kez verilir ve kalıcı gelir çarpanı ekler', () => {
  const ev = [], g = fresh(ev);
  g.state.machines[0].auto = true; g.refresh();
  const before = g.income;
  assert.equal(achCount(g.state), 0);
  g.state.stats.produced = 1; g.refresh();
  assert.equal(g.state.ach.a_prod1, true);
  assert.equal(ev.filter((e) => e[0] === 'achievement' && e[1] === 'a_prod1').length, 1);
  assert.ok(Math.abs(g.income / before - (1 + ACH_BONUS)) < 1e-9);       // çarpan hemen işler
  g.refresh(); g.refresh();
  assert.equal(ev.filter((e) => e[0] === 'achievement' && e[1] === 'a_prod1').length, 1);
});

test('rozet bonusu çevrimdışı kazanca da uygulanır', () => {
  const g = fresh(); g.state.machines[0].auto = true;
  const a = computeOffline(g.state, 3600).earned;
  for (const x of ACHIEVEMENTS.slice(0, 10)) g.state.ach[x.id] = true;
  const b = computeOffline(g.state, 3600).earned;
  assert.ok(Math.abs(b / a - achMult(g.state)) < 1e-9);
  assert.ok(Math.abs(achMult(g.state) - 1.1) < 1e-9);
  assert.ok(permMult(g.state) >= achMult(g.state));
});

test('eski kayıt yüklenirken hak edilen rozetler sessizce verilir (bildirim yağmuru yok)', () => {
  const st = createDefaultState(0);
  st.stats.produced = 2e4; st.stats.taps = 3000; st.stats.earned = 2e6;
  const ev = [], g = new Game(st, (t) => ev.push(t));
  assert.ok(g.backfilled >= 5);
  assert.equal(ev.includes('achievement'), false);
  assert.equal(achCount(g.state), g.backfilled);
});

test('prestij rozetleri silmez', () => {
  const g = fresh();
  g.state.stats.produced = 1; g.state.stats.runEarned = 8e9; g.refresh();
  assert.equal(g.state.ach.a_prod1, true);
  assert.ok(g.prestige() > 0);
  assert.equal(g.state.ach.a_prod1, true);
});

// ------------------------------------------------------------------ kayıt alanları
test('yeni alanlar bozuk veriden güvenle onarılır', () => {
  const raw = { ach: { a_prod1: true, yok_boyle_rozet: true, a_tap1: 'evet' }, tut: { level: true, bilinmeyen: true, auto: 1 },
    dm: { day: 'dün', list: [{ id: 'tap' }] }, settings: { music: false }, stats: { rushDone: -5, missionsDone: 'x', playSecs: NaN } };
  const s = sanitizeState(raw, 1000);
  assert.deepEqual(Object.keys(s.ach), ['a_prod1']);
  assert.deepEqual(Object.keys(s.tut), ['level']);
  assert.equal(s.dm.day, ''); assert.equal(s.dm.list.length, 0);
  assert.equal(s.settings.music, false);
  assert.equal(s.stats.rushDone, 0); assert.equal(s.stats.missionsDone, 0); assert.equal(s.stats.playSecs, 0);
  assert.equal(sanitizeState({}, 1).settings.music, true);
  assert.equal(sanitizeState('çöp', 1).dm.list.length, 0);
});

test('v2 kaydı v3 şemasına taşınır ve eski ilerleme korunur', () => {
  const old = { v: 2, money: 777, machines: [{ id: 'press', owned: true, level: 12, auto: true }], settings: { sound: false, haptics: true }, quests: { produce10: true } };
  const st = new MemoryStorage(); st.setItem('miniFactory.save', JSON.stringify(old));
  const { state, status } = new SaveManager(st).load(5);
  assert.equal(status, 'ok');
  assert.equal(state.v, SAVE_VERSION);
  assert.equal(state.money, 777); assert.equal(state.machines[0].level, 12); assert.equal(state.quests.produce10, true);
  assert.equal(state.settings.sound, false); assert.equal(state.settings.music, true);
  assert.deepEqual(state.ach, {});
  assert.equal(migrate({ v: 2 }).v, 3);
});

test('oynama süresi sayılır', () => {
  const g = fresh();
  run(g, 10, 0.1);
  assert.ok(Math.abs(g.state.stats.playSecs - 10) < 0.2);
});

// ------------------------------------------------------------------ günlük görevler
test('günlük görevler: 3 farklı görev, aynı gün aynı görevler, hedefler makul', () => {
  const g = fresh(); g.refresh(noon(10));
  const list = g.missions();
  assert.equal(list.length, MISSIONS.count);
  assert.equal(new Set(list.map((m) => m.id)).size, MISSIONS.count);
  const g2 = fresh(); g2.refresh(noon(10));
  assert.deepEqual(g2.missions().map((m) => [m.id, m.target]), list.map((m) => [m.id, m.target]));
  for (let d = 1; d <= 60; d++) {              // her gün: farklı seçim, hedefler sınırlar içinde, kilitli Acil Sipariş görevi çıkmaz
    const x = fresh(); x.refresh(noon(d % 28 + 1) + Math.floor(d / 28) * 28 * 864e5);
    const ids = x.missions().map((m) => m.id);
    assert.equal(new Set(ids).size, MISSIONS.count);
    assert.equal(ids.includes('rush'), false);
    for (const m of x.missions()) { assert.ok(m.target >= 1); assert.ok(m.reward >= 300); }
  }
});

test('Altın Kasa görevi yalnızca geliri olan oyuncuya verilir', () => {
  const withIncome = new Set();
  for (let d = 0; d < 40; d++) {
    const a = fresh(); a.refresh(noon(1) + d * 864e5);
    assert.equal(a.missions().some((m) => m.id === 'gold'), false);        // gelir yok: kasa belirmez
    const b = fresh(); b.state.machines[0].auto = true; b.refresh();
    b.state.dm.day = ''; b.refresh(noon(1) + d * 864e5);
    b.missions().forEach((m) => withIncome.add(m.id));
  }
  assert.ok(withIncome.has('gold'));
});

test('Acil Sipariş açıkken günlük görev havuzuna girebilir', () => {
  const seen = new Set();
  for (let d = 0; d < 40; d++) {
    const g = fresh(); g.state.stats.sold = RUSH.minSold; g.state.machines[1].owned = true;
    g.refresh(noon(1) + d * 864e5);
    g.missions().forEach((m) => seen.add(m.id));
  }
  assert.ok(seen.has('rush'));
});

test('görev ilerlemesi bugünkü artıştan sayılır; ödül tek sefer; sandık hepsi alınınca', () => {
  const ev = [], g = fresh(ev); g.state.stats.taps = 500; g.state.stats.earned = 5000;
  g.now = () => noon(10); g.refresh();
  const before = g.missions();
  assert.ok(before.every((m) => m.progress === 0 && !m.done));            // eski toplamlar sayılmaz
  assert.equal(g.claimMission(0), 0);                                       // bitmeden alınamaz
  assert.equal(g.chestReady(), false);
  assert.equal(g.claimChest(), 0);
  for (const m of before) {
    const def = MISSIONS.pool.find((p) => p.id === m.id);
    g.state.stats[def.metric] += m.target;
  }
  g.refresh();
  assert.ok(g.missions().every((m) => m.done));
  assert.equal(g.missionClaimable(), 3);
  assert.ok(ev.filter((e) => e[0] === 'missionReady').length >= 3);
  let money = g.state.money;
  for (let i = 0; i < 3; i++) {
    assert.equal(g.chestReady(), false);
    const r = g.claimMission(i);
    assert.ok(r > 0);
    assert.equal(g.claimMission(i), 0);                                     // çift ödül yok
    assert.ok(g.state.money >= money + r - 1e-6); money = g.state.money;
  }
  assert.equal(g.state.stats.missionsDone, 3);
  assert.equal(g.chestReady(), true);
  const chest = g.claimChest();
  assert.ok(chest >= MISSIONS.chestMin);
  assert.equal(g.claimChest(), 0);
  assert.equal(g.chestReady(), false);
});

test('yeni güne geçince görevler yenilenir; aynı günde yeniden yükleme ilerlemeyi korur', () => {
  const g = fresh(); g.now = () => noon(10); g.refresh();
  const first = g.missions().map((m) => m.id);
  g.state.stats[MISSIONS.pool.find((p) => p.id === first[0]).metric] += 1e6;
  g.refresh();
  assert.ok(g.claimMission(0) > 0);
  const saved = JSON.parse(JSON.stringify(g.state));
  const g2 = new Game(sanitizeState(saved, noon(10)), undefined, undefined, () => noon(10));
  assert.equal(g2.missions()[0].claimed, true);                             // kayıttan geri geldi
  assert.deepEqual(g2.missions().map((m) => m.id), first);
  g2.now = () => noon(11); g2.refresh();
  assert.equal(g2.missions().every((m) => !m.claimed), true);
  assert.equal(g2.state.dm.chest, false);
  assert.notEqual(g2.state.dm.day, saved.dm.day);
});

// ------------------------------------------------------------------ Acil Sipariş
const openRush = (rng = () => 0.5) => {
  const ev = [], g = fresh(ev, rng);
  g.state.stats.sold = RUSH.minSold; g.state.machines[1].owned = true; g.refresh();
  return { g, ev };
};

test('Acil Sipariş şartlar sağlanmadan çıkmaz', () => {
  const g = fresh(null, () => 0);
  run(g, 1000, 0.1);
  assert.equal(g.rush, null);                                   // satış ve makine şartı yok
  g.state.stats.sold = RUSH.minSold;
  run(g, 1000, 0.1);
  assert.equal(g.rush, null);                                   // tek makine
});

test('Acil Sipariş zamanı gelince başlar, hedef sınırlar içindedir', () => {
  const { g, ev } = openRush(() => 0.5);
  run(g, 150, 0.1);
  assert.equal(g.rush, null);                                   // 150-240 sn arası bekler (0.5 -> 195 sn)
  run(g, 60, 0.1);
  assert.ok(g.rush);
  assert.equal(ev.filter((e) => e[0] === 'rushStart').length, 1);
  assert.ok(g.rush.target >= RUSH.minTarget);
  assert.ok(g.rush.ttl <= RUSH.ttl && g.rush.ttl > 0);
  assert.ok(g.rushReward() >= RUSH.rewardMin);
});

test('Acil Sipariş: süre dolarsa kaçar, ceza yok, sonrakini bekler', () => {
  const { g, ev } = openRush();
  run(g, 200, 0.1);
  assert.ok(g.rush);
  const money = g.state.money;
  run(g, RUSH.ttl + 1, 0.1);
  assert.equal(g.rush, null);
  assert.equal(ev.filter((e) => e[0] === 'rushFail').length, 1);
  assert.equal(g.state.stats.rushDone, 0);
  assert.equal(g.state.money, money);
  assert.ok(g.rushTimer >= RUSH.gapMin - 2);
});

test('Acil Sipariş yalnızca hedef makinenin satışını sayar; tamamlanınca ödül tek sefer', () => {
  const { g, ev } = openRush();
  g.rush = { machine: 1, target: 5, got: 0, ttl: 30, max: 30 };
  g._sell(0, 50);
  assert.equal(g.rush.got, 0);
  g._sell(1, 4);
  assert.equal(g.rush.got, 4);
  const money = g.state.money;
  g._sell(1, 3);
  assert.equal(g.rush, null);
  assert.equal(g.state.stats.rushDone, 1);
  const done = ev.filter((e) => e[0] === 'rushDone');
  assert.equal(done.length, 1);
  assert.ok(g.state.money >= money + done[0][2]);
  g._sell(1, 100);                                             // artık sipariş yok: ödül tekrarlanmaz
  assert.equal(g.state.stats.rushDone, 1);
});

test('Acil Sipariş gerçek oyunla tamamlanabilir (otomatik makine + dokunuş)', () => {
  const { g } = openRush();
  g.state.machines[1].auto = true;
  run(g, 200, 0.1);
  assert.ok(g.rush);
  for (let t = 0; t < RUSH.ttl && g.rush; t += 0.25) { g.tap(g.rush.machine); run(g, 0.25, 0.05); }
  assert.equal(g.rush, null);
  assert.equal(g.state.stats.rushDone, 1);
});

test('prestij ve çevrimdışı hesap etkin siparişi iptal eder', () => {
  const a = openRush().g;
  a.rush = { machine: 1, target: 5, got: 0, ttl: 20, max: 30 };
  a.applyOffline(Date.now() + 120000);
  assert.equal(a.rush, null);
  const b = openRush().g;
  b.rush = { machine: 1, target: 5, got: 0, ttl: 20, max: 30 };
  b.state.stats.runEarned = 8e9;
  assert.ok(b.prestige() > 0);
  assert.equal(b.rush, null);
});

test('hedef sayı, yavaş makinede uygulanabilir ve hızlı makinede bant kapasitesini aşmaz', () => {
  const g = fresh();
  g.state.machines[1].owned = true;
  for (let i = 0; i < 2; i++) {
    const t = g.rushTarget(i);
    assert.ok(t >= RUSH.minTarget && t <= Math.floor(RUSH.ttl * (3 / 2.2) * 0.6) + 0);
  }
  g.state.machines[1].speed = 12;                              // çok hızlı makine
  assert.ok(g.rushTarget(1) <= Math.floor(RUSH.ttl * (3 / 2.2) * 0.6));
});

// ------------------------------------------------------------------ kayıt kodu
test('kayıt kodu: gidiş-dönüş, boşluk/satır sonu toleransı, çevrimdışı kazanç sıfırlanır', () => {
  const g = fresh(); g.state.money = 12345; g.state.machines[0].level = 33; g.state.machines[0].auto = true; g.state.ach.a_prod1 = true;
  g.state.lastSeen = 1000;
  const code = encodeSave(g.state);
  assert.ok(code.startsWith('MF1.') && !/\s/.test(code));
  const res = decodeSave('  ' + code.slice(0, 20) + '\n' + code.slice(20) + '  ', 9e9);
  assert.equal(res.ok, true);
  assert.equal(res.state.money, 12345);
  assert.equal(res.state.machines[0].level, 33);
  assert.equal(res.state.machines[0].auto, true);
  assert.equal(res.state.ach.a_prod1, true);
  assert.equal(res.state.lastSeen, 9e9);                       // kod beklerken biriken süre kazanç sayılmaz
  assert.equal(res.state.v, SAVE_VERSION);
});

test('kayıt kodu: bozuk, kurcalanmış, boş ve yabancı metinler reddedilir', () => {
  const code = encodeSave(createDefaultState(0));
  for (const bad of ['', 'merhaba', 'MF1.', 'MF1..', 'MF1.abc.def', null, undefined, 42, '{"money":1e300}', 'MF1.' + 'A'.repeat(50) + '.zz']) {
    assert.equal(decodeSave(bad).ok, false, String(bad));
  }
  const parts = code.split('.');
  const tampered = parts[0] + '.' + parts[1].slice(0, 10) + (parts[1][10] === 'A' ? 'B' : 'A') + parts[1].slice(11) + '.' + parts[2];
  assert.equal(decodeSave(tampered).ok, false);                // sağlama toplamı tutmaz
  assert.equal(decodeSave('MF1.' + 'x'.repeat(500000) + '.1').ok, false);
});

test('kayıt kodundaki aşırı değerler sanitize ile sınırlanır', () => {
  const evil = createDefaultState(0);
  evil.machines[0].level = 1e9; evil.money = -5; evil.meta.stars = 'çok';
  const res = decodeSave(encodeSave(evil), 1);
  assert.equal(res.ok, true);
  assert.ok(res.state.machines[0].level <= 500);
  assert.equal(res.state.money, 0);
  assert.equal(res.state.meta.stars, 0);
});

// ------------------------------------------------------------------ ses (tarayıcı olmadan)
test('Feedback tarayıcısız ortamda hata vermez; unlock ses bağlamını başlatan yöntemdir (fanfar ayrı)', () => {
  const fb = new Feedback({ sound: true, haptics: true, music: true });
  assert.notEqual(typeof fb.fanfare, 'undefined');
  fb.unlock();
  assert.equal(fb.active, true);
  fb.tap(); fb.sell(); fb.fanfare(); fb.medal(); fb.alarm(); fb.setMood(5); fb.startMusic(); fb.applyMusicSetting(); fb.stopMusic();
  assert.equal(fb.wantMood, 5);
  fb.setMood(99); assert.equal(fb.wantMood, 7);
});

test('Feedback müzik zamanlayıcısı: sahte ses bağlamıyla notaları üretir ve durdurulabilir', () => {
  const made = { osc: 0, gain: 0 };
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} }, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 } });
  const ctx = { currentTime: 0, state: 'running', destination: {}, createOscillator() { made.osc++; return node(); }, createGain() { made.gain++; return node(); }, resume() {}, suspend() {} };
  const fb = new Feedback({ sound: true, haptics: false, music: true });
  fb.ctx = ctx; fb.master = node(); fb.musicBus = node(); fb.active = true;
  fb.startMusic();
  assert.ok(fb._timer);
  ctx.currentTime = 5;                                          // zaman ilerledi: zamanlayıcı geriye dönük notaları üretir
  fb._schedule();
  assert.ok(made.osc > 5);
  fb.settings.music = false;
  fb.applyMusicSetting();
  assert.equal(fb._timer, null);
});

test('yüklemede zaten biten görevler için bildirim gelmez, ödül yine alınabilir', () => {
  const g = fresh(); g.now = () => noon(10); g.refresh();
  const m0 = g.missions()[0];
  g.state.stats[MISSIONS.pool.find((p) => p.id === m0.id).metric] += m0.target;
  const saved = JSON.parse(JSON.stringify(g.state));
  const ev = [];
  const g2 = new Game(sanitizeState(saved, noon(10)), (t) => ev.push(t), undefined, () => noon(10));
  assert.equal(ev.includes('missionReady'), false);
  assert.equal(g2.missionClaimable(), 1);
  assert.ok(g2.claimMission(0) > 0);
});
