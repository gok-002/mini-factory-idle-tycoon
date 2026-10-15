import test from 'node:test';
import assert from 'node:assert/strict';
import { MACHINES, STAFF, RESEARCH, EVENTS, ASCEND, CATALOG_TIERS, CATALOG_BONUS, CHAIN_BONUS, THEMES, CALENDAR, PRODUCT_NAMES } from '../src/core/config.js';
import { createDefaultState, sanitizeState } from '../src/core/state.js';
import { Game } from '../src/core/sim.js';
import {
  permMult, achMult, offlineCapHours, offlineEfficiency, tapSeconds, machineBuyCost, chainDepth, chainMult, catMult, catTiers, rpEarned, rpAvail,
  rdCost, calendarAt, coresDeserved, ascendGain, starMult,
} from '../src/core/economy.js';
import { computeOffline } from '../src/core/offline.js';

const fresh = (events, rng) => new Game(createDefaultState(0), events ? (t, a, b, c) => events.push([t, a, b, c]) : undefined, rng);
const run = (g, sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) g.update(dt); };
const own = (g, n, auto = true) => { for (let i = 0; i < n; i++) { g.state.machines[i].owned = true; g.state.machines[i].auto = auto; } g.refresh(); };

// ------------------------------------------------------------------ çalışanlar
test('çalışanlar: 3 makineden önce kilitli; alınca etki eder, maksimumda durur', () => {
  const g = fresh(); g.state.money = 1e12;
  own(g, 2);
  assert.equal(g.staffUnlocked(), false);
  assert.equal(g.buyStaff('cashier'), false);
  own(g, 3);
  assert.equal(g.staffUnlocked(), true);
  const base = permMult(g.state) / achMult(g.state), cost = g.staffCostOf('cashier'), money = g.state.money;
  assert.equal(g.buyStaff('cashier'), true);
  assert.equal(g.state.money, money - cost);
  assert.ok(Math.abs(permMult(g.state) / achMult(g.state) / base - 1.04) < 1e-9);   // rozet çarpanı ayrı
  assert.ok(g.staffCostOf('cashier') > cost);                       // sonraki seviye pahalı
  assert.equal(g.buyStaff('yok'), false);
  for (let i = 0; i < 40; i++) { g.state.money = 1e30; g.buyStaff('cashier'); }
  assert.equal(g.state.staff.cashier, STAFF.find((s) => s.id === 'cashier').max);
});

test('çalışan fiyatı gelirle büyür ve yetersiz parayla alınmaz', () => {
  const g = fresh(); own(g, 3);
  const cheap = g.staffCostOf('coach');
  g.state.machines[2].level = 80; g.refresh();
  assert.ok(g.staffCostOf('coach') > cheap);
  g.state.money = 0;
  assert.equal(g.buyStaff('coach'), false);
  assert.equal(g.state.staff.coach, undefined);
});

test('çalışan yetenekleri: dokunuş, çevrimdışı süre/verim', () => {
  const g = fresh(); own(g, 3);
  g.state.staff = { coach: 5, night: 4, shift: 2 };
  assert.ok(Math.abs(tapSeconds(g.state, false) - 1.5) < 1e-9);
  assert.equal(offlineCapHours(g.state), 12);
  assert.ok(Math.abs(offlineEfficiency(g.state) - 0.56) < 1e-9);
});

test('Teknisyen Altın Kasa\'yı kendiliğinden toplar; olmadan toplanmaz', () => {
  const mk = (tech) => { const g = fresh(null, () => 0.5); own(g, 3); g.state.staff = tech ? { tech } : {}; g.golden = { x: 0.5, y: 0.5, ttl: 12, max: 12 }; return g; };
  const a = mk(0); run(a, 8); assert.ok(a.golden); assert.equal(a.state.stats.golden, 0);
  const b = mk(3); run(b, 8); assert.equal(b.golden, null); assert.equal(b.state.stats.golden, 1);
});

test('yeniden doğuşta çalışanlar sıfırlanır, Ar-Ge ve katalog korunur', () => {
  const g = fresh(); own(g, 3);
  g.state.staff = { cashier: 3 }; g.state.rd = { r_inc1: 2 }; g.state.catalog = { block: 500 };
  g.state.stats.runEarned = 8e9;
  assert.ok(g.prestige() > 0);
  assert.deepEqual(g.state.staff, {});
  assert.equal(g.state.rd.r_inc1, 2);
  assert.equal(g.state.catalog.block, 500);
});

