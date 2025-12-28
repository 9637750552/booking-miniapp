import { IN_TELEGRAM, impactLight, showAlert, tg } from './env/telegram.js';
import { initFormFields, initDates, renderSummary, setupButtonState } from './ui/form-bindings.js';
import { initLocalUiOnce } from './ui/local-ui.js';
import { datesValid, todayISO } from './ui/validation.js';
import {
  childrenAges,
  getFormState,
  getSelectedPitch,
  initPitchClear,
  loadFormState,
  setChildrenAges,
  setSelectedPitch,
  updatePitchField
} from './state/booking-state.js';
import { initChildrenControls, renderChildren } from './ui/children-controls.js';
import { initPickOnMap, readFromURL } from './map-integration/map-bridge.js';
import { initSubmit } from './api/submit.js';

initFormFields();

initLocalUiOnce();

initDates(todayISO);

const renderSummaryWithState = () => {
  renderSummary({
    childrenAges,
    selectedPitch: getSelectedPitch()
  });
};

initChildrenControls({
  renderSummary: renderSummaryWithState,
  saveFormState
});

initPitchClear({
  renderSummary: renderSummaryWithState,
  saveFormState
});

readFromURL({
  renderChildren,
  saveFormState,
  setChildrenAges,
  setSelectedPitch,
  updatePitchField
});

loadFormState({
  renderChildren
});

setupButtonState(datesValid);

initPickOnMap({
  datesValid,
  getFormState,
  impactLight,
  showAlert
});

initSubmit({
  datesValid,
  getFormState,
  impactLight,
  showAlert,
  tg,
  IN_TELEGRAM
});

renderSummaryWithState();
