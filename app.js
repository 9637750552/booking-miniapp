// ============================================================
// app.js — главная форма бронирования
// • Переход на карту: передаём всё состояние в URL
// • Возврат с карты: читаем всё из URL (включая pitch_*)
// • Telegram: per-user localStorage (по user.id), TTL, опциональная очистка
// • Локально: ничего не сохраняем, при старте чистим прошлое
// • Кнопка "Подтвердить": в Telegram sendData + alert + close; локально — тост+модалка
// ============================================================

// ---------- Окружение Telegram ----------
const tg = window.Telegram?.WebApp || null;

// БОЛЕЕ НАДЁЖНАЯ детекция запуска в Telegram WebApp
const IN_TG_BY_INITDATA = !!(tg && typeof tg.initData === 'string' && tg.initData.length > 0);
const IN_TG_BY_USER     = !!(tg && (tg.initDataUnsafe?.user?.id || tg.initDataUnsafe?.receiver?.id));
const IN_TG_BY_PLATFORM = !!(tg && typeof tg.platform === 'string' && tg.platform !== 'unknown');
const IN_TELEGRAM       = IN_TG_BY_INITDATA || IN_TG_BY_USER || IN_TG_BY_PLATFORM;

// Сигнал готовности WebApp (безопасно вызывать всегда)
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

// ---------- Настройки "памяти" формы ----------
const PERSIST_AFTER_CLOSE = true; // true — помнить после закрытия; false — очищать после успешной отправки
const PERSIST_TTL_HOURS   = 24;   // срок жизни сохранённой формы в часах; 0 — не ограничивать

// Персональный ключ для одного пользователя
const USER_ID = IN_TELEGRAM
  ? (tg?.initDataUnsafe?.user?.id || tg?.initDataUnsafe?.receiver?.id || tg?.platform || 'tg')
  : 'local';
const STORAGE_KEY = `booking_form_v1_${USER_ID}`;

// ---------- DOM ----------
const elFrom   = document.getElementById('from');
const elTo     = document.getElementById('to');
const elGuests = document.getElementById('guests');
const elPhone  = document.getElementById('phone');
const elEmail  = document.getElementById('email');

const elPitch       = document.getElementById('pitch');
const btnClearPitch = document.getElementById('clear_pitch');

const btnChildrenToggle = document.getElementById('children_toggle');
const panelChildren     = document.getElementById('children_panel');
const listChildren      = document.getElementById('children_list');
const selAge            = document.getElementById('child_age_select');

const btnPickOnMap = document.getElementById('pick_on_map');
const btnConfirm   = document.getElementById('confirm');

// Отключаем автозаполнение/автокоррекцию браузера
[elFrom, elTo, elGuests, elPhone, elEmail, elPitch].forEach(el => {
  if (!el) return;
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('autocapitalize', 'off');
  el.setAttribute('spellcheck', 'false');
});

let childrenAges = [];
let isSending = false;
let selectedPitch = null; // { id, name, layer }

// ---------- Helpers ----------
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function impactLight() { try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch {} }

// Безопасный alert: в Telegram (если метод есть) — tg.showAlert, иначе window.alert
function safeAlert(message) {
  try {
    if (IN_TELEGRAM && typeof tg.showAlert === 'function') {
      tg.showAlert(message);
      return;
    }
  } catch {}
  window.alert(message);
}
function showAlert(msg) { safeAlert(msg); }

function normalizePhone(raw) { return (raw || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''); }
function isValidPhone(raw) {
  const p = normalizePhone(raw);
  const digits = p.replace(/\D/g, '');
  if (digits.length < 10) return false;
  return /^\+?\d{10,15}$/.test(p);
}
function isValidEmail(raw) {
  if (!raw) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(String(raw).trim());
}

