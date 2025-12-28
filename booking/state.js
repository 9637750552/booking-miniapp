import { IN_TELEGRAM, tg } from './telegram.js';
import { renderChildren } from './children.js';

// ---------- Настройки "памяти" формы ----------
export const PERSIST_AFTER_CLOSE = true; // true — помнить после закрытия; false — очищать после успешной отправки
export const PERSIST_TTL_HOURS   = 24;   // срок жизни сохранённой формы в часах; 0 — не ограничивать

// Персональный ключ для одного пользователя
const USER_ID = IN_TELEGRAM
  ? (tg?.initDataUnsafe?.user?.id || tg?.initDataUnsafe?.receiver?.id || tg?.platform || 'tg')
  : 'local';
export const STORAGE_KEY = `booking_form_v1_${USER_ID}`;

// ---------- DOM ----------
export const elFrom   = document.getElementById('from');
export const elTo     = document.getElementById('to');
export const elGuests = document.getElementById('guests');
export const elPhone  = document.getElementById('phone');
export const elEmail  = document.getElementById('email');

export const elPitch       = document.getElementById('pitch');
export const btnClearPitch = document.getElementById('clear_pitch');

export const btnChildrenToggle = document.getElementById('children_toggle');
export const panelChildren     = document.getElementById('children_panel');
export const listChildren      = document.getElementById('children_list');
export const selAge            = document.getElementById('child_age_select');

export const btnPickOnMap = document.getElementById('pick_on_map');
export const btnConfirm   = document.getElementById('confirm');

// Отключаем автозаполнение/автокоррекцию браузера
export function initFormElements() {
  [elFrom, elTo, elGuests, elPhone, elEmail, elPitch].forEach(el => {
    if (!el) return;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
  });
}

export let childrenAges = [];
export let selectedPitch = null; // { id, name, layer }

// ---------- Состояние (URL / localStorage) ----------
export function getFormState() {
  return {
    from: elFrom.value || '',
    to: elTo.value || '',
    guests: elGuests.value || '1',
    children_count: childrenAges.length,
    children_ages: childrenAges.slice(),
    phone: elPhone.value.trim(),
    email: elEmail.value.trim(),
    pitch: selectedPitch // null или {id,name,layer}
  };
}

// Сохраняем ТОЛЬКО в Telegram (+ персонификация + TTL метка)
export function saveFormState() {
  if (!IN_TELEGRAM) return;
  try {
    const payload = { data: getFormState(), ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

// Загружаем ТОЛЬКО в Telegram; локально — чистим следы
export function loadFormState() {
  if (!IN_TELEGRAM) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { data, ts } = JSON.parse(raw);

    // TTL
    if (PERSIST_TTL_HOURS > 0) {
      const ageH = (Date.now() - (ts || 0)) / 36e5;
      if (ageH > PERSIST_TTL_HOURS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
    }

    if (data.from)   elFrom.value = data.from;
    if (data.to)     elTo.value = data.to;
    if (data.guests) elGuests.value = data.guests;
    if (Array.isArray(data.children_ages)) {
      childrenAges = data.children_ages.filter(n => Number.isFinite(n));
      renderChildren();
    }
    if (data.phone) elPhone.value = data.phone;
    if (data.email) elEmail.value = data.email;
    if (data.pitch) { selectedPitch = data.pitch; updatePitchField(); }
  } catch {}
}

export function updatePitchField() {
  if (selectedPitch && (selectedPitch.name || selectedPitch.id)) {
    elPitch.value = selectedPitch.name || selectedPitch.id;
    btnClearPitch.disabled = false;
  } else {
    elPitch.value = 'Не выбран';
    btnClearPitch.disabled = true;
  }
}

export function initPitchField() {
  btnClearPitch.addEventListener('click', () => {
    selectedPitch = null;
    updatePitchField();
    saveFormState(); renderSummary();
  });
}

// URL → форма (возврат с карты)
export function readFromURL() {
  const qs = new URLSearchParams(location.search);

  const pid = qs.get('pitch_id');
  const pname = qs.get('pitch_name');
  const layer = qs.get('layer');
  if (pid || pname) selectedPitch = { id: pid || null, name: pname || pid || 'Участок', layer: layer || null };

  const from   = qs.get('from');
  const to     = qs.get('to');
  const guests = qs.get('guests');
  const phone  = qs.get('phone');
  const email  = qs.get('email');
  const ca     = qs.get('children_ages');

  if (from)   elFrom.value = from;
  if (to)     elTo.value = to;
  if (guests) elGuests.value = guests;
  if (phone)  elPhone.value = phone;
  if (email)  elEmail.value = email;

  if (ca) {
    const ages = (ca || '').split(',')
      .map(s => s.trim()).filter(Boolean)
      .map(n => Number(n)).filter(n => Number.isFinite(n) && n >= 0 && n <= 13);
    childrenAges = ages;
    renderChildren();
  }

  if (selectedPitch) updatePitchField();

  // сохраняем только в Telegram; локально — эта функция просто no-op
  if ([from,to,guests,phone,email,ca,pid,pname,layer].some(Boolean)) {
    saveFormState();
    try { const url = new URL(location.href); url.search = ''; history.replaceState(null, '', url.toString()); } catch {}
  }
}

// Мини-сводка под кнопками (если есть #summary)
export function renderSummary() {
  const el = document.getElementById('summary');
  if (!el) return;
  const parts = [];
  if (elFrom.value && elTo.value) parts.push(`📅 ${elFrom.value} – ${elTo.value}`);
  if (elGuests.value) parts.push(`👥 ${elGuests.value} взр.`);
  if (childrenAges.length) {
    const label = childrenAges.length === 1 ? 'ребёнок' : 'детей';
    parts.push(`👶 ${childrenAges.length} ${label}`);
  }
  if (selectedPitch && (selectedPitch.name || selectedPitch.id))
    parts.push(`🏕 ${selectedPitch.name || selectedPitch.id}`);
  el.textContent = parts.join(' · ') || '—';
}
