// === НАСТРОЙКИ ===
const SVG_URL = 'assets/masterplan.svg'; // путь из папки map/
const LAYER_LABELS = ['pitches_60', 'pitches_80', 'pitches_100'];

// === СОЗДАНИЕ КАРТЫ ===
const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: true,
  minZoom: -4,
});
let svgRoot = null;
let svgOverlay = null;

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const statusEl = $('#status');
const opacityInp = $('#opacity');

init().catch(err => setStatus('❌ ' + err.message));

// === ЗАГРУЗКА SVG ===
async function init() {
  setStatus('Загружаю SVG…');
  const text = await fetch(SVG_URL + '?v=' + Date.now())
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .catch(e => { throw new Error(`Не удалось загрузить SVG: ${e.message}`); });

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const errNode = doc.querySelector('parsererror');
  if (errNode) throw new Error('Файл SVG повреждён.');

  svgRoot = doc.documentElement;
  const vb = svgRoot.getAttribute('viewBox');
  if (!vb) throw new Error('В SVG нет viewBox.');
  const [minX, minY, width, height] = vb.split(/\s+/).map(Number);
  const bounds = [[0, 0], [height, width]];

  svgOverlay = L.svgOverlay(svgRoot, bounds, { opacity: 0.9 }).addTo(map);
  map.fitBounds(bounds);
  setStatus(`SVG OK: ${Math.round(width)}×${Math.round(height)}`);

  prepareSvg(svgRoot);
  bindUI();
}

// === РАБОТА С SVG ===
function prepareSvg(svg) {
  const sel = LAYER_LABELS
    .map(lbl => `${groupSel(lbl)} path, ${groupSel(lbl)} polygon, ${groupSel(lbl)} rect, ${groupSel(lbl)} circle`)
    .join(', ');
  const shapes = $$(sel, svg);
  shapes.forEach(el => {
    el.classList.add('pitch');
    el.addEventListener('mouseenter', ()=>el.classList.add('hover'));
    el.addEventListener('mouseleave', ()=>el.classList.remove('hover'));
    el.addEventListener('click', (ev)=>onPitchClick(ev, el));
  });
  LAYER_LABELS.forEach(lbl => setLayerVisible(lbl, true));
}

function groupSel(label) {
  return `g[inkscape\\:label="${label}"], g#${cssEscape(label)}, g[sodipodi\\:label="${label}"]`;
}
function findGroups(label) { return $$(groupSel(label), svgRoot); }
function setLayerVisible(label, visible) { findGroups(label).forEach(g => g.classList.toggle('layer-hidden', !visible)); }
function cssEscape(s) { return s.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,'\\$1'); }

// === ОБРАБОТЧИК КЛИКА ===
function onPitchClick(ev, el) {
  el.classList.toggle('selected');
  const id = el.getAttribute('id') || '(без id)';
  setStatus(`Питч: ${id} ${el.classList.contains('selected') ? '✅ выбран' : '❎ снят'}`);
}

// === ПАНЕЛЬ УПРАВЛЕНИЯ ===
function bindUI() {
  $$('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const lbl = btn.dataset.layer;
      const isOn = btn.classList.contains('on');
      setLayerVisible(lbl, !isOn);
      btn.classList.toggle('on', !isOn);
      btn.classList.toggle('off', isOn);
    });
  });

  $('#btn-all').addEventListener('click', () => {
    LAYER_LABELS.forEach(l => setLayerVisible(l, true));
    $$('.toggle').forEach(b => b.classList.add('on'));
    $$('.toggle').forEach(b => b.classList.remove('off'));
  });

  $('#btn-none').addEventListener('click', () => {
    LAYER_LABELS.forEach(l => setLayerVisible(l, false));
    $$('.toggle').forEach(b => b.classList.remove('on'));
    $$('.toggle').forEach(b => b.classList.add('off'));
  });

  opacityInp?.addEventListener('input', () => {
    const v = Number(opacityInp.value)/100;
    if (svgOverlay) svgOverlay.setOpacity(v);
    if (svgRoot) svgRoot.style.opacity = v;
  });
}

function setStatus(t) { if (statusEl) statusEl.textContent = t; }
