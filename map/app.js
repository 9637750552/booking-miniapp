// === НАСТРОЙКИ ===
const SVG_URL = 'assets/masterplan.svg'; // единственный путь к карте
const LAYER_LABELS = [
  'pitches_60','pitches_80','pitches_100',
  'sanitary','admin','playground','roads','border'
];

// === СОЗДАНИЕ КАРТЫ ===
const map = L.map('map', { crs: L.CRS.Simple, zoomControl: true, minZoom: -4 });

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
  const r = await fetch(SVG_URL + '?v=' + Date.now());
  if (!r.ok) throw new Error(`Не удалось загрузить ${SVG_URL}: HTTP ${r.status}`);
  const text = await r.text();

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Файл SVG повреждён.');

  svgRoot = doc.documentElement;

  const vb = (svgRoot.getAttribute('viewBox')||'').split(/\s+/).map(Number);
  if (vb.length < 4) throw new Error('В SVG нет корректного viewBox.');
  const [, , width, height] = vb;
  const bounds = [[0,0],[height,width]];

  svgOverlay = L.svgOverlay(svgRoot, bounds, { opacity: 0.9 }).addTo(map);
  map.fitBounds(bounds);

  prepareSvg(svgRoot);
  bindUI();

  setStatus(`SVG OK: ${Math.round(width)}×${Math.round(height)}`);
}

// === СЛОИ ДЛЯ ПОДСВЕТКИ И HIT-AREAS ===
function ensureLayer(id, {pointerNone=false, before=null}={}) {
  let g = svgRoot.querySelector('#'+CSS.escape(id));
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('id', id);
    if (pointerNone) g.setAttribute('style','pointer-events:none');
    if (before) before.before(g); else svgRoot.appendChild(g);
  }
  return g;
}
function getSelectionLayer() {
  // слой подсветки поверх всего и без событий
  return ensureLayer('__selection__', {pointerNone:true});
}
function getHitLayer() {
  // слой hit-клонов должен быть ПОД selection, чтобы подсветка рисовалась сверху
  const sel = getSelectionLayer();
  return ensureLayer('__hit__', {pointerNone:false, before: sel});
}

// === УТИЛИТЫ ===
function parseStyle(styleStr='') {
  const out = {};
  styleStr.split(';').forEach(p=>{
    const [k,v] = p.split(':').map(s=>s&&s.trim());
    if (k) out[k]=v;
  });
  return out;
}
function isThinStrokeOrNoPaint(el) {
  const st = parseStyle(el.getAttribute('style')||'');
  const fill = el.getAttribute('fill') ?? st.fill;
  const stroke = el.getAttribute('stroke') ?? st.stroke;
  const sw = (el.getAttribute('stroke-width') ?? st['stroke-width']) || '0';
  const swNum = parseFloat(String(sw));
  const noFill = !fill || fill === 'none';
  const noStroke = !stroke || stroke === 'none' || isNaN(swNum) || swNum <= 0.01;
  // «тонкий» контур — когда нет заливки и нет заметного штриха
  return noFill && noStroke;
}
function makeHitClone(el) {
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  // невидимая «толстая» обводка для удобного попадания мышью
  c.setAttribute('fill', 'none');
  c.setAttribute('stroke', '#000');
  c.setAttribute('stroke-opacity', '0.001'); // практически невидимая
  c.setAttribute('stroke-width', '12');
  c.setAttribute('vector-effect', 'non-scaling-stroke');
  c.setAttribute('pointer-events', 'all');   // ловим события независимо от покраски
  c.dataset.hit = '1';
  return c;
}
function makeHighlightClone(el, strokeColor='#ff9800') {
  const clone = el.cloneNode(true);
  clone.removeAttribute('id');
  // подсветка — только штрихом, чтобы не перекрывать заливки
  if (clone.tagName !== 'use') clone.setAttribute('fill','none');
  clone.setAttribute('stroke', strokeColor);
  clone.setAttribute('stroke-width', '4');
  clone.setAttribute('stroke-opacity', '1');
  clone.setAttribute('vector-effect', 'non-scaling-stroke');
  clone.setAttribute('pointer-events', 'none'); // подсветка не перехватывает курсор
  return clone;
}
function getGroupLabel(g) {
  return g.getAttribute('inkscape:label') ||
         g.getAttribute('sodipodi:label') ||
         g.id || '';
}

