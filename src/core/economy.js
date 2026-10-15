// Saf (UI'dan bağımsız) ekonomi formülleri. Denge testleri bu dosyaya karşı yazılır.
import {
  TUNING, UPGRADES, MACHINES, ZONES, PRESTIGE, PATENTS, ACH_BONUS, RESEARCH, RESEARCH_DIV, CHAIN_BONUS, CATALOG_TIERS, CATALOG_BONUS, ASCEND, CALENDAR,
} from './config.js';

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

/** Otomatik makinelerin toplam ürün/sn değeri (günlük görev hedeflerini ölçeklemek için). */
export function itemsPerSec(state) {
  let sum = 0;
  for (let i = 0; i < MACHINES.length; i++) if (state.machines[i].owned && state.machines[i].auto) sum += throughput(MACHINES[i], state.machines[i]);
  return Number.isFinite(sum) ? sum : 0;
}

export function machineIncome(def, m, gm = 1, chain = 1) {
  if (!m.owned || !m.auto) return 0;
  return throughput(def, m) * itemValue(def, m, gm) * chain;
}

export function incomePerSec(state, gm = 1) {
  let sum = 0;
  for (let i = 0; i < MACHINES.length; i++) sum += machineIncome(MACHINES[i], state.machines[i], gm, chainMult(state, i));
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

export const staffLvl = (state, id) => state.staff[id] || 0;
export const rdLvl = (state, id) => state.rd[id] || 0;

export function starMult(state) {
  return 1 + PRESTIGE.starBonus * state.meta.totalStars * (1 + ASCEND.coreStar * state.meta.cores);
}

/** Kozmik Çekirdek (ikinci prestij) gelir çarpanı. */
export const coreMult = (state) => 1 + ASCEND.coreIncome * state.meta.cores;

// ------------------------------------------------------------ zincir bonusu
/** i. makineyi besleyen, aynı bölgede arka arkaya otomatik çalışan bağlantı sayısı. */
export function chainDepth(state, i) {
  let d = 0, k = i;
  while (k > 0 && MACHINES[k - 1].zone === MACHINES[k].zone) {
    const a = state.machines[k], b = state.machines[k - 1];
    if (!(a.owned && a.auto && b.owned && b.auto)) break;
    d++; k--;
  }
  return d;
}
export const chainMult = (state, i) => Math.pow(1 + CHAIN_BONUS, chainDepth(state, i));

// ------------------------------------------------------------ katalog
export function catTiersOf(count) {
  let n = 0;
  for (const t of CATALOG_TIERS) if (count >= t) n++;
  return n;
}
export function catTiers(state) {
  let n = 0;
  for (const k in state.catalog) n += catTiersOf(state.catalog[k]);
  return n;
}
export const catMult = (state) => 1 + CATALOG_BONUS * catTiers(state);

// ------------------------------------------------------------ Ar-Ge
export const rdCost = (node, lvl) => Math.ceil(node.base * Math.pow(node.growth, lvl));
export const rpEarned = (state) => Math.floor(Math.sqrt(Math.max(0, state.stats.produced) / RESEARCH_DIV));
export function rpSpent(state) {
  let sum = 0;
  for (const n of RESEARCH) for (let l = 0; l < rdLvl(state, n.id); l++) sum += rdCost(n, l);
  return sum;
}
export const rpAvail = (state) => Math.max(0, rpEarned(state) - rpSpent(state));
export function rdOpen(state, node) {
  return !node.req || rdLvl(state, node.req[0]) >= node.req[1];
}

// ------------------------------------------------------------ çalışanlar
/** Çalışan fiyatı: gelirin 30 saniyesi (en az son makinenin yarı fiyatı) x mul x growth^seviye. */
export function staffCost(state, role, lvl, income) {
  let last = 0;
  for (let i = 0; i < MACHINES.length; i++) if (state.machines[i].owned) last = MACHINES[i].baseCost;
  const ref = Math.max(income * 30, last * 0.5, 1000);
  return Math.ceil(ref * role.mul * Math.pow(role.growth, lvl));
}

// ------------------------------------------------------------ takvim
/** Takvim etkinlikleri (hafta sonu + haftalık tema). Saf fonksiyon; çarpanlar 1 = etkisiz. */
export function calendarAt(ms) {
  const d = new Date(ms), list = [];
  const out = { income: 1, golden: 1, rush: 1, mission: 1, list };
  const add = (e, until) => { list.push({ ...e, until }); for (const k of ['income', 'golden', 'rush', 'mission']) if (e[k]) out[k] *= e[k]; };
  const wd = d.getDay();
  if (wd === 0 || wd === 6) add(CALENDAR.weekend, new Date(d.getFullYear(), d.getMonth(), d.getDate() + (wd === 6 ? 2 : 1), 0, 0, 0).getTime());
  const week = Math.floor((ms - 4 * 864e5) / (7 * 864e5));   // pazartesi (UTC) başlangıçlı hafta numarası
  add(CALENDAR.weeks[((week % 4) + 4) % 4], (week + 1) * 7 * 864e5 + 4 * 864e5);
  return out;
}

export function achCount(state) {
  return Object.keys(state.ach).length;
}

/** Rozet bonusu: kazanılan her rozet için kalıcı +ACH_BONUS. */
export function achMult(state) {
  return 1 + ACH_BONUS * achCount(state);
}

/** Kalıcı çarpan: Patent Yıldızları + "Mühendislik Ödülü" + rozetler. Çevrimdışı kazanca da uygulanır. */
export function permMult(state) {
  return starMult(state) * (1 + 0.2 * patentLvl(state, 'income')) * achMult(state) * catMult(state) * coreMult(state)
    * (1 + 0.04 * staffLvl(state, 'cashier')) * (1 + 0.05 * rdLvl(state, 'r_inc1')) * (1 + 0.08 * rdLvl(state, 'r_inc2'));
}

/** Kalıcı çarpan x geçici bonuslar (altın kasa coşkusu, ileride ödüllü reklam). */
export function globalMult(state, nowMs) {
  let mult = permMult(state);
  for (const b of state.boosts) if (b.until > nowMs && b.mult > 0) mult *= b.mult;
  return mult;
}

export const offlineCapHours = (state) => TUNING.offline.capHours + 2 * patentLvl(state, 'offcap') + staffLvl(state, 'night') + 2 * rdLvl(state, 'r_cap');
export const offlineEfficiency = (state) => Math.min(1, TUNING.offline.efficiency + 0.05 * patentLvl(state, 'offeff') + 0.03 * staffLvl(state, 'shift') + 0.04 * rdLvl(state, 'r_eff'));
export const tapSeconds = (state, auto) => (auto ? TUNING.tapSecondsAuto : TUNING.tapSecondsManual) + 0.25 * patentLvl(state, 'tap') + 0.1 * staffLvl(state, 'coach') + 0.15 * rdLvl(state, 'r_tap');
export const machineBuyCost = (state, def) => Math.ceil(def.baseCost * (1 - Math.min(0.7, 0.04 * patentLvl(state, 'discount') + 0.03 * rdLvl(state, 'r_disc'))));
export const goldenIntervalMult = (state) => 1 / (1 + 0.1 * patentLvl(state, 'golden') + 0.1 * rdLvl(state, 'r_gold'));

// ------------------------------------------------------------ Galaktik Genişleme
/** Ömür boyu kazanılan yıldızlara göre sahip olunabilecek toplam çekirdek. */
export const coresDeserved = (state) => Math.floor(Math.sqrt(Math.max(0, state.meta.lifeStars) / ASCEND.need));
export const ascendGain = (state) => Math.max(0, coresDeserved(state) - state.meta.cores);

export function patentCost(p, lvl) {
  return Math.ceil(p.base * Math.pow(p.growth, lvl));
}

/** Şu an yenilenirse kazanılacak Patent Yıldızı. */
export function prestigeGain(state) {
  const g = Math.floor(Math.pow(Math.max(0, state.stats.runEarned) / PRESTIGE.base, PRESTIGE.exponent));
  return Number.isFinite(g) ? Math.max(0, g) : 0;
}

/** Patent Laboratuvarı açık mı: ilk yenilemeyi yapabilecek kadar kazanıldıysa (ya da daha önce açıldıysa). */
export function prestigeUnlocked(state) {
  return state.meta.prestiges > 0 || state.meta.totalStars > 0 || prestigeGain(state) >= PRESTIGE.minGain;
}

/** Kilit açılış ilerlemesi 0..1 (log ölçeği, 10.000 kazançtan başlar: gelir üstel büyüdüğü için çubuk "takılı kalmasın"). */
export function prestigeProgress(state) {
  const lo = 4, hi = Math.log10(prestigeNeed());
  const e = Math.max(0, state.stats.runEarned);
  return Math.max(0, Math.min(1, (Math.log10(1 + e) - lo) / (hi - lo)));
}

/** Kilidin açılması için gereken toplam kazanç (bu koşuda). */
export function prestigeNeed() {
  return PRESTIGE.base * Math.pow(PRESTIGE.minGain, 1 / PRESTIGE.exponent);
}

export function zoneUnlockCost(zoneIdx) {
  return ZONES[zoneIdx].unlockCost;
}
