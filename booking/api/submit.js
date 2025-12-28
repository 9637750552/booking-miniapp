import { btnConfirm, btnPickOnMap } from '../ui/form-bindings.js';
import { contactsValid, normalizePhone } from '../ui/validation.js';
import { flashConfirmSuccess, setConfirmLoading, showLocalModal, showToast } from '../ui/local-ui.js';
import { PERSIST_AFTER_CLOSE, STORAGE_KEY, getIsSending, setIsSending } from '../state/booking-state.js';

function initSubmit({
  datesValid,
  getFormState,
  impactLight,
  showAlert,
  tg,
  IN_TELEGRAM
}) {
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
    if (getIsSending()) return;
    setIsSending(true);

    btnConfirm.disabled = true;
    btnPickOnMap.disabled = true;
    setConfirmLoading(btnConfirm, true);

    const data = getFormState();
    data.phone = data.phone ? normalizePhone(data.phone) : '';

    try {
      if (IN_TELEGRAM) {
        tg.sendData(JSON.stringify(data));
        if (!PERSIST_AFTER_CLOSE) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
        showAlert('✅ Отправлено!');
        setTimeout(() => tg.close?.(), 300);
      } else {
        flashConfirmSuccess(btnConfirm, 'Готово');
        showToast('Данные сформированы (локальный режим)');
        showLocalModal(data);
        setTimeout(() => {
          setConfirmLoading(btnConfirm, false);
          btnConfirm.disabled = false;
          btnPickOnMap.disabled = !datesValid();
          setIsSending(false);
        }, 700);
      }
    } catch (e) {
      console.error(e);
      impactLight();
      showAlert('Не удалось отправить данные. Попробуйте ещё раз.');
      setConfirmLoading(btnConfirm, false);
      btnConfirm.disabled = false;
      btnPickOnMap.disabled = !datesValid();
      setIsSending(false);
    }
  });
}

export {
  initSubmit
};