// === ПОДГОТОВКА SVG: ПРИВЯЗКА СОБЫТИЙ ===
function prepareSvg(svg) {
  const selLayer = getSelectionLayer();
  const hitLayer = getHitLayer();

  // 1) собираем целевые группы без namespace-селекторов
  const groups = Array.from(svg.querySelectorAll('g')).filter(g => {
    const lab = getGroupLabel(g);
    return LAYER_LABELS.includes(lab);
  });

  // 2) собираем интерактивные фигуры
  const SHAPE_SELECTOR = 'path,rect,polygon,polyline,circle,ellipse,use';
  const shapes = groups.flatMap(g => {
    const layerName = getGroupLabel(g);
    return Array.from(g.querySelectorAll(SHAPE_SELECTOR)).map(el => {
      el.dataset.layer = layerName;
      return el;
    });
  });

  let attached = 0;

  shapes.forEach(el => {
    // оригинал тоже оставим доступным
    el.style.pointerEvents = 'all';
    el.style.cursor = 'pointer';
    el.classList.add('pitch');

    // если фигура «тонкая» — добавим невидимую hit-area
    let hit = null;
    if (isThinStrokeOrNoPaint(el)) {
      hit = makeHitClone(el);
      hit.dataset.layer = el.dataset.layer;
      hitLayer.appendChild(hit);
    }

    const target = hit || el; // вешаем события туда, куда проще попасть

    // hover
    target.addEventListener('mouseenter', () => {
      if (el.dataset.sel === '1') return;
      const hoverClone = makeHighlightClone(el, '#ffb74d');
      hoverClone.setAttribute('id','__hover__');
      selLayer.appendChild(hoverClone);
      svgRoot.style.cursor = 'pointer';
    }, { passive: true });

    target.addEventListener('mouseleave', () => {
      const prev = selLayer.querySelector('#__hover__');
      if (prev) prev.remove();
      svgRoot.style.cursor = 'default';
    }, { passive: true });

    // click
    target.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const turnOn = el.dataset.sel !== '1';
      el.dataset.sel = turnOn ? '1' : '0';

      // убрать старую постоянную подсветку
      const oldId = el.dataset.selCloneId;
      if (oldId) {
        const old = document.getElementById(oldId);
        if (old) old.remove();
        delete el.dataset.selCloneId;
      }

      if (turnOn) {
        const clone = makeHighlightClone(el, '#ff9800');
        const cid = '__sel__' + Math.random().toString(36).slice(2);
        clone.setAttribute('id', cid);
        selLayer.appendChild(clone);
        el.dataset.selCloneId = cid;
      }

      const id = el.getAttribute('id') || '(без id)';
      const layer = el.dataset.layer || '(без слоя)';
      setStatus(`Объект: ${id} | слой: ${layer} — ${turnOn ? 'выбран' : 'снят'}`);
    });

    attached++;
  });

  setStatus(`${statusEl.textContent} | кликабельно: ${attached}`);
}

// === ПАНЕЛЬ УПРАВЛЕНИЯ ===
function bindUI() {
  // переключатели слоёв
  $$('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const lbl = btn.dataset.layer;
      const isOn = btn.classList.contains('on');
      setLayerVisible(lbl, !isOn);
      btn.classList.toggle('on', !isOn);
      btn.classList.toggle('off', isOn);
    });
  });

  $('#btn-all')?.addEventListener('click', () => {
    LAYER_LABELS.forEach(l => setLayerVisible(l, true));
    $$('.toggle').forEach(b => { b.classList.add('on'); b.classList.remove('off'); });
  });

  $('#btn-none')?.addEventListener('click', () => {
    LAYER_LABELS.forEach(l => setLayerVisible(l, false));
    $$('.toggle').forEach(b => { b.classList.remove('on'); b.classList.add('off'); });
  });

  // прозрачность
  opacityInp?.addEventListener('input', () => {
    const v = Number(opacityInp.value)/100;
    if (svgOverlay) svgOverlay.setOpacity(v);
    if (svgRoot) svgRoot.style.opacity = v;
  });
}

// === ПОКАЗ/СКРЫТИЕ СЛОЁВ (оригиналы + hit-клоны) ===
function setLayerVisible(label, visible) {
  // скрываем/показываем и исходные элементы слоя, и их hit-клоны
  const sel = (root) => Array.from(root.querySelectorAll('[data-layer="'+CSS.escape(label)+'"]'));
  [...sel(svgRoot), ...sel(getHitLayer())].forEach(el => {
    // на hit-клонах нет класса layer-hidden, поэтому просто style.display
    if (el.dataset.hit === '1') {
      el.style.display = visible ? '' : 'none';
    } else {
      el.classList.toggle('layer-hidden', !visible);
    }
  });
}

// === СТАТУС ===
function setStatus(t) { if (statusEl) statusEl.textContent = t; }
