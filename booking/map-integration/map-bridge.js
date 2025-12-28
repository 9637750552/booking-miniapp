import { btnPickOnMap, elEmail, elFrom, elGuests, elPhone, elTo } from '../ui/form-bindings.js';

function readFromURL({ renderChildren, saveFormState, setChildrenAges, setSelectedPitch, updatePitchField }) {
  const qs = new URLSearchParams(location.search);

  const pid = qs.get('pitch_id');
  const pname = qs.get('pitch_name');
  const layer = qs.get('layer');
  if (pid || pname) setSelectedPitch({ id: pid || null, name: pname || pid || 'Участок', layer: layer || null });

  const from = qs.get('from');
  const to = qs.get('to');
  const guests = qs.get('guests');
  const phone = qs.get('phone');
  const email = qs.get('email');
  const ca = qs.get('children_ages');

  if (from) elFrom.value = from;
  if (to) elTo.value = to;
  if (guests) elGuests.value = guests;
  if (phone) elPhone.value = phone;
  if (email) elEmail.value = email;

  if (ca) {
    const ages = (ca || '').split(',')
      .map(s => s.trim()).filter(Boolean)
      .map(n => Number(n)).filter(n => Number.isFinite(n) && n >= 0 && n <= 13);
    setChildrenAges(ages);
    renderChildren();
  }

  if (pid || pname) updatePitchField();

  if ([from, to, guests, phone, email, ca, pid, pname, layer].some(Boolean)) {
    saveFormState();
    try {
      const url = new URL(location.href);
      url.search = '';
      history.replaceState(null, '', url.toString());
    } catch {}
  }
}

function initPickOnMap({ datesValid, getFormState, impactLight, showAlert }) {
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
}

export {
  initPickOnMap,
  readFromURL
};
