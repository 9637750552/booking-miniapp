const elFrom = document.getElementById('from');
const elTo = document.getElementById('to');
const elGuests = document.getElementById('guests');
const elPhone = document.getElementById('phone');
const elEmail = document.getElementById('email');

const elPitch = document.getElementById('pitch');
const btnClearPitch = document.getElementById('clear_pitch');

const btnChildrenToggle = document.getElementById('children_toggle');
const panelChildren = document.getElementById('children_panel');
const listChildren = document.getElementById('children_list');
const selAge = document.getElementById('child_age_select');

const btnPickOnMap = document.getElementById('pick_on_map');
const btnConfirm = document.getElementById('confirm');

function initFormFields() {
  [elFrom, elTo, elGuests, elPhone, elEmail, elPitch].forEach(el => {
    if (!el) return;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
  });
}

function initDates(todayISO) {
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
}

function updateButtonsState(datesValid) {
  btnPickOnMap.disabled = !datesValid();
}

function setupButtonState(datesValid) {
  ['change', 'input'].forEach(ev => {
    elFrom.addEventListener(ev, () => updateButtonsState(datesValid));
    elTo.addEventListener(ev, () => updateButtonsState(datesValid));
  });
  updateButtonsState(datesValid);
}

function renderSummary({ childrenAges, selectedPitch }) {
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

export {
  btnChildrenToggle,
  btnClearPitch,
  btnConfirm,
  btnPickOnMap,
  elEmail,
  elFrom,
  elGuests,
  elPhone,
  elPitch,
  elTo,
  initDates,
  initFormFields,
  listChildren,
  panelChildren,
  renderSummary,
  selAge,
  setupButtonState,
  updateButtonsState
};
