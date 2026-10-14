// Çevrimdışı kazanç: TEK merkezi hesaplama. Saf fonksiyon; durumu değiştirmez.
import { TUNING, MACHINES } from './config.js';
import { incomePerSec, throughput, permMult, offlineCapHours, offlineEfficiency } from './economy.js';

/**
 * @param {object} state oyun durumu
 * @param {number} elapsedSec geçen gerçek süre (sn)
 * @param {{bonusMult?: number}} [opts] ileride ödüllü reklamla çevrimdışı bonus için
 */
export function computeOffline(state, elapsedSec, opts = {}) {
  const cfg = TUNING.offline;
  const raw = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  const cap = offlineCapHours(state) * 3600;
  const seconds = Math.min(raw, cap);
  const efficiency = raw < cfg.popupMinSeconds ? 1 : offlineEfficiency(state);
  const bonus = opts.bonusMult > 0 ? opts.bonusMult : 1;
  const rate = incomePerSec(state, permMult(state)); // geçici bonuslar çevrimdışı sayılmaz
  const earned = rate * seconds * efficiency * bonus;
  let items = 0;
  for (let i = 0; i < MACHINES.length; i++) {
    const m = state.machines[i];
    if (m.owned && m.auto) items += throughput(MACHINES[i], m) * seconds * efficiency;
  }
  return {
    seconds,
    rawSeconds: raw,
    capped: raw > cap,
    efficiency,
    earned: Number.isFinite(earned) ? earned : 0,
    items: Math.floor(items),
  };
}
