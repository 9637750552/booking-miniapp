import {
  btnPickOnMap,
  btnConfirm,
  elFrom,
  elTo,
  STORAGE_KEY,
  PERSIST_AFTER_CLOSE,
  getFormState
} from './state.js';
import { datesValid, contactsValid, normalizePhone } from './validation.js';
import { IN_TELEGRAM, tg, impactLight, safeAlert, showAlert } from './telegram.js';

// ---------- Локальный UI (спиннер/успех, тост, модалка) ----------
export function initLocalUi() {
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
}

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

let isSending = false;

// ---------- Кнопки ----------
function updateButtonsState() { btnPickOnMap.disabled = !datesValid(); }

export function initNavigation() {
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
      ? `../map/index.html?${params.toString()}`
      : `../map/?${params.toString()}`;
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
}
