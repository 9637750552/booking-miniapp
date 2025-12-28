// ---------- Окружение Telegram ----------
export const tg = window.Telegram?.WebApp || null;

// БОЛЕЕ НАДЁЖНАЯ детекция запуска в Telegram WebApp
export const IN_TG_BY_INITDATA = !!(tg && typeof tg.initData === 'string' && tg.initData.length > 0);
export const IN_TG_BY_USER     = !!(tg && (tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.receiver?.id));
export const IN_TG_BY_PLATFORM = !!(tg && typeof tg.platform === 'string' && tg.platform !== 'unknown');
export const IN_TELEGRAM       = IN_TG_BY_INITDATA || IN_TG_BY_USER || IN_TG_BY_PLATFORM;

// Сигнал готовности WebApp (безопасно вызывать всегда)
export function initTelegram() {
  try { tg?.ready?.(); tg?.expand?.(); } catch {}

  // Консоль для диагностики (полезно на телефоне во встроенном дебаге)
  try {
    console.log('[env]', {
      hasTG: !!tg,
      platform: tg?.platform,
      version: tg?.version,
      initDataLen: (tg?.initData?.length || 0),
      hasUser: !!tg?.initDataUnsafe?.user?.id,
      IN_TELEGRAM
    });
  } catch {}
}

export function impactLight() { try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch {} }

// Безопасный alert: в Telegram (если метод есть) — tg.showAlert, иначе window.alert
export function safeAlert(message) {
  try {
    if (IN_TELEGRAM && typeof tg.showAlert === 'function') {
      tg.showAlert(message);
      return;
    }
  } catch {}
  window.alert(message);
}
export function showAlert(msg) { safeAlert(msg); }
