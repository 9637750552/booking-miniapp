const PITCH_LAYERS = ['pitches_60', 'pitches_80', 'pitches_100'];

const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// === SVG helpers ===
function ensureLayer(svgRoot, id, { pointerNone = false, before = null } = {}) {
  let g = svgRoot.querySelector('#' + CSS.escape(id));
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', id);
    if (pointerNone) g.setAttribute('style', 'pointer-events:none');
    if (before) before.before(g); else svgRoot.appendChild(g);
  }
  return g;
}
function getSelectionLayer(svgRoot) { return ensureLayer(svgRoot, '__selection__', { pointerNone: true }); }
function parseStyle(styleStr = '') { const o = {}; styleStr.split(';').forEach(p => { const [k, v] = p.split(':').map(s => s && s.trim()); if (k) o[k] = v; }); return o; }
function isThinStrokeOrNoPaint(el) {
  const st = parseStyle(el.getAttribute('style') || '');
  const fill = el.getAttribute('fill') ?? st.fill;
  const stroke = el.getAttribute('stroke') ?? st.stroke;
  const sw = (el.getAttribute('stroke-width') ?? st['stroke-width']) || '0';
  const swNum = parseFloat(String(sw));
  const noFill = !fill || fill === 'none';
  const noStroke = !stroke || stroke === 'none' || isNaN(swNum) || swNum <= 0.01;
  return noFill && noStroke;
}
function makeHitClone(el) {
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  c.setAttribute('fill', 'none');
  c.setAttribute('stroke', '#000');
  c.setAttribute('stroke-opacity', '0.001');
  c.setAttribute('stroke-width', '14');
  c.setAttribute('vector-effect', 'non-scaling-stroke');
  c.setAttribute('pointer-events', 'all');
  c.dataset.hit = '1';
  return c;
}
function makeHighlightClone(el, color) {
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  if (c.tagName !== 'use') c.setAttribute('fill', 'none');
  c.setAttribute('stroke', color);
  c.setAttribute('stroke-width', '4');
  c.setAttribute('stroke-opacity', '1');
  c.setAttribute('vector-effect', 'non-scaling-stroke');
  c.setAttribute('pointer-events', 'none');
  return c;
}
export function getReadableLabel(el) {
  const id = el.getAttribute('id') || '';
  const dataName = el.dataset.name || '';
  const parent = el.closest('g');
  const parentLabel = parent && (parent.getAttribute('inkscape:label') || parent.getAttribute('sodipodi:label') || parent.id || '') || '';
  const name = dataName || id || parentLabel || 'Участок';
  const m = (id || '').match(/(\d+)(?!.*\d)/);
  const num = m ? m[1] : '';
  return num ? `${name} №${num}` : name;
}

// Подготовка интерактива
export function prepareSvg(svgRoot, selectionState) {
  const selLayer = getSelectionLayer(svgRoot);

  const groups = Array.from(svgRoot.querySelectorAll('g')).filter(g => {
    const lab = (g.getAttribute('inkscape:label') || g.getAttribute('sodipodi:label') || g.id || '').toLowerCase();
    return PITCH_LAYERS.some(layer => lab === layer || lab.startsWith(layer + ' ') || lab.startsWith(layer + '_') || lab.startsWith(layer + '-'));
  });

  const SHAPES = 'path,rect,polygon,polyline,circle,ellipse,use';
  const shapes = groups.flatMap(g => {
    const layerName = (g.getAttribute('inkscape:label') || g.getAttribute('sodipodi:label') || g.id || '');
    return Array.from(g.querySelectorAll(SHAPES)).map(el => (el.dataset.layer = layerName, el));
  });

  let hitRoot = svgRoot.querySelector('#__hit__');
  if (!hitRoot) {
    hitRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hitRoot.id = '__hit__';
    getSelectionLayer(svgRoot).before(hitRoot);
  }

  shapes.forEach(el => {
    el.style.pointerEvents = 'all';
    el.style.cursor = 'pointer';

    let target = el;
    if (isThinStrokeOrNoPaint(el)) {
      const hit = makeHitClone(el);
      hit.dataset.layer = el.dataset.layer;
      hitRoot.appendChild(hit);
      target = hit;
    }

    let downPos = null;
    target.addEventListener('pointerdown', ev => {
      downPos = { x: ev.clientX ?? 0, y: ev.clientY ?? 0 };
    }, { passive: true });

    target.addEventListener('pointerup', ev => {
      let isClick = true;
      if (downPos) {
        const dx = Math.abs((ev.clientX ?? 0) - downPos.x);
        const dy = Math.abs((ev.clientY ?? 0) - downPos.y);
        if (dx > 6 || dy > 6) isClick = false;
      }
      downPos = null;
      if (!isClick) return;

      ev.stopPropagation();
      ev.preventDefault();

      if (selectionState.getSelectedEl() === el) { selectionState.clearSelection(); return; }
      if (selectionState.getSelectedEl()) selectionState.clearSelection();

      el.dataset.sel = '1';
      const sel = makeHighlightClone(el, '#ff3b30');
      const cid = '__sel__' + Math.random().toString(36).slice(2);
      sel.id = cid;
      selLayer.appendChild(sel);
      el.dataset.selCloneId = cid;

      selectionState.setSelected(el, getReadableLabel(el));
    });

    target.addEventListener('pointercancel', () => { downPos = null; });
  });
}

export function setLayerVisible(svgRoot, label, visible) {
  const esc = CSS.escape(label);
  $$(`[data-layer="${esc}"]`, svgRoot).forEach(el => {
    if (el.dataset.hit === '1') el.style.display = visible ? '' : 'none';
    else el.classList.toggle('layer-hidden', !visible);
  });
  const hitRoot = svgRoot.querySelector('#__hit__');
  if (hitRoot) {
    $$(`[data-layer="${esc}"]`, hitRoot).forEach(el => {
      el.style.display = visible ? '' : 'none';
    });
  }
}