// ---------- Локальный UI (спиннер/успех, тост, модалка) ----------
(function injectLocalUiOnce(){
  if (document.getElementById('__local_ui_styles')) return;

  const css = `
  .btn-loading{position:relative;pointer-events:none;opacity:.9}
  .btn-loading::after{content:"";position:absolute;right:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;border-radius:50%;
    border:2px solid currentColor;border-right-color:transparent;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
  .btn-success{background:#22c55e!important}
  .btn-success:hover{background:#16a34a!important}

  #__toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#16a34a;color:#fff;
    padding:10px 14px;border-radius:10px;font:14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    box-shadow:0 4px 10px rgba(0,0,0,.15);z-index:9999;opacity:0;pointer-events:none;transition:opacity .2s, transform .2s}
  #__toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}

  #__modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:9998}
  #__modal.show{display:flex}
  #__modal .box{width:min(92vw,820px);max-height:80vh;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.25)}
  #__modal .hd{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #e5e7eb;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  #__modal .bd{padding:0}
  #__modal pre{margin:0;padding:14px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.4}
  #__modal .close{border:none;background:#f3f4f6;border-left:1px solid #e5e7eb;padding:8px 12px;border-radius:8px;cursor:pointer}
  `;

  const st = document.createElement('style');
  st.id = '__local_ui_styles';
  st.textContent = css;
  document.head.appendChild(st);

  const toast = document.createElement('div');
  toast.id = '__toast';
  document.body.appendChild(toast);

  const modal = document.createElement('div');
  modal.id = '__modal';
  modal.innerHTML = `
    <div class="box">
      <div class="hd">
        <span>Локальный режим — данные формы</span>
        <button class="close" type="button" id="__modal_close">Закрыть</button>
      </div>
      <div class="bd"><pre id="__modal_pre"></pre></div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('__modal_close').addEventListener('click', ()=>hideLocalModal());
  modal.addEventListener('click', (e)=>{ if (e.target === modal) hideLocalModal(); });
})();
function setConfirmLoading(on = true) {
  if (on) {
    btnConfirm.classList.add('btn-loading');
    btnConfirm.dataset.prevText = btnConfirm.textContent;
    btnConfirm.textContent = 'Отправляем...';
  } else {
    btnConfirm.classList.remove('btn-loading');
    if (btnConfirm.dataset.prevText) btnConfirm.textContent = btnConfirm.dataset.prevText;
  }
}
function flashConfirmSuccess(text = 'Готово') {
  btnConfirm.classList.remove('btn-loading');
  btnConfirm.classList.add('btn-success');
  btnConfirm.dataset.prevText = btnConfirm.dataset.prevText || btnConfirm.textContent;
  btnConfirm.textContent = `✅ ${text}`;
  setTimeout(() => {
    btnConfirm.classList.remove('btn-success');
    if (btnConfirm.dataset.prevText) btnConfirm.textContent = btnConfirm.dataset.prevText;
  }, 1200);
}
function showToast(msg='Готово') {
  const el = document.getElementById('__toast');
  el.textContent = `✅ ${msg}`;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1600);
}
function showLocalModal(jsonObj) {
  const pre = document.getElementById('__modal_pre');
  pre.textContent = JSON.stringify(jsonObj, null, 2);
  document.getElementById('__modal').classList.add('show');
}
function hideLocalModal() {
  const m = document.getElementById('__modal');
  if (m) m.classList.remove('show');
}

// ---------- Даты и валидации ----------
(function initDates() {
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
})();
function datesValid() {
  const f = elFrom.value, t = elTo.value;
  if (!f || !t) return false;
  try { return new Date(t).getTime() >= new Date(f).getTime(); }
  catch { return false; }
}
function contactsValid() {
  const phoneRaw = elPhone.value.trim();
  const emailRaw = elEmail.value.trim();
  if (!phoneRaw && !emailRaw) return { ok:false, field: elPhone, msg:'Укажите телефон или e-mail для связи.' };
  if (phoneRaw && !isValidPhone(phoneRaw)) return { ok:false, field: elPhone, msg:'Проверьте телефон. Пример: +7 999 123-45-67' };
  if (emailRaw && !isValidEmail(emailRaw)) return { ok:false, field: elEmail, msg:'Проверьте e-mail. Пример: example@mail.ru' };
  return { ok:true };
}

// ---------- Дети ----------
function ageLabel(n) {
  if (n === 0) return 'до 1 года';
  const tail = n % 10, last2 = n % 100;
  let word = 'лет';
  if (tail === 1 && last2 !== 11) word = 'год';
  else if ([2,3,4].includes(tail) && ![12,13,14].includes(last2)) word = 'года';
  return `${n} ${word}`;
}
function renderChildren() {
  listChildren.innerHTML = '';
  childrenAges.forEach((age, idx) => {
    const row = document.createElement('div');
    row.className = 'child-item';
    const label = document.createElement('div');
    label.className = 'child-label';
    label.textContent = `Ребёнок ${ageLabel(age)}`;
    const btn = document.createElement('button');
    btn.className = 'child-remove';
    btn.type = 'button';
    btn.textContent = '×';
    btn.addEventListener('click', () => { childrenAges.splice(idx, 1); renderChildren(); saveFormState(); renderSummary(); });
    row.appendChild(label); row.appendChild(btn);
    listChildren.appendChild(row);
  });
}
selAge.addEventListener('change', () => {
  const v = selAge.value; if (!v || v === '') return;
  const n = Number(v); if (Number.isNaN(n) || n < 0 || n > 13) return;
  childrenAges.push(n); renderChildren(); selAge.value=''; saveFormState(); renderSummary();
});
btnChildrenToggle.addEventListener('click', () => {
  const hidden = panelChildren.hasAttribute('hidden');
  if (hidden) { panelChildren.removeAttribute('hidden'); btnChildrenToggle.classList.add('open'); }
  else { panelChildren.setAttribute('hidden',''); btnChildrenToggle.classList.remove('open'); }
});

// ---------- Состояние (URL / localStorage) ----------
function getFormState() {
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
function saveFormState() {
  if (!IN_TELEGRAM) return;
  try {
    const payload = { data: getFormState(), ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

// Загружаем ТОЛЬКО в Telegram; локально — чистим следы
function loadFormState() {
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
function updatePitchField() {
  if (selectedPitch && (selectedPitch.name || selectedPitch.id)) {
    elPitch.value = selectedPitch.name || selectedPitch.id;
    btnClearPitch.disabled = false;
  } else {
    elPitch.value = 'Не выбран';
    btnClearPitch.disabled = true;
  }
}
btnClearPitch.addEventListener('click', () => {
  selectedPitch = null;
  updatePitchField();
  saveFormState(); renderSummary();
});

// URL → форма (возврат с карты)
(function readFromURL(){
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
})();

// Восстановление (локально — будет очищение)
loadFormState();

// ---------- Кнопки ----------
function updateButtonsState() { btnPickOnMap.disabled = !datesValid(); }
['change','input'].forEach(ev => { elFrom.addEventListener(ev, updateButtonsState); elTo.addEventListener(ev, updateButtonsState); });
updateButtonsState();

// Переход на карту: передаём ВСЁ состояние в URL
btnPickOnMap.addEventListener('click', () => {
  if (!datesValid()) {
    impactLight();
    return showAlert('Пожалуйста, выберите корректные даты заезда и выезда');
  }
  const state = getFormState();
  const params = new URLSearchParams({
    from: state.from,
    to: state.to,
    guests: state.guests,
    children_ages: state.children_ages.join(','),
    phone: state.phone,
    email: state.email
  });
  const target = (location.protocol === 'file:')
    ? `./map/index.html?${params.toString()}`
    : `./map/?${params.toString()}`;
  location.href = target;
});

// Подтверждение
btnConfirm.addEventListener('click', () => {
  if (!datesValid()) {
    impactLight();
    return showAlert('Пожалуйста, выберите корректные даты заезда и выезда');
  }
  const check = contactsValid();
  if (!check.ok) {
    check.field?.classList.add('invalid');
    impactLight();
    return showAlert(check.msg);
  }
  if (isSending) return;
  isSending = true;

  btnConfirm.disabled = true;
  btnPickOnMap.disabled = true;
  setConfirmLoading(true);

  const data = getFormState();
  data.phone = data.phone ? normalizePhone(data.phone) : '';

  try {
    if (IN_TELEGRAM) {
      // Telegram: отправить → опционально очистить память → alert → закрыть
      tg.sendData(JSON.stringify(data));
      if (!PERSIST_AFTER_CLOSE) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
      safeAlert('✅ Отправлено!');
      setTimeout(() => tg.close?.(), 300);
      // не разблокируем — окно закроется
    } else {
      // Локально: показать фидбек и разблокировать
      flashConfirmSuccess('Готово');
      showToast('Данные сформированы (локальный режим)');
      showLocalModal(data);
      setTimeout(() => {
        setConfirmLoading(false);
        btnConfirm.disabled = false;
        btnPickOnMap.disabled = !datesValid();
        isSending = false;
      }, 700);
    }
  } catch (e) {
    console.error(e);
    impactLight();
    showAlert('Не удалось отправить данные. Попробуйте ещё раз.');
    setConfirmLoading(false);
    btnConfirm.disabled = false;
    btnPickOnMap.disabled = !datesValid();
    isSending = false;
  }
});

// Мини-сводка под кнопками (если есть #summary)
function renderSummary() {
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
renderSummary();
