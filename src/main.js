// Giriş noktası: bileşenleri bağlar, oyun döngüsünü, kaydı ve arka plan davranışını yönetir.
import { TUNING, MACHINES, ACHIEVEMENTS, RUSH } from './core/config.js';
import { SaveManager, MemoryStorage } from './core/save.js';
import { Game } from './core/sim.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { Feedback } from './services/audio.js';
import { formatNum, formatRate } from './core/format.js';
import { factoryLevel } from './core/economy.js';

function getStorage() {
  try {
    const s = window.localStorage;
    s.setItem('__t', '1'); s.removeItem('__t');
    return s;
  } catch (e) { return new MemoryStorage(); } // özel mod / depolama kapalı: oyun yine açılır
}

const storage = getStorage();
const saveMgr = new SaveManager(storage);
const loaded = saveMgr.load(Date.now());

let ui = null, renderer = null, noSave = false;
const feedback = new Feedback(loaded.state.settings);

const game = new Game(loaded.state, (type, a, b, c) => {
  renderer && renderer.onEvent(type, a, b, c);
  switch (type) {
    case 'tap': break;
    case 'produce': feedback.produce(); break;
    case 'sell': feedback.sell(); break;
    case 'levelUp': case 'upgrade': feedback.upgrade(); break;
    case 'auto': feedback.upgrade(); ui && ui.toast('Otomasyon açıldı!'); break;
    case 'buyMachine': feedback.fanfare(); ui && ui.toast(MACHINES[a].name + ' kuruldu!'); break;
    case 'zone': feedback.fanfare(); ui && ui.showChapter(a); break;
    case 'goldenSpawn': feedback.quest(); ui && ui.toast('Altın Kasa belirdi! Yakala!'); break;
    case 'goldenCollected': feedback.upgrade(); renderer && renderer.goldenFx(a, b); break;
    case 'patent': feedback.upgrade(); break;
    case 'patentUnlocked': feedback.fanfare(); ui && ui.toast('Patent Laboratuvarı açıldı! Fabrikanı yenileyebilirsin.'); break;
    case 'daily': break;
    case 'prestige': feedback.fanfare(); renderer && renderer.setZone(0); ui && (ui.closeSheet(true), ui.toast('Fabrika yenilendi! +' + formatNum(a) + ' Yıldız')); break;
    case 'questReady': feedback.quest(); ui && ui.toast('Görev tamamlandı! Ödülünü al.'); break;
    case 'questClaimed': feedback.quest(); break;
    case 'deny': feedback.deny(); ui && ui.toast(a === 'money' ? 'Yeterli paran yok!' : a === 'stars' ? 'Yeterli Yıldız yok!' : a === 'level' ? 'Önceki makinenin seviyesi yetersiz (Sv.' + b + ')' : 'Yapılamaz'); break;
    case 'blocked': break;
    case 'achievement': {
      const ach = ACHIEVEMENTS.find((x) => x.id === a);
      feedback.medal();
      ui && ach && ui.notify('medal', 'Rozet: ' + ach.title, ach.desc + '  ·  +%1 gelir', 'medal-' + ach.tier);
      break;
    }
    case 'missionReady': {
      if (!ui) break;                                  // yükleme sırasında arayüz henüz yok
      feedback.quest();
      const m = game.missions()[a];
      m && ui.notify('target', 'Günlük görev tamamlandı!', m.text + '  ·  Hedefler → Günlük');
      break;
    }
    case 'missionClaimed': feedback.quest(); break;
    case 'chestClaimed': feedback.fanfare(); ui && ui.notify('gift', 'Günün sandığı açıldı!', '+' + formatNum(a) + ' kazandın'); break;
    case 'rushStart':
      if (!ui) break;
      feedback.alarm();
      ui.notify('bolt', 'Acil Sipariş!', MACHINES[a].name + ': ' + b + ' adet sat · ' + RUSH.ttl + ' sn · Ödül ' + formatNum(game.rushReward()));
      break;
    case 'rushDone': feedback.fanfare(); ui && ui.notify('coin', 'Sipariş teslim edildi!', '+' + formatNum(b) + ' kazandın'); break;
    case 'rushFail': ui && ui.toast('Sipariş kaçtı… Bir sonrakinde yakala!'); break;
    default:
  }
});

