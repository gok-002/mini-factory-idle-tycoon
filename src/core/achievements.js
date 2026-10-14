// Rozetler (başarımlar): saf yardımcılar. Kalıcıdır, her rozet gelire ACH_BONUS kadar kalıcı çarpan ekler.
import { ACHIEVEMENTS } from './config.js';
import { METRICS } from './quests.js';

export function achValue(state, a) {
  const fn = METRICS[a.metric];
  return fn ? fn(state, a.arg) : 0;
}

export function achProgress(state, a) {
  return Math.min(a.target, achValue(state, a));
}

export const achDone = (state, a) => state.ach[a.id] === true;

/** Henüz kazanılmamış ama şartı sağlanmış rozetler. */
export function achEarnable(state) {
  const out = [];
  for (const a of ACHIEVEMENTS) if (!achDone(state, a) && achValue(state, a) >= a.target) out.push(a);
  return out;
}

export { ACHIEVEMENTS };
