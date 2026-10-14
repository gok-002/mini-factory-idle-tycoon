// Kayıt kodu: oyunu metin olarak yedekleme / başka cihaza taşıma (telefon <-> bilgisayar). Saf fonksiyonlar.
import { sanitizeState } from './state.js';
import { migrate } from './save.js';

const PREFIX = 'MF1.';
const MAX_LEN = 400000;

function checksum(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Durumu kopyalanabilir tek satırlık koda çevirir. */
export function encodeSave(state) {
  const body = toB64(JSON.stringify(state));
  return PREFIX + body + '.' + checksum(body);
}

/**
 * Kodu çözer; her zaman sanitize edilmiş geçerli bir durum döndürür ya da { ok: false }.
 * lastSeen = now yapılır: aynı kodu tekrar yükleyerek çevrimdışı kazanç biriktirilemez.
 */
export function decodeSave(text, now = Date.now()) {
  try {
    const t = String(text || '').replace(/\s+/g, '');
    if (!t.startsWith(PREFIX) || t.length > MAX_LEN) return { ok: false, error: 'format' };
    const dot = t.lastIndexOf('.');
    if (dot <= PREFIX.length - 1) return { ok: false, error: 'format' };
    const body = t.slice(PREFIX.length, dot);
    if (checksum(body) !== t.slice(dot + 1)) return { ok: false, error: 'checksum' };
    const raw = JSON.parse(fromB64(body));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'format' };
    const state = sanitizeState(migrate(raw), now);
    state.lastSeen = now;
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: 'format' };
  }
}
