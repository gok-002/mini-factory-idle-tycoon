// Giriş noktası: bileşenleri bağlar, oyun döngüsünü, kaydı ve arka plan davranışını yönetir.
import { TUNING, MACHINES } from './core/config.js';
import { SaveManager, MemoryStorage } from './core/save.js';
import { Game } from './core/sim.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { Feedback } from './services/audio.js';
import { formatNum } from './core/format.js';

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
    case 'buyMachine': feedback.unlock(); ui && ui.toast(MACHINES[a].name + ' kuruldu!'); break;
    case 'zone': feedback.unlock(); ui && ui.showChapter(a); break;
    case 'goldenSpawn': feedback.quest(); ui && ui.toast('Altın Kasa belirdi! Yakala!'); break;
    case 'goldenCollected': feedback.upgrade(); renderer && renderer.goldenFx(a, b); break;
    case 'patent': feedback.upgrade(); break;
    case 'daily': break;
    case 'prestige': feedback.unlock(); renderer && renderer.setZone(0); ui && (ui.closeSheet(true), ui.toast('Fabrika yenilendi! +' + formatNum(a) + ' Yıldız')); break;
    case 'questReady': feedback.quest(); ui && ui.toast('Görev tamamlandı! Ödülünü al.'); break;
    case 'questClaimed': feedback.quest(); break;
    case 'deny': feedback.deny(); ui && ui.toast(a === 'money' ? 'Yeterli paran yok!' : a === 'stars' ? 'Yeterli Yıldız yok!' : a === 'level' ? 'Önceki makinenin seviyesi yetersiz (Sv.' + b + ')' : 'Yapılamaz'); break;
    case 'blocked': break;
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

  saveTimer += dt;
  if (saveTimer >= TUNING.autosaveSec) { saveTimer = 0; save(); }
  requestAnimationFrame(loop);
}

relayout();
if (loaded.status === 'recovered') ui.toast('Kayıt yedekten kurtarıldı');
else if (loaded.status === 'corrupt') ui.toast('Kayıt okunamadı, yeni oyun başladı');
else if (loaded.status === 'new') ui.toast('Makineye dokunarak üretimi hızlandır!');
if (!handleOffline()) ui.maybeDaily();
requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(loop); });

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı önbellek isteğe bağlı */ });
}

// Hata ayıklama / test kancası
window.__mf = { game, renderer, ui, saveMgr, save, handleOffline };
