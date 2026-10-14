import { QUESTS, MACHINES } from './config.js';

const METRICS = {
  produced:    (s) => s.stats.produced,
  sold:        (s) => s.stats.sold,
  earned:      (s) => s.stats.earned,
  upgrades:    (s) => s.stats.upgrades,
  maxIncome:   (s) => s.stats.maxIncome,
  taps:        (s) => s.stats.taps,
  golden:      (s) => s.stats.golden,
  prestiges:   (s) => s.meta.prestiges,
  totalStars:  (s) => s.meta.totalStars,
  automations: (s) => s.machines.reduce((a, m) => a + (m.auto ? 1 : 0), 0),
  machines:    (s) => s.machines.reduce((a, m) => a + (m.owned ? 1 : 0), 0),
  maxLevel:    (s) => s.machines.reduce((a, m) => Math.max(a, m.owned ? m.level : 0), 0),
  zones:       (s) => s.zones.reduce((a, z) => a + (z.unlocked ? 1 : 0), 0),
  // Bölgedeki sahip olunan makine sayısı / bölgedeki EN DÜŞÜK makine seviyesi (hepsi alınmadıysa 0)
  zoneOwned:   (s, z) => MACHINES.reduce((a, d, i) => a + (d.zone === z && s.machines[i].owned ? 1 : 0), 0),
  zoneMin:     (s, z) => {
    let min = Infinity, n = 0;
    MACHINES.forEach((d, i) => { if (d.zone === z) { n++; min = Math.min(min, s.machines[i].owned ? s.machines[i].level : 0); } });
    return n ? min : 0;
  },
};

export function questProgress(state, q) {
  const fn = METRICS[q.metric];
  return fn ? Math.min(q.target, fn(state, q.arg)) : 0;
}

export function questDone(state, q) {
  return questProgress(state, q) >= q.target;
}

export function questClaimed(state, q) {
  return state.quests[q.id] === true;
}

/** Ödül: sabit para ile "N saniyelik gelir" arasından büyük olan. */
export function questReward(q, income) {
  return Math.floor(Math.max(q.reward.money || 0, (q.reward.secs || 0) * income));
}

/**
 * Görünen görevler: her merdivenin sıradaki (ödülü alınmamış ilk) görevi.
 * Bölüm görevleri yalnızca bölge açıkken görünür.
 */
export function visibleQuests(state) {
  const seen = new Set(), out = [];
  for (const q of QUESTS) {
    if (seen.has(q.series) || questClaimed(state, q)) continue;
    seen.add(q.series);
    if (q.zone !== undefined && !state.zones[q.zone].unlocked) continue;
    out.push(q);
  }
  return out;
}

export function claimableCount(state) {
  let n = 0;
  for (const q of visibleQuests(state)) if (questDone(state, q)) n++;
  return n;
}

export function completedCount(state) {
  let n = 0;
  for (const q of QUESTS) if (questClaimed(state, q)) n++;
  return n;
}

export { QUESTS, MACHINES };
