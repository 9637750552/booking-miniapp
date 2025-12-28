import { IN_TELEGRAM, STORAGE_KEY } from '../env/telegram.js';
import { btnClearPitch, elEmail, elFrom, elGuests, elPhone, elPitch, elTo } from '../ui/form-bindings.js';

const PERSIST_AFTER_CLOSE = true;
const PERSIST_TTL_HOURS = 24;

const childrenAges = [];
let isSending = false;
let selectedPitch = null;

function getSelectedPitch() {
  return selectedPitch;
}

function setSelectedPitch(pitch) {
  selectedPitch = pitch;
}

function setChildrenAges(ages) {
  childrenAges.length = 0;
  childrenAges.push(...ages);
}

function getIsSending() {
  return isSending;
}

function setIsSending(value) {
  isSending = value;
}

function getFormState() {
  return {
    from: elFrom.value || '',
    to: elTo.value || '',
    guests: elGuests.value || '1',
    children_count: childrenAges.length,
    children_ages: childrenAges.slice(),
    phone: elPhone.value.trim(),
    email: elEmail.value.trim(),
    pitch: selectedPitch
  };
}

function saveFormState() {
  if (!IN_TELEGRAM) return;
  try {
    const payload = { data: getFormState(), ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function loadFormState({ renderChildren }) {
  if (!IN_TELEGRAM) {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { data, ts } = JSON.parse(raw);

    if (PERSIST_TTL_HOURS > 0) {
      const ageH = (Date.now() - (ts || 0)) / 36e5;
      if (ageH > PERSIST_TTL_HOURS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
    }

    if (data.from) elFrom.value = data.from;
    if (data.to) elTo.value = data.to;
    if (data.guests) elGuests.value = data.guests;
    if (Array.isArray(data.children_ages)) {
      setChildrenAges(data.children_ages.filter(n => Number.isFinite(n)));
      renderChildren();
    }
    if (data.phone) elPhone.value = data.phone;
    if (data.email) elEmail.value = data.email;
    if (data.pitch) {
      selectedPitch = data.pitch;
      updatePitchField();
    }
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

function initPitchClear({ renderSummary, saveFormState: saveForm }) {
  btnClearPitch.addEventListener('click', () => {
    selectedPitch = null;
    updatePitchField();
    saveForm();
    renderSummary();
  });
}

export {
  PERSIST_AFTER_CLOSE,
  STORAGE_KEY,
  childrenAges,
  getFormState,
  getIsSending,
  getSelectedPitch,
  initPitchClear,
  loadFormState,
  saveFormState,
  setChildrenAges,
  setIsSending,
  setSelectedPitch,
  updatePitchField
};
