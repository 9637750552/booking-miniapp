import {
  btnChildrenToggle,
  panelChildren,
  listChildren,
  selAge,
  childrenAges,
  saveFormState,
  renderSummary
} from './state.js';

// ---------- Дети ----------
function ageLabel(n) {
  if (n === 0) return 'до 1 года';
  const tail = n % 10, last2 = n % 100;
  let word = 'лет';
  if (tail === 1 && last2 !== 11) word = 'год';
  else if ([2,3,4].includes(tail) && ![12,13,14].includes(last2)) word = 'года';
  return `${n} ${word}`;
}
export function renderChildren() {
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
    btn.addEventListener('click', () => { childrenAges.splice(idx, 1); renderChildren(); saveFormState(); renderSummary(); });
    row.appendChild(label); row.appendChild(btn);
    listChildren.appendChild(row);
  });
}

export function initChildren() {
  selAge.addEventListener('change', () => {
    const v = selAge.value; if (!v || v === '') return;
    const n = Number(v); if (Number.isNaN(n) || n < 0 || n > 13) return;
    childrenAges.push(n); renderChildren(); selAge.value=''; saveFormState(); renderSummary();
  });
  btnChildrenToggle.addEventListener('click', () => {
    const hidden = panelChildren.hasAttribute('hidden');
    if (hidden) { panelChildren.removeAttribute('hidden'); btnChildrenToggle.classList.add('open'); }
    else { panelChildren.setAttribute('hidden',''); btnChildrenToggle.classList.remove('open'); }
  });
}
