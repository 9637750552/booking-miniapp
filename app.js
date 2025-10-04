const tg = window.Telegram?.WebApp;
tg?.ready();

document.getElementById('confirm').addEventListener('click', () => {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  if (!from || !to) {
    alert('Заполните обе даты');
    return;
  }
  tg.sendData(JSON.stringify({ date_from: from, date_to: to }));
  tg.close();
});
