// ===== НАСТРОЙКА =====
const SVG_URL = 'assets/masterplan.svg'; // твой файл
const LAYER_LABELS = ['pitches_60', 'pitches_80', 'pitches_100']; // имена слоёв в SVG

// ===== КАРТА =====
const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: true,
  minZoom: -3,
});

let svgRoot = null;
let svgOverlay = null;

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const statusEl = $('#status');
const opacityInp = $('#opacity');

// ===== ЗАГРУЗКА SVG В OVERLAY =====
init();

async function init() {
  const text = await fetch(SVG_URL + cacheBust()).then(r => r.text());
  const doc  = new DOMParser().parseFromString(text, 'image/svg+xml');
  svgRoot    = doc.documentElement;

  // Проверяем viewBox
  const vb = svgRoot.getAttribute('viewBox');
  if (!vb) throw new Error('В SVG нужен viewBox="minX minY width height".');

  const [minX, minY, width, height] = vb.split(/\s+/).map(Number);
  const bounds = [[0,0], [height, width]];

  // Вставляем как overlay
  svgOverlay = L.svgOverlay(svgRoot, bounds, { opacity: opacityInp.value/100 }).addTo(map);
  map.fitBounds(bounds);

  // Навесим интерактив
  prepareSvg(svgRoot);

  // UI-кнопки
  bindUI();
  setStatus('Готово');
}

function cacheBust() {
  return (SVG_URL.includes('?') ? '&' : '?') + 'v=' + Date.now();
}

// ===== ПОДГОТОВКА ВНУТРИ SVG =====
function prepareSvg(svg) {
  // 1) Пометим все фигуры-питчи классом .pitch (path, polygon, rect, circle — на всякий)
  const pitchSelectors = LAYER_LABELS.map(lbl => groupSelector(lbl) + ' path, ' + groupSelector(lbl) + ' polygon, ' + groupSelector(lbl) + ' rect, ' + groupSelector(lbl) + ' circle').join(', ');
  const shapes = $$(pitchSelectors, svg);

  shapes.forEach(el => {
    el.classList.add('pitch');
    el.addEventListener('mouseenter', () => el.classList.add('hover'));
    el.addEventListener('mouseleave', () => el.classList.remove('hover'));
    el.addEventListener('click', (ev) => onPitchClick(ev, el));
  });

  // 2) Слои по-умолчанию включены
  LAYER_LABELS.forEach(lbl => setLayerVisible(lbl, true));
}

// Поддержка разных вариантов метки слоя
function groupSelector(label) {
  // ищем <g inkscape:label="..."> ИЛИ id="..." ИЛИ sodipodi:label="..."
  return `g[inkscape\\:label="${label}"], g#${cssEscape(label)}, g[sodipodi\\:label="${label}"]`;
}

function findLayerGroups(label) {
  if (!svgRoot) return [];
  return $$(groupSelector(label), svgRoot);
}

function setLayerVisible(label, visible) {
  const groups = findLayerGroups(label);
  groups.forEach(g => g.classList.toggle('layer-hidden', !visible));
}

function cssEscape(id) {
  // примитивное экранирование для селектора id
  return id.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// ===== ОБРАБОТЧИК КЛИКА ПО ПИТЧУ =====
function onPitchClick(ev, el) {
  // переключаем выделение
  el.classList.toggle('selected');

  const id   = el.getAttribute('id') || '(без id)';
  const fill = el.getAttribute('fill') || getComputedStyle(el).fill || '';
  const msg  = `Питч: ${id}  |  selected=${el.classList.contains('selected')}  |  fill=${fill}`;
  setStatus(msg);
  // здесь можно дернуть свою логику (панель, форма и т.п.)
}

// ===== UI ПАНЕЛЬ =====
function bindUI() {
  // Переключатели слоёв
  $$('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.layer;
      const isOn  = btn.classList.contains('on');
      setLayerVisible(label, !isOn);
      btn.classList.toggle('on', !isOn);
      btn.classList.toggle('off', isOn);
    });
  });

  // Все / Скрыть
  $('#btn-all').addEventListener('click', () => {
    LAYER_LABELS.forEach(lbl => setLayerVisible(lbl, true));
    $$('.toggle').forEach(b => b.classList.add('on')); 
    $$('.toggle').forEach(b => b.classList.remove('off'));
  });
  $('#btn-none').addEventListener('click', () => {
    LAYER_LABELS.forEach(lbl => setLayerVisible(lbl, false));
    $$('.toggle').forEach(b => b.classList.remove('on'));
    $$('.toggle').forEach(b => b.classList.add('off'));
  });

  // Прозрачность
  opacityInp.addEventListener('input', () => {
    if (!svgOverlay) return;
    const v = Number(opacityInp.value)/100;
    // два варианта: через setOpacity у overlay И/ИЛИ style.opacity у <svg>
    svgOverlay.setOpacity(v);
    if (svgRoot) svgRoot.style.opacity = v;
  });
}

function setStatus(t) { statusEl.textContent = t; }
