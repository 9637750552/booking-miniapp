// === КОНСТАНТЫ ===
const SVG_URL = 'assets/masterplan.svg';
const LAYER_LABELS = [
  'pitches_60','pitches_80','pitches_100',
  'sanitary','admin','playground','roads','border'
];

const map = L.map('map', { crs: L.CRS.Simple, zoomControl: true, minZoom: -4 });
let svgRoot = null;
let svgOverlay = null;

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const statusEl = $('#status');
const opacityInp = $('#opacity');
const tooltipEl = $('#tooltip');
const cpEl = $('#confirm-panel');
const cpNameEl = $('#cp-name');
let selectedEl = null; // последний выбранный объект

// === ИНИЦИАЛИЗАЦИЯ ===
init().catch(err => setStatus('❌ ' + err.message));
renderParamsSummary();

async function init() {
  setStatus('Загружаю SVG…');
  const r = await fetch(SVG_URL + '?v=' + Date.now());
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('SVG повреждён');

  svgRoot = doc.documentElement;
  const vb = svgRoot.getAttribute('viewBox');
  if (!vb) throw new Error('Нет viewBox');
  const [, , width, height] = vb.split(/\s+/).map(Number);
  const bounds = [[0,0],[height,width]];

  svgOverlay = L.svgOverlay(svgRoot, bounds, { opacity: 0.9 }).addTo(map);
  map.fitBounds(bounds);

  prepareSvg(svgRoot);
  bindUI();

  setStatus(`SVG OK: ${Math.round(width)}×${Math.round(height)}`);
}

// === ПОМОЩЬ ===
function setStatus(t){ if (statusEl) statusEl.innerHTML = t; }
function getLabelFrom(el){
  const id = el.getAttribute('id') || '';
  const dataName = el.dataset.name || '';
  const parent = el.closest('g');
  const parentLabel = parent && (
    parent.getAttribute('inkscape:label') ||
    parent.getAttribute('sodipodi:label') ||
    parent.id || ''
  ) || '';
  const name = dataName || id || parentLabel || 'объект';
  const m = (id||'').match(/(\d+)(?!.*\d)/);
  const num = m ? m[1] : '';
  return { name, num, id };
}
function showTooltip(text, x, y){
  tooltipEl.textContent = text;
  tooltipEl.style.left = x + 'px';
  tooltipEl.style.top = y + 'px';
  tooltipEl.hidden = false;
}
function hideTooltip(){ tooltipEl.hidden = true; }
function showConfirm(name){ cpNameEl.textContent = name; cpEl.hidden = false; }
function hideConfirm(){ cpEl.hidden = true; }

// === ВСПОМОГАТЕЛЬНЫЕ ДЛЯ SVG ===
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
  c.setAttribute('stroke-width','12');
  c.setAttribute('vector-effect','non-scaling-stroke');
  c.setAttribute('pointer-events','all');
  c.dataset.hit='1';
  return c;
}
function makeHighlightClone(el, color='#ff9800'){
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

// === ПОДГОТОВКА SVG ===
function prepareSvg(svg){
  const selLayer = getSelectionLayer();
  const hitLayer = getHitLayer();

  // найти слои по именам (расширенно)
  const allGroups = Array.from(svg.querySelectorAll('g'));
  const groups = allGroups.filter(g=>{
    const lab = (g.getAttribute('inkscape:label')||g.getAttribute('sodipodi:label')||g.id||'').toLowerCase();
    return LAYER_LABELS.some(layer => lab === layer || lab.startsWith(layer+' ') || lab.startsWith(layer+'_') || lab.startsWith(layer+'-'));
  });

  const SHAPE_SEL = 'path,rect,polygon,polyline,circle,ellipse,use';
  const shapes = groups.flatMap(g=>{
    const layerName = (g.getAttribute('inkscape:label')||g.getAttribute('sodipodi:label')||g.id||'');
    return Array.from(g.querySelectorAll(SHAPE_SEL)).map(el => (el.dataset.layer=layerName, el));
  });

  let attached = 0;
  shapes.forEach(el=>{
    el.style.pointerEvents='all';
    el.style.cursor='pointer';
    el.classList.add('pitch');

    // hit-area
    let hit=null;
    if (isThinStrokeOrNoPaint(el)){
      hit = makeHitClone(el);
      hit.dataset.layer = el.dataset.layer;
      hitLayer.appendChild(hit);
    }
    const target = hit || el;

    // tooltip по ховеру
    target.addEventListener('mousemove', (ev)=>{
      const {name, num} = getLabelFrom(el);
      const label = num ? `${name} №${num}` : name;
      showTooltip(label, ev.clientX+12, ev.clientY+12);
    });
    target.addEventListener('mouseleave', hideTooltip);

    // hover highlight
    target.addEventListener('mouseenter', ()=>{
      if (el.dataset.sel==='1') return;
      const hov = makeHighlightClone(el, '#ffb74d');
      hov.id='__hover__';
      getSelectionLayer().appendChild(hov);
    });
    target.addEventListener('mouseleave', ()=>{
      const prev = getSelectionLayer().querySelector('#__hover__');
      if (prev) prev.remove();
    });

    // click select
    target.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const on = el.dataset.sel !== '1';
      el.dataset.sel = on ? '1' : '0';

      // убрать старую подсветку
      if (el.dataset.selCloneId){
        const old = document.getElementById(el.dataset.selCloneId);
        if (old) old.remove();
        delete el.dataset.selCloneId;
      }

      if (on){
        const sel = makeHighlightClone(el, '#ff9800');
        const cid = '__sel__'+Math.random().toString(36).slice(2);
        sel.id = cid;
        getSelectionLayer().appendChild(sel);
        el.dataset.selCloneId = cid;

        selectedEl = el;
        const {name, num, id} = getLabelFrom(el);
        const label = num ? `${name} №${num}` : (name || id);

        showConfirm(label);
        setStatus(`<b>Объект:</b> ${label}<br><b>Слой:</b> ${el.dataset.layer} — выбран`);
      } else {
        selectedEl = null;
        hideConfirm();
        setStatus(`<b>Объект:</b> —<br><b>Слой:</b> ${el.dataset.layer} — снят`);
      }
    });

    attached++;
  });

  setStatus(`${statusEl.innerHTML} <br><b>Кликабельно:</b> ${attached}`);
}

