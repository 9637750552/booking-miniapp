// ============================================================
// app.js — главная форма бронирования
// • Переход на карту: передаём всё состояние в URL
// • Возврат с карты: читаем всё из URL (включая pitch_*)
// • Telegram: per-user localStorage (по user.id), TTL, опциональная очистка
// • Локально: ничего не сохраняем, при старте чистим прошлое
// • Кнопка "Подтвердить": в Telegram sendData + alert + close; локально — тост+модалка
// ============================================================

import { initTelegram } from './telegram.js';
import {
  initFormElements,
  initPitchField,
  readFromURL,
  loadFormState,
  renderSummary
} from './state.js';
import { initDates } from './validation.js';
import { initChildren } from './children.js';
import { initLocalUi, initNavigation } from './navigation.js';

initTelegram();
initFormElements();
initLocalUi();
initDates();
initChildren();
initPitchField();
readFromURL();
loadFormState();
initNavigation();
renderSummary();
