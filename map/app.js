// === НАСТРОЙКИ ===
const SVG_URL = 'assets/masterplan.svg';
const LAYER_LABELS = [
  'pitches_60','pitches_80','pitches_100',
  'sanitary','admin','playground','roads','border'
];

// === КАРТА ===
const map = L.map('map', { crs: L.CRS.Simple, zoomControl: false, minZoom: -4 });
let svgRoot = null;
let svgOverlay = null;

// утилиты
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

// UI ссылки
const tooltipEl   = $('#tooltip');
const selectedLbl = $('#selected-label');
const btnCancel   = $('#cp-cancel');
const btnOk       = $('#cp-ok');

let selectedEl = null;

init().then(()=>{
  wireUI();
  renderBookingSummary();
}).catch(console.error);

// === загрузка и подготовка ===
async function init(){
  const r = await fetch(SVG_URL + '?v=' + Date.now());
  if (!r.ok) throw new Error(`SVG load error: ${r.status}`);
  const text = await r.text();

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('SVG parse error');

  svgRoot = doc.documentElement;
  const vb = svgRoot.getAttribute('viewBox');
  if (!vb) throw new Error('No viewBox in SVG');
  const [ , , w, h ] = vb.split(/\s+/).map(Number);

  const bounds = [[0,0],[h,w]];
  svgOverlay = L.svgOverlay(svgRoot, bounds, { opacity: 0.98 }).addTo(map);
  map.fitBounds(bounds);

  prepareSvg(svgRoot);
}

// === UI ===
function wireUI(){
  // zoom
  $('#zoom-in').addEventListener('click', ()=>map.zoomIn());
  $('#zoom-out').addEventListener('click', ()=>map.zoomOut());

  // back (стрелка): ?back= если есть, иначе ../index.html
  const back = new URLSearchParams(location.search).get('back') || '../index.html';
  $('#back-btn').addEventListener('click', ()=>location.href = back);

  // три основные кнопки
  $$('.toggle[data-layer]').forEach(btn=>{
    const layer = btn.dataset.layer;
    btn.addEventListener('click', ()=>{
      const on = !btn.classList.contains('on');
      setLayerVisible(layer, on);
      btn.classList.toggle('on', on);
      btn.classList.toggle('off', !on);
    });
  });

  // выпадающее меню
  const moreBtn = $('#more-btn');
  const menu = $('#layers-menu');
  moreBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    moreBtn.setAttribute('aria-expanded', String(open));
  });
  // чекбоксы слоя
  $$('#layers-menu input[type="checkbox"]').forEach(ch=>{
    ch.addEventListener('change', ()=>{
      setLayerVisible(ch.dataset.layer, ch.checked);
      // подсветим состояние на случай если те же слои есть отдельными кнопками (у нас нет — но пусть будет)
      const btn = $(`.toggle[data-layer="${CSS.escape(ch.dataset.layer)}"]`);
      if (btn) { btn.classList.toggle('on', ch.checked); btn.classList.toggle('off', !ch.checked); }
    });
  });
  // клик вне меню — закрыть
  document.addEventListener('click', (e)=>{
    if (!menu.hidden && !menu.contains(e.target) && e.target !== moreBtn) {
      menu.hidden = true;
      moreBtn.setAttribute('aria-expanded','false');
    }
  });

  // confirm bar
  btnCancel.addEventListener('click', clearSelection);
  btnOk.addEventListener('click', submitSelection);
}

// === BOOKING INFO ===
function getParams(){
  const p = {};
  for (const [k,v] of new URLSearchParams(location.search).entries()) p[k]=v;
  return p;
}
function renderBookingSummary(){
  const el = $('#booking-summary');
  const p = getParams();
  const parts = [];
  if (p.checkin || p.date_from) parts.push(`Заезд: ${p.checkin || p.date_from}`);
  if (p.checkout || p.date_to) parts.push(`Выезд: ${p.checkout || p.date_to}`);
  if (p.guests) parts.push(`Гостей: ${p.guests}`);
  if (p.adults) parts.push(`Взрослые: ${p.adults}`);
  if (p.kids || p.children) parts.push(`Дети: ${p.kids || p.children}`);
  el.textContent = parts.length ? `Даты бронирования: ${parts.join(' · ')}` : 'Даты бронирования: —';
}