function save() {
  if (noSave) return;
  game.touch(Date.now());
  if (!saveMgr.save(game.state) && !save.warned) { save.warned = true; ui && ui.toast('Kayıt yapılamadı (depolama dolu/kapalı)'); }
}

renderer = new Renderer(document.getElementById('game'), game);
ui = new UI(game, renderer, feedback, saveMgr, {
  save,
  reset() { noSave = true; saveMgr.reset(); location.reload(); },
  importState(state) { noSave = true; if (saveMgr.save(state)) location.reload(); else { noSave = false; ui.toast('Kayıt yüklenemedi (depolama dolu/kapalı)'); } },
});

function selectInitialZone() {
  const z = MACHINES[game.state.selected].zone;
  if (game.state.zones[z].unlocked) renderer.setZone(z);
}
selectInitialZone();

function relayout() {
  renderer.resize();
  ui.update();
}
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', () => setTimeout(relayout, 150));
if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.getElementById('stage'));

// -------------------------------------------------------- çevrimdışı kazanç
function handleOffline() {
  const res = game.applyOffline(Date.now());
  if (res && res.seconds >= 2) {
    save(); // ödülü hemen kalıcılaştır: aynı süre bir daha sayılmaz
    if (res.rawSeconds >= TUNING.offline.popupMinSeconds) { ui.showOffline(res); return true; }
  }
  return false;
}

// -------------------------------------------------------- arka plan / kapanış
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else { last = performance.now(); handleOffline(); }
});
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);

// ------------------------------------------------------------------ döngü
let last = performance.now(), saveTimer = 0, uiTimer = 0;

function loop(ts) {
  let dt = (ts - last) / 1000;
  last = ts;
  if (!(dt >= 0)) dt = 0;
  if (dt > 5) {
    // Sekme donmuş/uyutulmuş olabilir: kesintiyi çevrimdışı kazanç olarak işle.
    handleOffline();
    dt = 0;
  } else {
    let rem = dt;
    while (rem > 1e-6) { const step = Math.min(rem, 0.1); game.update(step); rem -= step; }
  }
  const now = Date.now();
  game.touch(now);
  uiTimer += dt;
  if (uiTimer >= 0.5) { uiTimer = 0; game.refresh(now); }

  renderer.frame(Math.min(dt, 0.1));
  ui.frame(dt);
  feedback.setMood(renderer.zone);

  saveTimer += dt;
  if (saveTimer >= TUNING.autosaveSec) { saveTimer = 0; save(); }
  requestAnimationFrame(loop);
}

relayout();
// Açılış ekranı: dokununca kapanır (aynı dokunuş sesi de başlatır). Durum mesajları ekran kapanınca gösterilir.
let welcomeMsg = '';
if (loaded.status === 'recovered') welcomeMsg = 'Kayıt yedekten kurtarıldı';
else if (loaded.status === 'corrupt') welcomeMsg = 'Kayıt okunamadı, yeni oyun başladı';
else if (loaded.status === 'new') welcomeMsg = 'Makineye dokunarak üretimi hızlandır!';
else if (game.backfilled > 0) welcomeMsg = game.backfilled + ' rozet kazandın! (Hedefler → Rozetler)';
const splash = document.getElementById('splash');
if (splash) {
  if (loaded.status === 'ok' || loaded.status === 'recovered') {
    document.getElementById('sp-info').textContent = 'Fabrika Sv.' + factoryLevel(game.state).level + (game.income > 0 ? '  ·  ' + formatRate(game.income) + '/sn' : '');
  }
  const dismiss = () => {
    if (splash.classList.contains('out')) return;
    splash.classList.add('out'); feedback.unlock(); feedback.button();
    setTimeout(() => splash.remove(), 600);
    if (welcomeMsg) setTimeout(() => ui.toast(welcomeMsg), 350);
  };
  splash.addEventListener('pointerdown', dismiss);
  window.addEventListener('keydown', dismiss, { once: true });
  window.__mf_skipSplash = dismiss;
}
if (!handleOffline()) ui.maybeDaily();
requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(loop); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı önbellek isteğe bağlı */ });
}

// Hata ayıklama / test kancası
window.__mf = { game, renderer, ui, saveMgr, save, handleOffline, feedback };
