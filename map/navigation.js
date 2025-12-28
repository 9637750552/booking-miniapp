import { getReadableLabel } from './svg-interaction.js';

export function wireNavigation({ btnCancel, btnOk, selectionState }) {
  btnCancel.addEventListener('click', selectionState.clearSelection);
  btnOk.addEventListener('click', () => submitSelection(selectionState));
}

// Подтверждение — возвращаемся в форму, ДОБАВИВ pitch_* к исходным параметрам
function submitSelection(selectionState) {
  const selectedEl = selectionState.getSelectedEl();
  if (!selectedEl) return;

  const pid = selectedEl.id || '';
  const pname = getReadableLabel(selectedEl);
  const layer = selectedEl.dataset.layer || '';

  // Берём исходные параметры (from,to,guests,children_ages,phone,email)
  const orig = new URLSearchParams(location.search);

  // Добавляем выбранный участок
  orig.set('pitch_id', pid);
  orig.set('pitch_name', pname);
  orig.set('layer', layer);

  const base = '../booking/index.html';
  const qs = orig.toString();
  location.href = qs ? `${base}?${qs}` : base;
}
