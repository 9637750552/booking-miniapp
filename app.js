// ============================================================
//  app.js — форма бронирования (экран 1)
//  • «Добавить детей» без кнопки (выбор = добавление)
//  • Валидация контактов: телефон / e-mail
//  • Требование: хотя бы один контакт обязателен
//  • Исправлен переход на карту при открытии с file://
// ============================================================

const tg = window.Telegram?.WebApp;
tg?.expand?.();

// === Элементы формы ===
const elFrom   = document.getElementById('from');
const elTo     = document.getElementById('to');
const elGuests = document.getElementById('guests');
const elPhone  = document.getElementById('phone');
const elEmail  = document.getElementById('email');

// === Элементы блока "Дети" ===
const btnChildrenToggle = document.getElementById('children_toggle');
const panelChildren     = document.getElementById('children_panel');
const listChildren      = document.getElementById('children_list');
const selAge            = document.getElementById('child_age_select');

// === Кнопки действий ===
const btnPickOnMap = document.getElementById('pick_on_map');
const btnConfirm   = document.getElementById('confirm');

// === Хранилище детей ===
let childrenAges = [];

// ------------------------------------------------------------
// 🗓 Проверка дат (to >= from)
// ------------------------------------------------------------
function datesValid() {
  const f = elFrom.value, t = elTo.value;
  if (!f || !t) return false;
  try { return new Date(t).getTime() >= new Date(f).getTime(); }
  catch { return false; }
}
function updateButtonsState() {
  btnPickOnMap.disabled = !datesValid();
}
['change','input'].forEach(ev => {
  elFrom.addEventListener(ev, updateButtonsState);
  elTo.addEventListener(ev, updateButtonsState);
});
updateButtonsState();

// ------------------------------------------------------------
// 👶 Аккордеон "+ Добавить детей"
// ------------------------------------------------------------
btnChildrenToggle.addEventListener('click', () => {
  const hidden = panelChildren.hasAttribute('hidden');
  if (hidden) {
    panelChildren.removeAttribute('hidden');
    btnChildrenToggle.classList.add('open');
  } else {
    panelChildren.setAttribute('hidden','');
    btnChildrenToggle.classList.remove('open');
  }
});

// ------------------------------------------------------------
// 🧮 Дети — утилиты рендера
// ------------------------------------------------------------
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
    btn.addEventListener('click', () => {
      childrenAges.splice(idx, 1);
      renderChildren();
    });

    row.appendChild(label);
    row.appendChild(btn);
    listChildren.appendChild(row);
  });
}

// Добавление ребёнка при выборе возраста
function addChildBySelect() {
  const v = selAge.value;
  if (!v || v === '') return;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || n > 13) return;
  childrenAges.push(n);
  renderChildren();
  selAge.value = ''; // сброс селекта на плейсхолдер
}
selAge.addEventListener('change', addChildBySelect);

// ------------------------------------------------------------
// 📞📧 Валидация контактов
// ------------------------------------------------------------
function normalizePhone(raw) {
  return (raw || '')
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');
}
function isValidPhone(raw) {
  const p = normalizePhone(raw);
  const digits = p.replace(/\D/g, '');
  if (digits.length < 10) return false;
  return /^\+?7\d{10}$/.test(p) || /^8\d{10}$/.test(p) || digits.length >= 10;
}
function isValidEmail(raw) {
  if (!raw) return false;
  const s = String(raw).trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(s);
}
function markInvalid(el, msg) {
  el.classList.add('invalid');
  alert(msg);
  el.focus();
}
function clearInvalid() {
  [elPhone, elEmail].forEach(el => el.classList.remove('invalid'));
}

// ------------------------------------------------------------
// 🗺 Переход на карту (исправлено для file://)
// ------------------------------------------------------------
btnPickOnMap.addEventListener('click', () => {
  if (!datesValid()) {
    alert('Пожалуйста, выберите корректные даты заезда и выезда');
    return;
  }

  const params = new URLSearchParams({
    from: elFrom.value,
    to: elTo.value,
    guests: elGuests.value || '1',
    // при желании можно добавить детей:
    // children_count: String(childrenAges.length),
    // children_ages: childrenAges.join(',')
  });

  // 🔧 Явно указываем index.html для корректной работы с file://
  const target = (location.protocol === 'file:')
    ? `./map/index.html?${params.toString()}`
    : `./map/?${params.toString()}`;

  location.href = target;
});

// ------------------------------------------------------------
// ✅ Подтверждение (валидация контактов)
// ------------------------------------------------------------
btnConfirm.addEventListener('click', () => {
  if (!datesValid()) {
    alert('Пожалуйста, выберите корректные даты заезда и выезда');
    return;
  }
  clearInvalid();

  const phoneRaw = elPhone.value.trim();
  const emailRaw = elEmail.value.trim();

  if (!phoneRaw && !emailRaw) {
    markInvalid(elPhone, 'Укажите телефон или e-mail для связи.');
    return;
  }
  if (phoneRaw && !isValidPhone(phoneRaw)) {
    markInvalid(elPhone, 'Похоже, телефон указан некорректно. Пример: +7 999 123-45-67');
    return;
  }
  if (emailRaw && !isValidEmail(emailRaw)) {
    markInvalid(elEmail, 'Похоже, адрес e-mail указан некорректно. Пример: example@mail.ru');
    return;
  }

  const phoneNormalized = phoneRaw ? normalizePhone(phoneRaw) : '';

  const data = {
    from: elFrom.value || '',
    to: elTo.value || '',
    guests: elGuests.value || '',
    children_count: childrenAges.length,
    children_ages: childrenAges.slice(),
    phone: phoneNormalized,
    email: emailRaw || ''
  };

  tg?.sendData?.(JSON.stringify(data));
  alert('✅ Данные отправлены. Ожидайте подтверждения.');
  // tg?.close?.();
});

// ------------------------------------------------------------
// 🎨 Для ошибок (добавь в CSS):
// .invalid { border-color: #ef4444 !important; box-shadow: 0 0 0 3px rgba(239,68,68,.12); }
// ------------------------------------------------------------
