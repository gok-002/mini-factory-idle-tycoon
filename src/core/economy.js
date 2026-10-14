// Saf (UI'dan bağımsız) ekonomi formülleri. Denge testleri bu dosyaya karşı yazılır.
import { TUNING, UPGRADES, MACHINES, ZONES, PRESTIGE, PATENTS } from './config.js';

export function milestoneCount(level) {
  let c = 0;
  for (const m of TUNING.milestones) if (level >= m) c++;
  return c;
}

/** Seviyenin değer çarpanı: doğrusal seviye x kilometre taşı bonusları. */
export function levelMult(level) {
  return level * Math.pow(TUNING.milestoneMult, milestoneCount(level));
}

export function cycleTime(def, m) {
  return Math.max(TUNING.minCycleTime, def.baseTime * Math.pow(UPGRADES.speed.perLevel, m.speed));
}

export function itemValue(def, m, gm = 1) {
  return def.baseValue * levelMult(m.level) * Math.pow(UPGRADES.value.perLevel, m.value) * gm;
}

export function storageCap(m) {
  return Math.min(TUNING.maxStorage, TUNING.baseStorage + UPGRADES.storage.perLevel * m.storage);
}

/** Otomatik makinenin kararlı durumdaki ürün/sn değeri (bant dolarsa yavaşlar). */
export function throughput(def, m) {
  return Math.min(1 / cycleTime(def, m), storageCap(m) / TUNING.beltTravelTime);
}

export function machineIncome(def, m, gm = 1) {
  if (!m.owned || !m.auto) return 0;
  return throughput(def, m) * itemValue(def, m, gm);
}

export function incomePerSec(state, gm = 1) {
  let sum = 0;
  for (let i = 0; i < MACHINES.length; i++) sum += machineIncome(MACHINES[i], state.machines[i], gm);
  return Number.isFinite(sum) ? sum : 0;
}

/** Seviye L -> L+n toplam maliyeti (geometrik seri). Tek seviye = ceil(base * g^(L-1)). */
export function levelUpCost(def, level, n = 1) {
  const g = TUNING.levelCostGrowth;
  const first = def.upgradeCost * Math.pow(g, level - 1);
  if (n <= 1) return Math.ceil(first);
  return Math.ceil(first * (Math.pow(g, n) - 1) / (g - 1));
}

export function maxAffordableLevels(def, level, money) {
  const room = TUNING.maxLevel - level;
  if (room <= 0 || !(money > 0)) return 0;
  const g = TUNING.levelCostGrowth;
  const first = def.upgradeCost * Math.pow(g, level - 1);
  let n = Math.floor(Math.log(1 + money * (g - 1) / first) / Math.log(g));
  n = Math.max(0, Math.min(room, n));
  while (n > 0 && levelUpCost(def, level, n) > money) n--;
  return n;
}

export function trackCost(def, track, lvl) {
  const u = UPGRADES[track];
  return Math.ceil(def.upgradeCost * u.costMul * Math.pow(u.growth, lvl));
}

export function trackMaxed(track, lvl) {
  return lvl >= UPGRADES[track].max;
}

/** Fabrika puanı: makine seviyeleri + yükseltme kolları + otomasyon. */
export function factoryPoints(state) {
  let p = 0;
  for (const m of state.machines) {
    if (!m.owned) continue;
    p += m.level + (m.speed + m.value + m.storage) * 3 + (m.auto ? 5 : 0);
  }
  return p;
}

/** Fabrika seviyesi ve bir sonrakine ilerleme (0..1). */
export function factoryLevel(state) {
  const pts = factoryPoints(state);
  const lvl = 1 + Math.floor(Math.sqrt(pts / 4));
  const lo = 4 * (lvl - 1) * (lvl - 1), hi = 4 * lvl * lvl;
  return { level: lvl, progress: Math.max(0, Math.min(1, (pts - lo) / (hi - lo))) };
}

/** Görsel gelişim kademesi (0..4). */
export function visualTier(level) {
  return level >= 100 ? 4 : level >= 50 ? 3 : level >= 25 ? 2 : level >= 10 ? 1 : 0;
}

export function zoneOfSlot(zoneIdx) {
  const out = [];
  for (let i = 0; i < MACHINES.length; i++) if (MACHINES[i].zone === zoneIdx) out.push(i);
  return out;
}

export function patentLvl(state, id) {
  return state.meta.shop[id] || 0;
}

export function starMult(state) {
  return 1 + PRESTIGE.starBonus * state.meta.totalStars;
}

/** Kalıcı çarpan: Patent Yıldızları + "Mühendislik Ödülü". Çevrimdışı kazanca da uygulanır. */
export function permMult(state) {
  return starMult(state) * (1 + 0.2 * patentLvl(state, 'income'));
}

/** Kalıcı çarpan x geçici bonuslar (altın kasa coşkusu, ileride ödüllü reklam). */
export function globalMult(state, nowMs) {
  let mult = permMult(state);
  for (const b of state.boosts) if (b.until > nowMs && b.mult > 0) mult *= b.mult;
  return mult;
}

export const offlineCapHours = (state) => TUNING.offline.capHours + 2 * patentLvl(state, 'offcap');
export const offlineEfficiency = (state) => Math.min(1, TUNING.offline.efficiency + 0.05 * patentLvl(state, 'offeff'));
export const tapSeconds = (state, auto) => (auto ? TUNING.tapSecondsAuto : TUNING.tapSecondsManual) + 0.25 * patentLvl(state, 'tap');
export const machineBuyCost = (state, def) => Math.ceil(def.baseCost * (1 - 0.04 * patentLvl(state, 'discount')));
export const goldenIntervalMult = (state) => 1 / (1 + 0.1 * patentLvl(state, 'golden'));

export function patentCost(p, lvl) {
  return Math.ceil(p.base * Math.pow(p.growth, lvl));
}

/** Şu an yenilenirse kazanılacak Patent Yıldızı. */
export function prestigeGain(state) {
  const g = Math.floor(Math.pow(Math.max(0, state.stats.runEarned) / PRESTIGE.base, PRESTIGE.exponent));
  return Number.isFinite(g) ? Math.max(0, g) : 0;
}

export function zoneUnlockCost(zoneIdx) {
  return ZONES[zoneIdx].unlockCost;
}
