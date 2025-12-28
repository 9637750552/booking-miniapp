import { elFrom, elTo, elGuests, elPhone, elEmail } from './state.js';

// ---------- Helpers ----------
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizePhone(raw) { return (raw || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''); }
export function isValidPhone(raw) {
  const p = normalizePhone(raw);
  const digits = p.replace(/\D/g, '');
  if (digits.length < 10) return false;
  return /^\+?\d{10,15}$/.test(p);
}
export function isValidEmail(raw) {
  if (!raw) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(String(raw).trim());
}

// ---------- Даты и валидации ----------
export function initDates() {
  const today = todayISO();
  elFrom.min = today;
  elGuests.value = elGuests.value || '1';

  function syncLimits() {
    if (elFrom.value) {
      elTo.min = elFrom.value;
      if (elTo.value && new Date(elTo.value) < new Date(elFrom.value)) {
        elTo.value = elFrom.value;
      }
    } else elTo.removeAttribute('min');
  }
  elFrom.addEventListener('change', syncLimits);
  elTo.addEventListener('change', syncLimits);
  syncLimits();
}

export function datesValid() {
  const f = elFrom.value, t = elTo.value;
  if (!f || !t) return false;
  try { return new Date(t).getTime() >= new Date(f).getTime(); }
  catch { return false; }
}
export function contactsValid() {
  const phoneRaw = elPhone.value.trim();
  const emailRaw = elEmail.value.trim();
  if (!phoneRaw && !emailRaw) return { ok:false, field: elPhone, msg:'Укажите телефон или e-mail для связи.' };
  if (phoneRaw && !isValidPhone(phoneRaw)) return { ok:false, field: elPhone, msg:'Проверьте телефон. Пример: +7 999 123-45-67' };
  if (emailRaw && !isValidEmail(emailRaw)) return { ok:false, field: elEmail, msg:'Проверьте e-mail. Пример: example@mail.ru' };
  return { ok:true };
}