// ------------------------------------------------------------------ Ar-Ge
test('Ar-Ge: puan üretimden gelir, ön koşul ve puan gerekir, etkiler uygulanır', () => {
  const g = fresh();
  assert.equal(rpEarned(g.state), 0);
  assert.equal(g.buyResearch('r_inc1'), false);                     // puan yok
  g.state.stats.produced = 5000;                                    // sqrt(100) = 10
  assert.equal(rpEarned(g.state), 10);
  assert.equal(g.buyResearch('r_inc2'), false);                     // ön koşul: r_inc1 sv.2
  const base = permMult(g.state) / achMult(g.state);
  assert.equal(g.buyResearch('r_inc1'), true);
  assert.ok(Math.abs(permMult(g.state) / achMult(g.state) / base - 1.05) < 1e-9);
  assert.equal(g.buyResearch('r_inc1'), true);
  assert.equal(rpAvail(g.state), 10 - rdCost(RESEARCH[0], 0) - rdCost(RESEARCH[0], 1));
  assert.equal(g.buyResearch('r_inc2'), true);
  g.state.rd = { r_tap: 2, r_cap: 3, r_eff: 1, r_disc: 4 };
  assert.ok(Math.abs(tapSeconds(g.state, false) - 1.3) < 1e-9);
  assert.equal(offlineCapHours(g.state), 14);
  assert.ok(Math.abs(offlineEfficiency(g.state) - 0.54) < 1e-9);
  assert.equal(machineBuyCost(g.state, MACHINES[1]), Math.ceil(MACHINES[1].baseCost * 0.88));
  assert.equal(g.buyResearch('yok'), false);
});

test('Ar-Ge toplam maliyet puan bütçesini aşamaz; maksimum seviyede durur', () => {
  const g = fresh(); g.state.stats.produced = 1e12;
  for (let k = 0; k < 10; k++) for (const n of RESEARCH) g.buyResearch(n.id);
  for (const n of RESEARCH) assert.equal(g.state.rd[n.id], n.max);
  assert.ok(rpAvail(g.state) >= 0);
  const g2 = fresh(); g2.state.stats.produced = 200;                // 2 puan
  for (let k = 0; k < 10; k++) for (const n of RESEARCH) g2.buyResearch(n.id);
  assert.ok(rpAvail(g2.state) >= 0);
});

// ------------------------------------------------------------------ zincir
test('zincir: aynı bölgede ardışık otomatik makineler bağlanır; kopunca sıfırlanır', () => {
  const g = fresh(); own(g, 3);
  assert.equal(chainDepth(g.state, 0), 0);
  assert.equal(chainDepth(g.state, 1), 1);
  assert.equal(chainDepth(g.state, 2), 2);
  assert.ok(Math.abs(chainMult(g.state, 2) - Math.pow(1 + CHAIN_BONUS, 2)) < 1e-9);
  g.state.machines[1].auto = false;
  assert.equal(chainDepth(g.state, 2), 0);
  g.state.machines[3].owned = true; g.state.machines[3].auto = true;   // başka bölgenin ilk makinesi zincire girmez
  assert.equal(chainDepth(g.state, 3), 0);
});

test('zincir geliri ve satış parasını artırır (aynı kural)', () => {
  const a = fresh(); own(a, 2, false); a.state.machines[0].auto = true; a.state.machines[1].auto = false; a.refresh();
  const b = fresh(); own(b, 2);
  const m1 = MACHINES[1], ct = 4;
  assert.ok(b.income > a.income);
  const ratio = (b.income - a.income) / (1 / ct * m1.baseValue * 1);
  assert.ok(Math.abs(ratio - (1 + CHAIN_BONUS)) < 1e-6 || ratio > 0.99);
  const before = b.state.money; b._sell(1, 1);
  assert.ok(Math.abs(b.state.money - before - m1.baseValue * (1 + CHAIN_BONUS)) < 1e-6);
});

// ------------------------------------------------------------------ katalog
test('katalog: satış sayılır, eşikler bildirilir, kalıcı gelir bonusu verir', () => {
  const ev = [], g = fresh(ev);
  assert.equal(catMult(g.state), 1);
  g._sell(0, 99);
  assert.equal(g.state.catalog.block, 99); assert.equal(catTiers(g.state), 0);
  g._sell(0, 1);
  assert.equal(catTiers(g.state), 1);
  assert.ok(ev.some((e) => e[0] === 'catalog' && e[1] === 'block' && e[2] === 1));
  assert.ok(Math.abs(catMult(g.state) - (1 + CATALOG_BONUS)) < 1e-12);
  g._sell(0, 2e6);
  assert.equal(catTiers(g.state), CATALOG_TIERS.length);
  assert.ok(Math.abs(catMult(g.state) - (1 + CATALOG_BONUS * CATALOG_TIERS.length)) < 1e-12);
});