// === SVG helpers ===
function ensureLayer(id, {pointerNone=false, before=null}={}){
  let g = svgRoot.querySelector('#'+CSS.escape(id));
  if(!g){
    g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('id', id);
    if (pointerNone) g.setAttribute('style','pointer-events:none');
    if (before) before.before(g); else svgRoot.appendChild(g);
  }
  return g;
}
function getSelectionLayer(){ return ensureLayer('__selection__', {pointerNone:true}); }
function getHitLayer(){ const sel = getSelectionLayer(); return ensureLayer('__hit__', {before:sel}); }

function parseStyle(styleStr=''){
  const o={}; styleStr.split(';').forEach(p=>{ const [k,v]=p.split(':').map(s=>s&&s.trim()); if(k) o[k]=v; });
  return o;
}
function isThinStrokeOrNoPaint(el){
  const st = parseStyle(el.getAttribute('style')||'');
  const fill = el.getAttribute('fill') ?? st.fill;
  const stroke = el.getAttribute('stroke') ?? st.stroke;
  const sw = (el.getAttribute('stroke-width') ?? st['stroke-width']) || '0';
  const swNum = parseFloat(String(sw));
  const noFill = !fill || fill === 'none';
  const noStroke = !stroke || stroke === 'none' || isNaN(swNum) || swNum <= 0.01;
  return noFill && noStroke;
}
function makeHitClone(el){
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  c.setAttribute('fill','none');
  c.setAttribute('stroke','#000');
  c.setAttribute('stroke-opacity','0.001');
  c.setAttribute('stroke-width','14');
  c.setAttribute('vector-effect','non-scaling-stroke');
  c.setAttribute('pointer-events','all');
  c.dataset.hit='1';
  return c;
}
function makeHighlightClone(el, color){
  const c = el.cloneNode(true);
  c.removeAttribute('id');
  if (c.tagName !== 'use') c.setAttribute('fill','none');
  c.setAttribute('stroke', color);
  c.setAttribute('stroke-width','4');
  c.setAttribute('stroke-opacity','1');
  c.setAttribute('vector-effect','non-scaling-stroke');
  c.setAttribute('pointer-events','none');
  return c;
}
function getReadableLabel(el){
  const id = el.getAttribute('id') || '';
  const dataName = el.dataset.name || '';
  const parent = el.closest('g');
  const parentLabel = parent && (parent.getAttribute('inkscape:label') || parent.getAttribute('sodipodi:label') || parent.id || '') || '';
  const name = dataName || id || parentLabel || 'объект';
  const m = (id||'').match(/(\d+)(?!.*\d)/);
  const num = m ? m[1] : '';
  return num ? `${name} №${num}` : name;
}

