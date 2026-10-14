// Gelir modeli için entegrasyon NOKTALARI. Gerçek reklam/satın alma SDK'sı yapılandırılmadığı
// için burada sahte reklam GÖSTERİLMEZ: sağlayıcı yokken tüm fonksiyonlar "kullanılamaz" döner
// ve arayüz ilgili butonları göstermez. Kurulum adımları: docs/MONETIZATION.md
//
// İleride gerçek bir sağlayıcı (AdMob, Unity LevelPlay, RevenueCat vb.) şu arayüzü uygular:
//   isAvailable(placement) -> boolean
//   showRewarded(placement) -> Promise<{ rewarded: boolean }>
//   purchase(productId)     -> Promise<{ success: boolean }>
// ve `setProvider(provider)` ile kaydedilir.

export const PLACEMENTS = {
  PRODUCTION_BOOST: 'production_boost',   // 2x üretim, 5 dk (state.boosts)
  OFFLINE_BONUS: 'offline_bonus',         // çevrimdışı kazancı 2x (computeOffline opts.bonusMult)
};
export const PRODUCTS = {
  REMOVE_ADS: 'remove_ads',
  THEME_PREFIX: 'theme_',                 // kozmetik temalar (state.theme, config THEMES)
};

const NullProvider = {
  isAvailable: () => false,
  showRewarded: async () => ({ rewarded: false }),
  purchase: async () => ({ success: false }),
};

let provider = NullProvider;
export const setProvider = (p) => { provider = p || NullProvider; };
export const isAvailable = (placement) => provider.isAvailable(placement);
export const showRewarded = (placement) => provider.showRewarded(placement);
export const purchase = (productId) => provider.purchase(productId);

/** Geçici üretim bonusu ekler (ödüllü reklam sonrası çağrılır). Sınır: aynı id yenilenir. */
export function grantBoost(state, id, mult, seconds, nowMs = Date.now()) {
  state.boosts = state.boosts.filter((b) => b.id !== id && b.until > nowMs);
  state.boosts.push({ id, mult, until: nowMs + seconds * 1000 });
}
