// Sabit boyutlu havuzlar: oyun döngüsünde nesne oluşturmadan parçacık ve yüzen yazı efektleri.
import { FONT, OUT } from './draw.js';

const N = 180, NF = 24;
const PI2 = Math.PI * 2;
export const K = { COIN: 0, CONFETTI: 1, PUFF: 2, STAR: 3, RING: 4, SPARK: 5 };
const COLORS = ['#ffd23f', '#ff6b6b', '#4ecdc4', '#7dffa0', '#9ad0ff', '#c39bff', '#ffffff', '#ff9f43'];
export const C = { GOLD: 0, RED: 1, TEAL: 2, GREEN: 3, BLUE: 4, PURPLE: 5, WHITE: 6, ORANGE: 7 };

export class FX {
  constructor() {
    this.x = new Float32Array(N); this.y = new Float32Array(N);
    this.vx = new Float32Array(N); this.vy = new Float32Array(N);
    this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.size = new Float32Array(N); this.rot = new Float32Array(N);
    this.kind = new Uint8Array(N); this.col = new Uint8Array(N);
    this.head = 0;
    this.ft = new Array(NF).fill('');
    this.fx = new Float32Array(NF); this.fy = new Float32Array(NF);
    this.flife = new Float32Array(NF); this.fcol = new Uint8Array(NF); this.fsize = new Float32Array(NF);
    this.fhead = 0;
  }

  spawn(kind, x, y, vx, vy, life, size, col) {
    const i = this.head; this.head = (i + 1) % N;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.kind[i] = kind; this.col[i] = col;
    this.rot[i] = Math.random() * PI2;
  }

  burst(kind, x, y, n, speed, life, size, col, gravity = true) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * PI2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s - (gravity ? speed * 0.4 : 0), life * (0.7 + Math.random() * 0.5), size * (0.7 + Math.random() * 0.6), col < 0 ? (Math.random() * COLORS.length) | 0 : col);
    }
  }

  ring(x, y, size, col) { this.spawn(K.RING, x, y, 0, 0, 0.45, size, col); }

  text(str, x, y, col, size = 15) {
    const i = this.fhead; this.fhead = (i + 1) % NF;
    this.ft[i] = str; this.fx[i] = x; this.fy[i] = y; this.flife[i] = 1; this.fcol[i] = col; this.fsize[i] = size;
  }

  update(dt) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = this.kind[i];
      if (k === K.COIN || k === K.CONFETTI || k === K.STAR || k === K.SPARK) this.vy[i] += 520 * dt;
      if (k === K.PUFF) this.vy[i] -= 20 * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.rot[i] += dt * 6;
    }
    for (let i = 0; i < NF; i++) if (this.flife[i] > 0) { this.flife[i] -= dt * 0.9; this.fy[i] -= 38 * dt; }
  }

  draw(ctx) {
    for (let i = 0; i < N; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const f = l / this.max[i], s = this.size[i], k = this.kind[i];
      ctx.globalAlpha = Math.min(1, f * 1.6);
      ctx.fillStyle = COLORS[this.col[i]];
      ctx.save(); ctx.translate(this.x[i], this.y[i]);
      if (k === K.COIN) {
        const sq = Math.abs(Math.cos(this.rot[i]));
        ctx.scale(Math.max(0.15, sq), 1);
        ctx.beginPath(); ctx.arc(0, 0, s, 0, PI2); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#b8860b'; ctx.stroke();
      } else if (k === K.CONFETTI) {
        ctx.rotate(this.rot[i]); ctx.fillRect(-s, -s * 0.5, s * 2, s);
      } else if (k === K.PUFF) {
        ctx.globalAlpha = f * 0.5; ctx.beginPath(); ctx.arc(0, 0, s * (2 - f), 0, PI2); ctx.fill();
      } else if (k === K.RING) {
        ctx.globalAlpha = f; ctx.lineWidth = 3 * f + 1; ctx.strokeStyle = COLORS[this.col[i]];
        ctx.beginPath(); ctx.arc(0, 0, s * (1.6 - f), 0, PI2); ctx.stroke();
      } else if (k === K.STAR) {
        ctx.rotate(this.rot[i]); ctx.beginPath();
        for (let q = 0; q < 4; q++) { ctx.lineTo(0, -s); ctx.lineTo(s * 0.25, -s * 0.25); ctx.rotate(Math.PI / 2); }
        ctx.fill();
      } else { ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, PI2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (let i = 0; i < NF; i++) {
      const l = this.flife[i];
      if (l <= 0) continue;
      ctx.globalAlpha = Math.min(1, l * 2);
      ctx.font = '800 ' + this.fsize[i] * (1 + (l > 0.85 ? (l - 0.85) * 2 : 0)) + 'px ' + FONT;
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.strokeText(this.ft[i], this.fx[i], this.fy[i]);
      ctx.fillStyle = COLORS[this.fcol[i]]; ctx.fillText(this.ft[i], this.fx[i], this.fy[i]);
    }
    ctx.globalAlpha = 1;
  }
}
