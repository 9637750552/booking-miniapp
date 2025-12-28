import { btnChildrenToggle, listChildren, panelChildren, selAge } from './form-bindings.js';
import { childrenAges } from '../state/booking-state.js';

let renderSummaryFn = () => {};
let saveFormStateFn = () => {};

function ageLabel(n) {
  if (n === 0) return 'до 1 года';
  const tail = n % 10;
  const last2 = n % 100;
  let word = 'лет';
  if (tail === 1 && last2 !== 11) word = 'год';
  else if ([2, 3, 4].includes(tail) && ![12, 13, 14].includes(last2)) word = 'года';
  return `${n} ${word}`;
}

function renderChildren() {
  listChildren.innerHTML = '';
  childrenAges.forEach((age, idx) => {
    const row = document.createElement('div');
    row.className = 'child-item';
    const label = document.createElement('div');
    label.className = 'child-label';
    label.textContent = `Ребёнок ${ageLabel(age)}`;
    const btn = document.createElement('button');
    btn.className = 'child-remove';
    btn.type = 'button';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      childrenAges.splice(idx, 1);
      renderChildren();
      saveFormStateFn();
      renderSummaryFn();
    });
    row.appendChild(label);
    row.appendChild(btn);
    listChildren.appendChild(row);
  });
}

function initChildrenControls({ renderSummary, saveFormState: saveForm }) {
  renderSummaryFn = renderSummary;
  saveFormStateFn = saveForm;

  selAge.addEventListener('change', () => {
    const v = selAge.value;
    if (!v || v === '') return;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || n > 13) return;
    childrenAges.push(n);
    renderChildren();
    selAge.value = '';
    saveFormStateFn();
    renderSummaryFn();
  });

  btnChildrenToggle.addEventListener('click', () => {
    const hidden = panelChildren.hasAttribute('hidden');
    if (hidden) {
      panelChildren.removeAttribute('hidden');
      btnChildrenToggle.classList.add('open');
    } else {
      panelChildren.setAttribute('hidden', '');
      btnChildrenToggle.classList.remove('open');
    }
  });
}

export {
  initChildrenControls,
  renderChildren
};
