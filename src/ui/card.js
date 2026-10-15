// Paylaşılabilir "Fabrika Kartı": sahnenin anlık görüntüsü + istatistikler tek bir PNG olarak çizilir (sunucu gerekmez).
import { MACHINES, ZONES } from '../core/config.js';
import { factoryLevel, achCount, permMult } from '../core/economy.js';
import { formatNum, formatRate } from '../core/format.js';
import { FONT, OUT, rr } from '../render/draw.js';
import { t } from '../i18n.js';

const W = 720, H = 1040;

export function makeCard(game, renderer) {
  const s = game.state;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  // zemin
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a3566'); bg.addColorStop(1, '#0f1530');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 9; i++) { c.save(); c.translate(W / 2, 260); c.rotate(i * 0.7); c.fillRect(0, -2000, 90, 4000); c.restore(); }

  // başlık
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.font = '800 70px ' + FONT;
  c.lineWidth = 12; c.strokeStyle = OUT;
  c.strokeText('MINI FACTORY', W / 2, 84); c.fillStyle = '#ffd23f'; c.fillText('MINI FACTORY', W / 2, 84);
  c.font = '800 26px ' + FONT; c.fillStyle = '#ff5d6c';
  rr(c, W / 2 - 110, 128, 220, 36, 14); c.fill(); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
  c.fillStyle = '#fff'; c.fillText('IDLE TYCOON', W / 2, 147);

  // sahne görüntüsü
  const sw = 600, sh = Math.round(sw * renderer.H / renderer.W), sx = (W - sw) / 2, sy = 190;
  const maxH = 440, k = sh > maxH ? maxH / sh : 1;
  const dw = sw * k, dh = sh * k, dx = (W - dw) / 2;
  c.save(); rr(c, dx, sy, dw, dh, 22); c.clip();
  c.drawImage(renderer.canvas, dx, sy, dw, dh);
  c.restore();
  rr(c, dx, sy, dw, dh, 22); c.lineWidth = 8; c.strokeStyle = '#ffd23f'; c.stroke();

  // istatistikler
  const owned = s.machines.filter((m) => m.owned).length;
  const cards = [
    [t('Fabrika Sv.'), String(factoryLevel(s).level)],
    [t('Gelir/sn'), formatRate(game.income)],
    [t('Makineler'), owned + '/' + MACHINES.length],
    [t('Bölgeler'), s.zones.filter((z) => z.unlocked).length + '/' + ZONES.length],
    [t('Rozetler'), String(achCount(s))],
    [s.meta.cores > 0 ? t('Kozmik Çekirdek') : t('Patent Yıldızı'), s.meta.cores > 0 ? String(s.meta.cores) : formatNum(s.meta.totalStars)],
  ];
  const top = sy + dh + 36, cw = 300, ch = 110, gap = 20;
  cards.forEach(([label, value], i) => {
    const x = 40 + (i % 2) * (cw + gap + 20), y = top + Math.floor(i / 2) * (ch + gap);
    rr(c, x, y, cw + 20, ch, 22); c.fillStyle = 'rgba(255,255,255,.1)'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#424c82'; c.stroke();
    c.fillStyle = '#aab3d8'; c.font = '700 24px ' + FONT; c.fillText(label, x + (cw + 20) / 2, y + 30);
    c.fillStyle = '#fff'; c.font = '800 48px ' + FONT; c.fillText(value, x + (cw + 20) / 2, y + 74);
  });

  // alt bilgi
  c.fillStyle = '#c6cdf0'; c.font = '700 24px ' + FONT;
  let link = '';
  try { link = location.origin + location.pathname; } catch (e) { link = ''; }
  c.fillText(link.replace(/^https?:\/\//, ''), W / 2, H - 44);
  c.fillStyle = '#ffe27a'; c.font = '800 26px ' + FONT;
  c.fillText(t('Sen de kendi fabrikanı kur!'), W / 2, H - 84);
  return cv;
}
