// === НАСТРОЙКИ ===
const SVG_URL = 'assets/masterplan.svg';

const LAYER_LABELS = [
  'pitches_60', 'pitches_80', 'pitches_100',
  'sanitary', 'admin', 'playground', 'roads', 'border'
];

// === СОЗДАНИЕ КАРТЫ ===
const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: true,
  minZoom: -4,
});

let svgRoot = null;
let svgOverlay = null;
let svgContainer = null;

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
  const errNode = doc.querySelector('parsererror');
  if (errNode) throw new Error('Файл SVG повреждён.');

  svgRoot = doc.documentElement;
  const vb = svgRoot.getAttribute('viewBox');
  if (!vb) throw new Error('В SVG нет viewBox.');
  const [, , width, height] = vb.split(/\s+/).map(Number);
  const bounds = [[0, 0], [height, width]];

  svgOverlay = L.svgOverlay(svgRoot, bounds, { 
    opacity: 0.9,
    interactive: true
  }).addTo(map);
  
  map.fitBounds(bounds);
  setStatus(`SVG OK: ${Math.round(width)}×${Math.round(height)}`);

  // Ждём пока Leaflet отрендерит SVG
  setTimeout(() => {
    // Находим SVG в DOM после того как Leaflet его добавил
    svgContainer = document.querySelector('.leaflet-overlay-pane svg');
    if (svgContainer) {
      console.log('SVG найден в DOM');
      prepareSvg(svgContainer);
      bindUI();
    } else {
      console.error('SVG не найден в DOM!');
    }
  }, 100);
}

// === СЛОЙ ПОДСВЕТКИ ===
function getSelectionLayer(svg) {
  let layer = svg.querySelector('#__pitch_selection_layer__');
  if (!layer) {
    layer = document.createElementNS('http://www.w3.org/2000/svg','g');
    layer.setAttribute('id','__pitch_selection_layer__');
    layer.style.pointerEvents = 'none';
    
    // ВАЖНО: добавляем стили для видимости поверх всего
    layer.style.isolation = 'isolate';
    layer.style.mixBlendMode = 'normal';
    
    svg.appendChild(layer);
  }
  return layer;
}

function makeHighlightClone(el, strokeColor='#ff9800') {
  const clone = el.cloneNode(true);
  clone.removeAttribute('id');
  
  // Убираем fill, делаем только обводку
  clone.setAttribute('fill', 'none');
  clone.setAttribute('fill-opacity', '0');
  
  // Толстая яркая обводка
  clone.setAttribute('stroke', strokeColor);
  clone.setAttribute('stroke-width', '8');
  clone.setAttribute('stroke-opacity', '1');
  clone.setAttribute('stroke-linejoin', 'round');
  clone.setAttribute('stroke-linecap', 'round');
  
  // Отключаем масштабирование обводки
  clone.setAttribute('vector-effect', 'non-scaling-stroke');
  clone.style.pointerEvents = 'none';
  
  return clone;
}