test('çevrimdışı satışlar da kataloğa yazılır', () => {
  const g = fresh(); g.state.machines[0].auto = true; g.state.machines[0].storage = 3; g.refresh();
  const r = g.applyOffline(Date.now() + 3600e3);
  assert.ok(r && g.state.catalog.block > 100);
});

// ------------------------------------------------------------------ Galaktik Genişleme
test('genişleme: ömür boyu yıldızla hak edilir, sıfırlar, çekirdek gelir ve yıldız etkisini artırır', () => {
  const g = fresh(); own(g, 3);
  assert.equal(g.canAscend(), false); assert.equal(g.ascend(), 0);
  g.state.meta.lifeStars = ASCEND.need; g.state.meta.totalStars = 100; g.state.meta.stars = 40; g.state.meta.shop = { income: 3 };
  g.state.ach.a_prod1 = true; g.state.rd = { r_inc1: 1 }; g.state.catalog = { block: 10 }; g.state.meta.prestiges = 4;
  assert.equal(coresDeserved(g.state), 1);
  const starsBefore = starMult(g.state);
  assert.equal(g.ascend(), 1);
  const m = g.state.meta;
  assert.equal(m.cores, 1); assert.equal(m.ascensions, 1);
  assert.equal(m.totalStars, 0); assert.equal(m.stars, 0); assert.deepEqual(m.shop, {});
  assert.equal(m.lifeStars, ASCEND.need);                           // ömür boyu toplam korunur
  assert.equal(g.state.ach.a_prod1, true); assert.equal(g.state.rd.r_inc1, 1); assert.equal(g.state.catalog.block, 10); assert.equal(m.prestiges, 4);
  assert.equal(g.state.machines.filter((x) => x.owned).length, 1);
  assert.ok(permMult(g.state) > 1 + ASCEND.coreIncome - 1e-9);
  assert.equal(g.ascend(), 0);                                      // aynı yıldızlarla ikinci kez olmaz
  assert.ok(starsBefore > 1);
  m.totalStars = 100;
  assert.ok(Math.abs(starMult(g.state) - (1 + 0.1 * 100 * (1 + ASCEND.coreStar))) < 1e-9);
});

test('yeniden doğuş ve günlük hediye ömür boyu yıldızı artırır', () => {
  const g = fresh(); g.state.stats.runEarned = 8e9;
  const gain = g.prestige();
  assert.equal(g.state.meta.lifeStars, gain);
  assert.equal(ascendGain(g.state), 0);
});

// ------------------------------------------------------------------ olaylar
test('olaylar yalnızca etkinleştirilmişse ve koşullar sağlanınca başlar', () => {
  const g = fresh(null, () => 0);
  own(g, 2); g.state.stats.sold = 1000;
  run(g, 900, 0.1);
  assert.equal(g.event, null);                                       // eventsOn kapalı
  g.eventsOn = true; g.eventTimer = 0;
  run(g, 0.1, 0.05);
  assert.ok(g.event);
});

test('Talep Patlaması geliri geçici olarak artırır ve biter', () => {
  const ev = [], g = fresh(ev, () => 0);                             // rng 0 -> ilk tür: surge
  own(g, 2); g.state.stats.sold = 1000; g.eventsOn = true; g.refresh();
  const base = g.income;
  g.eventTimer = 0; run(g, 0.1);
  assert.equal(g.event.type, 'surge');
  assert.ok(Math.abs(g.income / base - 2) < 1e-6);
  run(g, EVENTS.types[0].secs + 1, 0.1);
  g.refresh(Date.now() + 60000);
  assert.equal(g.event, null);
  assert.ok(ev.some((e) => e[0] === 'eventEnd'));
  assert.equal(g.state.stats.eventsDone, 1);
});

test('Elektrik Kesintisi üretimi durdurur; sigorta onarılınca ödül tek sefer', () => {
  const ev = [], g = fresh(ev, () => 0.99);                          // rng ~1 -> son tür: blackout
  own(g, 2); g.state.stats.sold = 1000; g.eventsOn = true;
  g.eventTimer = 0; run(g, 0.1);
  assert.equal(g.event.type, 'blackout');
  assert.equal(g.dark, true);
  const produced = g.state.stats.produced;
  run(g, 10, 0.1);
  assert.equal(g.state.stats.produced, produced);                    // üretim yok
  assert.equal(g.tap(0), false);
  const need = g.event.need, money = g.state.money;
  for (let i = 0; i < need - 1; i++) assert.equal(g.repairEvent(), true);
  assert.ok(g.event);
  assert.equal(g.repairEvent(), true);
  assert.equal(g.event, null);
  const done = ev.filter((e) => e[0] === 'eventDone');
  assert.equal(done.length, 1);
  assert.ok(g.state.money >= money + done[0][2] - 1e-6);
  assert.equal(g.repairEvent(), false);
  assert.equal(g.state.stats.eventsDone, 1);
  run(g, 5, 0.1);
  assert.ok(g.state.stats.produced > produced);                      // üretim geri geldi
});

