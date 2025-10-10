// ============================================================
//  app.js — форма бронирования (экран 1)
//  Добавлен переход на карту с параметрами from/to/guests
// ============================================================

const tg = window.Telegram?.WebApp;
tg?.expand?.();

// Поля формы
const elFrom         = document.getElementById('from');
const elTo           = document.getElementById('to');
const elGuests       = document.getElementById('guests');
const elChildren     = document.getElementById('children');
const elChildrenAge  = document.getElementById('children_age');
const elPhone        = document.getElementById('phone');
const elEmail        = document.getElementById('email');

// Кнопки
const btnPickOnMap = document.getElementById('pick_on_map');
const btnConfirm   = document.getElementById('confirm');

// Валидация дат
function datesValid() {
  const f = elFrom.value;
  const t = elTo.value;
  if (!f || !t) return false;
  // простая проверка: to >= from
  try {
    return new Date(t).getTime() >= new Date(f).getTime();
  } catch { return false; }
}

// Подсказка при изменении полей дат — активируем/деактивируем кнопку карты
function updateButtonsState() {
  btnPickOnMap.disabled = !datesValid();
}
['change','input'].forEach(ev => {
  elFrom.addEventListener(ev, updateButtonsState);
  elTo.addEventListener(ev, updateButtonsState);
});
updateButtonsState();

// === Кнопка: выбрать участок на карте ===
// Откроет /map/ с параметрами from/to/guests
btnPickOnMap.addEventListener('click', () => {
  if (!datesValid()) {
    alert('Пожалуйста, выберите корректные даты заезда и выезда');
    return;
  }
  const params = new URLSearchParams({
    from: elFrom.value,
    to: elTo.value,
    guests: elGuests.value || '1'
  });
  // Переход на экран карты в рамках одного MiniApp
  location.href = `./map/?${params.toString()}`;
});

// === Кнопка: подтвердить без выбора участка ===
// (оставляем для сценариев, когда карта не нужна)
btnConfirm.addEventListener('click', () => {
  const data = {
    from: elFrom.value || '',
    to: elTo.value || '',
    guests: elGuests.value || '',
    children: elChildren.value || '',
    children_age: elChildrenAge.value || '',
    phone: elPhone.value || '',
    email: elEmail.value || ''
  };

  if (!datesValid()) {
    alert('Пожалуйста, выберите корректные даты заезда и выезда');
    return;
  }

  tg?.sendData?.(JSON.stringify(data));
  alert('✅ Данные отправлены. Ожидайте подтверждения.');
  // tg?.close?.(); // можно закрыть MiniApp при необходимости
});
