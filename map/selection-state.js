export function createSelectionState({ selectedLabelEl, btnCancel, btnOk }) {
  let selectedEl = null;

  function updateEmpty() {
    selectedLabelEl.textContent = '—';
    btnOk.disabled = btnCancel.disabled = true;
  }

  function getSelectedEl() {
    return selectedEl;
  }

  function setSelected(el, label) {
    selectedEl = el;
    selectedLabelEl.textContent = label;
    btnOk.disabled = btnCancel.disabled = false;
  }

  function clearSelection() {
    if (!selectedEl) {
      updateEmpty();
      return;
    }
    selectedEl.dataset.sel = '0';
    if (selectedEl.dataset.selCloneId) {
      const old = document.getElementById(selectedEl.dataset.selCloneId);
      if (old) old.remove();
      delete selectedEl.dataset.selCloneId;
    }
    selectedEl = null;
    updateEmpty();
  }

  return {
    getSelectedEl,
    setSelected,
    clearSelection,
  };
}
