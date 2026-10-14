// Kayıt yöneticisi: oyunun diskle/depolamayla konuşan tek yeri.
import { SAVE_VERSION, SAVE_KEY } from './config.js';
import { sanitizeState, createDefaultState } from './state.js';

/** Eski kayıtları adım adım güncel sürüme taşır. Yeni sürüm: MIGRATIONS'a [v] -> fn ekle. */
const MIGRATIONS = {
  1: (raw) => { raw.v = 2; return raw; }, // v2: meta (yıldız/patent), günlük hediye, 24 makine, 8 bölge (eksik alanlar sanitize ile doldurulur)
  2: (raw) => { raw.v = 3; return raw; }, // v3: rozetler (ach), günlük görevler (dm), ipucu bayrakları (tut), müzik ayarı, yeni istatistikler
};

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  let v = Number.isInteger(raw.v) ? raw.v : 1;
  while (v < SAVE_VERSION && MIGRATIONS[v]) {
    raw = MIGRATIONS[v](raw);
    v = raw.v;
  }
  return raw;
}

/** localStorage benzeri arayüze sahip bellek içi depo (testler ve depolama kapalıyken). */
export class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

export class SaveManager {
  constructor(storage, key = SAVE_KEY) {
    this.storage = storage || new MemoryStorage();
    this.key = key;
    this.lastError = null;
  }

  _parse(text) {
    if (text == null) return null;
    try { return JSON.parse(text); } catch (e) { return undefined; }
  }

  /** @returns {{state: object, status: 'new'|'ok'|'recovered'|'corrupt'}} */
  load(now = Date.now()) {
    let main, bak;
    try {
      main = this._parse(this.storage.getItem(this.key));
      bak = this._parse(this.storage.getItem(this.key + '.bak'));
    } catch (e) { this.lastError = e; return { state: createDefaultState(now), status: 'corrupt' }; }

    if (main === null && bak === null) return { state: createDefaultState(now), status: 'new' };
    if (main && typeof main === 'object') return { state: sanitizeState(migrate(main), now), status: 'ok' };
    if (bak && typeof bak === 'object') return { state: sanitizeState(migrate(bak), now), status: 'recovered' };
    return { state: createDefaultState(now), status: 'corrupt' };
  }

  save(state) {
    try {
      const prev = this.storage.getItem(this.key);
      const json = JSON.stringify(state);
      if (prev && this._parse(prev)) this.storage.setItem(this.key + '.bak', prev);
      this.storage.setItem(this.key, json);
      this.lastError = null;
      return true;
    } catch (e) {
      this.lastError = e;
      return false;
    }
  }

  reset() {
    try { this.storage.removeItem(this.key); this.storage.removeItem(this.key + '.bak'); } catch (e) { this.lastError = e; }
  }
}