// === РАБОТА С SVG ===
function prepareSvg(svg) {
  const groups = LAYER_LABELS.flatMap(lbl => findGroups(lbl, svg));
  const SHAPE_SELECTOR = 'path,rect,polygon,polyline,circle,ellipse';
  
  const shapes = groups.flatMap(g => {
    const layerName = getGroupLabel(g);
    return Array.from(g.querySelectorAll(SHAPE_SELECTOR)).map(el => {
      el.dataset.layer = layerName || '';
      return el;
    });
  });

  // Если shapes пустой, пробуем найти все фигуры напрямую
  if (shapes.length === 0) {
    console.warn('Не найдены фигуры через группы, ищу все фигуры...');
    const allShapes = Array.from(svg.querySelectorAll(SHAPE_SELECTOR));
    allShapes.forEach(el => {
      const parent = el.closest('g');
      el.dataset.layer = parent ? getGroupLabel(parent) : '';
      shapes.push(el);
    });
  }

  const selectionLayer = getSelectionLayer(svg);
  let count = 0;

  shapes.forEach(el => {
    // КРИТИЧНО: отключаем все стили которые могут блокировать события
    el.style.pointerEvents = 'all';
    el.style.cursor = 'pointer';
    el.classList.add('pitch');
    
    // Добавляем атрибут напрямую
    el.setAttribute('pointer-events', 'all');

    // Удаляем старые обработчики если есть
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);
    
    // hover - используем обычные события DOM
    newEl.onmouseenter = function() {
      if (this.dataset.sel === '1') return;
      const existing = selectionLayer.querySelector('#__hover__');
      if (existing) existing.remove();
      
      const hoverClone = makeHighlightClone(this, '#00bcd4'); // яркий голубой
      hoverClone.setAttribute('id','__hover__');
      selectionLayer.appendChild(hoverClone);
      console.log('Hover:', this.id || 'no-id');
    };

    newEl.onmouseleave = function() {
      const prev = selectionLayer.querySelector('#__hover__');
      if (prev) prev.remove();
    };

    // click
    newEl.onclick = function(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      
      console.log('КЛИК!', this.id || 'no-id');
      
      const on = this.dataset.sel !== '1';
      this.dataset.sel = on ? '1' : '0';

      // Удаляем старую подсветку
      const oldId = this.dataset.selCloneId;
      if (oldId) {
        const old = selectionLayer.querySelector('#' + oldId);
        if (old) old.remove();
        delete this.dataset.selCloneId;
      }

      // Добавляем новую если нужно
      if (on) {
        const clone = makeHighlightClone(this, '#ff9800');
        const cid = '__sel__' + Math.random().toString(36).slice(2);
        clone.setAttribute('id', cid);
        selectionLayer.appendChild(clone);
        this.dataset.selCloneId = cid;
      }

      const id = this.getAttribute('id') || '(без id)';
      const layer = this.dataset.layer || '(без слоя)';
      setStatus(`Объект: ${id} | слой: ${layer} — ${on ? 'выбран ✓' : 'снят'}`);
    };

    count++;
  });

  setStatus(`SVG загружен | кликабельных объектов: ${count}`);
  console.log('Подготовлено объектов:', count);
}

// === ПАНЕЛЬ УПРАВЛЕНИЯ ===
function bindUI() {
  // переключатели слоёв
  $$('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const lbl = btn.dataset.layer;
      const isOn = btn.classList.contains('on');
      const newState = !isOn;
      
      setLayerVisible(lbl, newState);
      btn.classList.toggle('on', newState);
      btn.classList.toggle('off', !newState);
      
      setStatus(`Слой "${lbl}": ${newState ? 'показан' : 'скрыт'}`);
    });
  });

  // показать все
  $('#btn-all')?.addEventListener('click', () => {
    LAYER_LABELS.forEach(l => setLayerVisible(l, true));
    $$('.toggle').forEach(b => { 
      b.classList.add('on'); 
      b.classList.remove('off'); 
    });
    setStatus('Все слои показаны');
  });

  // скрыть все
  $('#btn-none')?.addEventListener('click', () => {
    LAYER_LABELS.forEach(l => setLayerVisible(l, false));
    $$('.toggle').forEach(b => { 
      b.classList.remove('on'); 
      b.classList.add('off'); 
    });
    setStatus('Все слои скрыты');
  });

  // прозрачность
  opacityInp?.addEventListener('input', () => {
    const v = Number(opacityInp.value)/100;
    if (svgOverlay) svgOverlay.setOpacity(v);
  });
}

// === ВСПОМОГАТЕЛЬНЫЕ ===
function getGroupLabel(g) {
  return g.getAttribute('inkscape:label') || 
         g.getAttribute('data-name') ||
         g.getAttribute('id') || 
         '';
}

function groupSel(label) {
  const escaped = cssEscape(label);
  return [
    `g[inkscape\\:label="${label}"]`,
    `g#${escaped}`,
    `g[data-name="${label}"]`,
    `g[id*="${label}"]`
  ].join(',');
}

function findGroups(label, root = null) { 
  const searchRoot = root || svgContainer || document;
  const groups = $$(groupSel(label), searchRoot);
  if (groups.length === 0) {
    const allGroups = $$('g', searchRoot);
    return allGroups.filter(g => {
      const gLabel = getGroupLabel(g).toLowerCase();
      return gLabel.includes(label.toLowerCase());
    });
  }
  return groups;
}

function setLayerVisible(label, visible) { 
  const groups = findGroups(label);
  console.log(`Слой "${label}": найдено групп ${groups.length}, visible=${visible}`);
  
  groups.forEach(g => {
    if (visible) {
      g.style.display = '';
      g.classList.remove('layer-hidden');
    } else {
      g.style.display = 'none';
      g.classList.add('layer-hidden');
    }
  });
}

function cssEscape(s) { 
  return s.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,'\\$1'); 
}

function setStatus(t) { 
  if (statusEl) statusEl.textContent = t; 
  console.log('Status:', t);
}