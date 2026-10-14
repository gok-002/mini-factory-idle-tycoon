# Gelir modeli entegrasyon noktaları

İlk sürümde **reklam veya satın alma yoktur** ve sahte entegrasyon yapılmamıştır.
Mimari şu noktalarda hazırdır (`src/services/monetization.js`):

| Özellik | Hazır olan kısım | Eklenecek kısım |
|---|---|---|
| Ödüllü reklamla geçici üretim bonusu | `state.boosts` (kayda dahil), `globalMult()` tüm gelir/üretim hesabına uygulanır, `grantBoost()` | Reklam SDK'sı sağlayıcısı; `ui.js`'te `isAvailable(PRODUCTION_BOOST)` true ise "2x bonus" butonu |
| Ödüllü reklamla çevrimdışı bonus | `computeOffline(state, sec, { bonusMult })` | Çevrimdışı penceresine "x2 topla" butonu: reklam izlenince `game._earn(res.earned * (bonus-1))` (ya da `applyOffline` çağrısına `opts` ile) |
| Reklamları kaldır | `PRODUCTS.REMOVE_ADS` | Satın alma SDK'sı; sahip olunduğunu `state`'e bir bayrak olarak kaydet (şu an reklam olmadığı için gerekli değil) |
| Kozmetik tema | `state.theme`, `config.THEMES`; bölge renkleri `ZONES` içinde | `renderer.js`'in `ZONES[...]` renklerini temadan okuması + mağaza arayüzü |

## Gerçek sağlayıcı bağlama (örnek akış)

1. Bir SDK seç (ör. Google AdMob, Unity LevelPlay; satın almalar için RevenueCat veya Google Play Billing / StoreKit).
2. Capacitor kullanıyorsan ilgili eklentiyi kur (ör. `npm i @capacitor-community/admob`) ve `npx cap sync`.
3. `isAvailable / showRewarded / purchase` arayüzünü uygulayan bir sınıf yaz, uygulama açılışında `setProvider(new MyProvider())` çağır.
4. Reklam ödülünü yalnızca SDK "ödül verildi" geri çağrısından sonra ver (`grantBoost(state, 'production_boost', 2, 300)`).
5. Mağaza/reklam kimliklerini ve gizlilik (GDPR/ATT) onay akışını platform kurallarına göre yapılandır. **Bu adımlar test edilmemiştir.**

Tasarım ilkesi: zorunlu/kesintili reklam yoktur; reklamlar yalnızca oyuncunun seçtiği ödüllü bonuslar içindir.
