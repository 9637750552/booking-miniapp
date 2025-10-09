// ============================================================
//  app.js — расширенная версия для формы бронирования
//  Отправляет все данные (даты, гости, дети, контакты) в Telegram WebApp
// ============================================================

// Получаем объект Telegram WebApp API
const tg = window.Telegram.WebApp;

// Разворачиваем MiniApp на весь экран
if (tg && tg.expand) tg.expand();

// Находим кнопку подтверждения
const btnConfirm = document.getElementById('confirm');

// Обработчик клика по кнопке "Подтвердить"
btnConfirm.addEventListener('click', () => {
  // Собираем данные из полей формы
  const data = {
    from: document.getElementById('from').value || '',
    to: document.getElementById('to').value || '',
    guests: document.getElementById('guests').value || '',
    children: document.getElementById('children').value || '',
    children_age: document.getElementById('children_age').value || '',
    phone: document.getElementById('phone').value || '',
    email: document.getElementById('email').value || '',
  };

  // Простая валидация обязательных полей
  if (!data.from || !data.to) {
    alert('Пожалуйста, выберите даты заезда и выезда');
    return;
  }

  // Отправка данных в Telegram как JSON
  if (tg && tg.sendData) {
    tg.sendData(JSON.stringify(data));
  }

  // Отображаем уведомление пользователю (опционально)
  alert('✅ Данные отправлены. Ожидайте подтверждения.');

  // Можно закрыть MiniApp после отправки (если нужно)
  // tg.close();
});