// === подготовка интерактива (Pointer Events для тача/мыши) ===
function prepareSvg(svg){
  const selLayer = getSelectionLayer();
  const hitLayer = getHitLayer();

  const allGroups = Array.from(svg.querySelectorAll('g'));
  const groups = allGroups.filter(g=>{
    const lab = (g.getAttribute('inkscape:label')||g.getAttribute('sodipodi:label')||g.id||'').toLowerCase();
    return LAYER_LABELS.some(layer => lab === layer || lab.startsWith(layer+' ') || lab.startsWith(layer+'_') || lab.startsWith(layer+'-'));
  });

  const SHAPES = 'path,rect,polygon,polyline,circle,ellipse,use';
  const shapes = groups.flatMap(g=>{
    const layerName = (g.getAttribute('inkscape:label')||g.getAttribute('sodipodi:label')||g.id||'');
    return Array.from(g.querySelectorAll(SHAPES)).map(el => (el.dataset.layer=layerName, el));
  });

  shapes.forEach(el=>{
    el.style.pointerEvents='all';
    el.style.cursor='pointer';

    let hit = null;
    if (isThinStrokeOrNoPaint(el)){
      hit = makeHitClone(el);
      hit.dataset.layer = el.dataset.layer;
      hitLayer.appendChild(hit);
    }
    const target = hit || el;

    // защита от «перетаскивания» — не выбираем, если смещение > 6px
    let downPos = null;

    target.addEventListener('pointerdown', (ev)=>{
      downPos = {x: ev.clientX, y: ev.clientY, type: ev.pointerType};
    });

    // hover — только мышь
    target.addEventListener('pointerenter', (ev)=>{
      if (ev.pointerType !== 'mouse') return;
      if (el.dataset.sel==='1') return;
      const hov = makeHighlightClone(el, '#ff9aa0'); // светло-красный
      hov.id='__hover__';
      selLayer.appendChild(hov);
    });
    target.addEventListener('pointerleave', (ev)=>{
      if (ev.pointerType !== 'mouse') return;
      const prev = selLayer.querySelector('#__hover__');
      if (prev) prev.remove();
      tooltipEl.hidden = true;
    });

    // tooltip — только мышь
    target.addEventListener('pointermove', (ev)=>{
      if (ev.pointerType !== 'mouse') return;
      tooltipEl.textContent = getReadableLabel(el);
      tooltipEl.style.left = (ev.clientX + 12) + 'px';
      tooltipEl.style.top  = (ev.clientY + 12) + 'px';
      tooltipEl.hidden = false;
    });

    // выбор — pointerup (и мышь, и тач)
    target.addEventListener('pointerup', (ev)=>{
      // если перетаскивали — игнор
      if (downPos) {
        const dx = Math.abs(ev.clientX - downPos.x);
        const dy = Math.abs(ev.clientY - downPos.y);
        if (dx > 6 || dy > 6) return;
      }

      const nowSelected = el.dataset.sel === '1';
      const turnOn = !nowSelected;
      el.dataset.sel = turnOn ? '1' : '0';

      // снять прежнюю рамку
      if (el.dataset.selCloneId){
        const old = document.getElementById(el.dataset.selCloneId);
        if (old) old.remove();
        delete el.dataset.selCloneId;
      }

      if (turnOn){
        const sel = makeHighlightClone(el, '#ff3b30'); // красный
        const cid = '__sel__'+Math.random().toString(36).slice(2);
        sel.id = cid;
        selLayer.appendChild(sel);
        el.dataset.selCloneId = cid;

        selectedEl = el;
        selectedLbl.textContent = getReadableLabel(el);
        btnOk.disabled = btnCancel.disabled = false;
      } else {
        clearSelection();
      }
    });
  });
}

// показать/скрыть слои
function setLayerVisible(label, visible){
  const esc = CSS.escape(label);
  $$(`[data-layer="${esc}"]`, svgRoot).forEach(el=>{
    if (el.dataset.hit === '1') el.style.display = visible ? '' : 'none';
    else el.classList.toggle('layer-hidden', !visible);
  });
  $$(`[data-layer="${esc}"]`, getHitLayer()).forEach(el=>{
    el.style.display = visible ? '' : 'none';
  });
}

// очистка выбора
function clearSelection(){
  tooltipEl.hidden = true;
  if (!selectedEl){ selectedLbl.textContent = '—'; btnOk.disabled = btnCancel.disabled = true; return; }
  selectedEl.dataset.sel='0';
  if (selectedEl.dataset.selCloneId){
    const old = document.getElementById(selectedEl.dataset.selCloneId);
    if (old) old.remove();
    delete selectedEl.dataset.selCloneId;
  }
  selectedEl = null;
  selectedLbl.textContent = '—';
  btnOk.disabled = btnCancel.disabled = true;
}

// подтверждение
function submitSelection(){
  if (!selectedEl) return;
  const payload = {
    type: 'pitch_selection',
    id: selectedEl.id || null,
    name: getReadableLabel(selectedEl),
    layer: selectedEl.dataset.layer || null,
    params: getParams()
  };

  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg && typeof tg.sendData === 'function'){
    tg.HapticFeedback?.impactOccurred?.('light');
    tg.sendData(JSON.stringify(payload));
    tg.close?.();
  } else {
    alert('Выбор отправлен: ' + JSON.stringify(payload, null, 2));
    const back = new URLSearchParams(location.search).get('back');
    if (back) location.href = back;
  }
}