// === UI КНОПКИ ===
function bindUI(){
  $$('.toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const lbl = btn.dataset.layer;
      const isOn = btn.classList.contains('on');
      setLayerVisible(lbl, !isOn);
      btn.classList.toggle('on', !isOn);
      btn.classList.toggle('off', isOn);
    });
  });

  $('#btn-all')?.addEventListener('click', ()=>{
    LAYER_LABELS.forEach(l => setLayerVisible(l, true));
    $$('.toggle').forEach(b=>{ b.classList.add('on'); b.classList.remove('off'); });
  });

  $('#btn-none')?.addEventListener('click', ()=>{
    LAYER_LABELS.forEach(l => setLayerVisible(l, false));
    $$('.toggle').forEach(b=>{ b.classList.remove('on'); b.classList.add('off'); });
  });

  opacityInp?.addEventListener('input', ()=>{
    const v = Number(opacityInp.value)/100;
    if (svgOverlay) svgOverlay.setOpacity(v);
    if (svgRoot) svgRoot.style.opacity = v;
  });

  // Панель подтверждения
  $('#cp-cancel')?.addEventListener('click', ()=>{
    hideConfirm();
    if (selectedEl){
      selectedEl.dataset.sel='0';
      if (selectedEl.dataset.selCloneId){
        const old = document.getElementById(selectedEl.dataset.selCloneId);
        if (old) old.remove();
        delete selectedEl.dataset.selCloneId;
      }
      selectedEl=null;
    }
  });

  $('#cp-ok')?.addEventListener('click', ()=>{
    if (!selectedEl) return;
    const {name, num, id} = getLabelFrom(selectedEl);
    const payload = {
      type: 'pitch_selection',
      id, name, number: num || null,
      params: getAllParams()
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
  });
}

// === ПОКАЗ/СКРЫТИЕ СЛОЁВ ===
function setLayerVisible(label, visible){
  const esc = CSS.escape(label);
  $$( `[data-layer="${esc}"]`, svgRoot ).forEach(el=>{
    if (el.dataset.hit === '1'){ el.style.display = visible ? '' : 'none'; }
    else { el.classList.toggle('layer-hidden', !visible); }
  });
  $$( `[data-layer="${esc}"]`, getHitLayer() ).forEach(el=>{
    el.style.display = visible ? '' : 'none';
  });
}

// === ПАРАМЕТРЫ БРОНИРОВАНИЯ ИЗ URL ===
function getAllParams(){
  const sp = new URLSearchParams(location.search);
  const res = {};
  for (const [k,v] of sp.entries()) res[k]=v;
  return res;
}
function humanizeKey(k){
  const map = {
    checkin:'Заезд', checkout:'Выезд',
    date_from:'Заезд', date_to:'Выезд',
    adults:'Взрослые', kids:'Дети', children:'Дети',
    nights:'Ночей', guests:'Гостей',
    power:'Электричество', water:'Вода', car:'Авто', rv:'Кемпер', tent:'Палатка',
    type:'Тип места', size:'Размер'
  };
  return map[k] || k;
}
function renderParamsSummary(){
  const el = $('#params');
  const p = getAllParams();
  const keys = Object.keys(p);
  if (!keys.length){ el.textContent = 'Ваш выбор: —'; return; }

  const important = ['checkin','date_from','checkout','date_to','adults','kids','children','guests','nights','type','size','power','water','car','rv','tent'];
  const ordered = keys.sort((a,b)=>{
    const ia = important.indexOf(a), ib = important.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const parts = [];
  ordered.forEach(k=>{
    const val = p[k];
    if (val==null || val==='') return;
    parts.push(`${humanizeKey(k)}: ${val}`);
  });

  el.textContent = 'Ваш выбор: ' + (parts.join(' · ') || '—');
}
