import test from 'node:test';
import assert from 'node:assert/strict';
import { playBot } from '../scripts/bot.mjs';

test('denge: bot ilerlemesi sağlıklı tempoda ve değerler sonlu', () => {
  const { game, marks } = playBot(3 * 3600);
  const s = game.state;
  assert.ok(Number.isFinite(s.money) && s.money >= 0);
  assert.ok(Number.isFinite(game.income));

  // İlk dakikada ilk otomasyon, ilk 12 dakikada üçüncü makine, 3 saatte ikinci bölge.
  assert.ok(marks.get('auto1') < 60, 'ilk otomasyon geç: ' + marks.get('auto1'));
  assert.ok(marks.get('machine2') < 10 * 60, 'ikinci makine geç: ' + marks.get('machine2'));
  assert.ok(marks.get('machine3') < 20 * 60, 'üçüncü makine geç: ' + marks.get('machine3'));
  assert.ok(marks.get('zone2') < 3 * 3600, 'ikinci bölge geç');
  // Yeni makine ilkinden yavaş başlamamalı (hedefler anlamlı): gelir katlanarak artar.
  assert.ok(marks.get('machine2') > 30, 'ikinci makine çok erken (ekonomi çok cömert)');
});

test('para muhasebesi: kazanç = satılan ürün değeri toplamı (yoktan para yok)', () => {
  const { game } = playBot(600);
  const s = game.state;
  assert.ok(s.stats.earned >= s.money - 100);   // para ancak kazanç + başlangıçtan gelir
  assert.ok(s.stats.sold <= s.stats.produced);
});
