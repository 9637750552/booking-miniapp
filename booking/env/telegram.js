const tg = window.Telegram?.WebApp || null;

const IN_TG_BY_INITDATA = !!(tg && typeof tg.initData === 'string' && tg.initData.length > 0);
const IN_TG_BY_USER = !!(tg && (tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.receiver?.id));
const IN_TG_BY_PLATFORM = !!(tg && typeof tg.platform === 'string' && tg.platform !== 'unknown');
const IN_TELEGRAM = IN_TG_BY_INITDATA || IN_TG_BY_USER || IN_TG_BY_PLATFORM;

try {
  tg?.ready?.();
  tg?.expand?.();
} catch {}

try {
  console.log('[env]', {
    hasTG: !!tg,
    platform: tg?.platform,
    version: tg?.version,
    initDataLen: tg?.initData?.length || 0,
    hasUser: !!tg?.initDataUnsafe?.user?.id,
    IN_TELEGRAM
  });
} catch {}

const USER_ID = IN_TELEGRAM
  ? (tg?.initDataUnsafe?.user?.id || tg?.initDataUnsafe?.receiver?.id || tg?.platform || 'tg')
  : 'local';
const STORAGE_KEY = `booking_form_v1_${USER_ID}`;

function impactLight() {
  try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch {}
}

function safeAlert(message) {
  try {
    if (IN_TELEGRAM && typeof tg.showAlert === 'function') {
      tg.showAlert(message);
      return;
    }
  } catch {}
  window.alert(message);
}

function showAlert(msg) {
  safeAlert(msg);
}

export {
  IN_TELEGRAM,
  STORAGE_KEY,
  impactLight,
  safeAlert,
  showAlert,
  tg
};