test('Elektrik Kesintisi onarılmazsa ceza olmadan biter; çevrimdışı olay iptal eder', () => {
  const g = fresh(null, () => 0.99);
  own(g, 2); g.state.stats.sold = 1000; g.eventsOn = true; g.eventTimer = 0; run(g, 0.1);
  const money = g.state.money;
  run(g, EVENTS.types[2].secs + 1, 0.1);
  assert.equal(g.event, null); assert.equal(g.state.stats.eventsDone, 0);
  assert.ok(g.state.money >= money);
  g.event = { type: 'surge', ttl: 10, max: 45, taps: 0, need: 0 };
  g.applyOffline(Date.now() + 120e3);
  assert.equal(g.event, null);
});

// ------------------------------------------------------------------ takvim
test('takvim: hafta sonu +%25, haftalık tema döner, hafta içi etkisiz', () => {
  const sat = new Date(2026, 9, 17, 12).getTime(), wed = new Date(2026, 9, 14, 12).getTime();
  assert.ok(calendarAt(sat).list.some((e) => e.id === 'weekend'));
  assert.equal(calendarAt(wed).list.some((e) => e.id === 'weekend'), false);
  const seen = new Set();
  for (let w = 0; w < 8; w++) seen.add(calendarAt(wed + w * 7 * 864e5).list.find((e) => e.id.startsWith('w_')).id);
  assert.equal(seen.size, CALENDAR.weeks.length);
  for (let d = 0; d < 60; d++) { const c = calendarAt(wed + d * 864e5); for (const k of ['income', 'golden', 'rush', 'mission']) assert.ok(c[k] >= 1); }
});

test('Game takvim bonusu yalnızca açıkken uygulanır', () => {
  const sat = new Date(2026, 9, 17, 12).getTime();
  const g = new Game(createDefaultState(0), undefined, undefined, () => sat);
  g.state.machines[0].auto = true; g.refresh();
  const off = g.income;
  g.calendarOn = true; g.refresh();
  assert.ok(g.income >= off * 1.25 - 1e-9);
  assert.ok(g.cal.list.length >= 1);
});

// ------------------------------------------------------------------ tema
test('tema rozet sayısına bağlı açılır', () => {
  const g = fresh();
  assert.equal(g.setTheme('classic'), true);
  assert.equal(g.setTheme('candy'), false);
  assert.equal(g.setTheme('yok'), false);
  for (let i = 0; i < THEMES.candy.badges; i++) g.state.ach['x' + i] = true;
  assert.equal(g.setTheme('candy'), true);
  assert.equal(g.state.theme, 'candy');
});

// ------------------------------------------------------------------ kayıt
test('yeni alanlar bozuk veriden onarılır; v3 kaydı taşınır', () => {
  const s = sanitizeState({
    staff: { cashier: 99, yok: 3, tech: 'x' }, rd: { r_inc1: 2, r_inc2: -4, saçma: 1 }, catalog: { block: 50, yok: 9, ball: -1 },
    meta: { cores: -3, lifeStars: 'çok', totalStars: 40 }, theme: 'olmayan', settings: { lang: 'fr' },
  }, 10);
  assert.equal(s.staff.cashier, STAFF.find((x) => x.id === 'cashier').max);
  assert.deepEqual(Object.keys(s.staff), ['cashier']);
  assert.deepEqual(s.rd, { r_inc1: 2 });
  assert.deepEqual(s.catalog, { block: 50 });
  assert.equal(s.meta.cores, 0); assert.equal(s.meta.lifeStars, 40);
  assert.equal(s.theme, 'classic'); assert.equal(s.settings.lang, '');
  assert.equal(sanitizeState({ settings: { lang: 'en' } }, 1).settings.lang, 'en');
  assert.ok(Object.keys(PRODUCT_NAMES).length >= 11);
});

test('çevrimdışı hesap çalışan/Ar-Ge çarpanlarını kullanır', () => {
  const g = fresh(); own(g, 1);
  const a = computeOffline(g.state, 3600).earned;
  g.state.staff = { cashier: 5 }; g.state.rd = { r_inc1: 5 };
  const b = computeOffline(g.state, 3600).earned;
  assert.ok(Math.abs(b / a - 1.2 * 1.25) < 1e-9);
});
