// === НАСТРОЙКИ ===
const SVG_URL = 'assets/masterplan.svg';
// интерактив только для питчей
const PITCH_LAYERS = ['pitches_60','pitches_80','pitches_100'];

// === КАРТА ===
const map = L.map('map', { crs: L.CRS.Simple, zoomControl: false, minZoom: -4 });
let svgRoot = null;
let svgOverlay = null;

// утилиты
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

// UI
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

  // три кнопки питчей (показ/скрытие)
  $$('.toggle[data-layer]').forEach(btn=>{
    const layer = btn.dataset.layer;
    btn.addEventListener('click', ()=>{
      const on = !btn.classList.contains('on');
      setLayerVisible(layer, on);
      btn.classList.toggle('on', on);
      btn.classList.toggle('off', !on);
    });
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

  const getFirst = (...keys)=>keys.find(k=>p[k]!=null && p[k] !== '');
  const ciKey = getFirst('checkin','date_from','from','arrival','start','checkin_date','check_in','dateStart','start_date');
  const coKey = getFirst('checkout','date_to','to','departure','end','checkout_date','check_out','dateEnd','end_date');
  const guestsKey = getFirst('guests','persons','people','count');
  const adultsKey = getFirst('adults','adult');
  const kidsKey = getFirst('kids','children','child');

  const parts = [];
  if (ciKey) parts.push(`Заезд: ${p[ciKey]}`);
  if (coKey) parts.push(`Выезд: ${p[coKey]}`);
  if (p[guestsKey]) parts.push(`Гостей: ${p[guestsKey]}`);
  if (p[adultsKey]) parts.push(`Взрослые: ${p[adultsKey]}`);
  if (p[kidsKey]) parts.push(`Дети: ${p[kidsKey]}`);

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

// === подготовка интерактива (только питчи, БЕЗ hover-подсветки) ===
function prepareSvg(svg){
  const selLayer = getSelectionLayer();

  // соберём фигуры из групп pitch-слоёв
  const allGroups = Array.from(svg.querySelectorAll('g'));
  const groups = allGroups.filter(g=>{
    const lab = (g.getAttribute('inkscape:label')||g.getAttribute('sodipodi:label')||g.id||'').toLowerCase();
    return PITCH_LAYERS.some(layer => lab === layer || lab.startsWith(layer+' ') || lab.startsWith(layer+'_') || lab.startsWith(layer+'-'));
  });

  const SHAPES = 'path,rect,polygon,polyline,circle,ellipse,use';
  const shapes = groups.flatMap(g=>{
    const layerName = (g.getAttribute('inkscape:label')||g.getAttribute('sodipodi:label')||g.id||'');
    return Array.from(g.querySelectorAll(SHAPES)).map(el => (el.dataset.layer=layerName, el));
  });

  // для тонких контуров делаем невидимую "hit"-область
  const hitLayer = (()=>{ const sel = getSelectionLayer(); let h = svg.querySelector('#__hit__'); if(!h){ h=document.createElementNS('http://www.w3.org/2000/svg','g'); h.id='__hit__'; sel.before(h);} return h; })();

  shapes.forEach(el=>{
    el.style.pointerEvents='all';
    el.style.cursor='pointer';

    let target = el;
    if (isThinStrokeOrNoPaint(el)){
      const hit = makeHitClone(el);
      hit.dataset.layer = el.dataset.layer;
      hitLayer.appendChild(hit);
      target = hit;
    }

    // считаем «кликом» только короткое нажатие без сдвига
    let downPos = null;
    target.addEventListener('pointerdown', (ev)=>{
      downPos = {x: ev.clientX, y: ev.clientY};
    }, {passive:true});

    target.addEventListener('pointerup', (ev)=>{
      let isClick = true;
      if (downPos){
        const dx = Math.abs(ev.clientX - downPos.x);
        const dy = Math.abs(ev.clientY - downPos.y);
        if (dx > 6 || dy > 6) isClick = false;
      }
      downPos = null;
      if (!isClick) return;

      ev.stopPropagation();
      ev.preventDefault();

      const isSame = selectedEl === el;
      if (isSame) { clearSelection(); return; }   // повторный клик — снять

      if (selectedEl) clearSelection();          // одиночный выбор

      el.dataset.sel = '1';
      const sel = makeHighlightClone(el, '#ff3b30'); // КРАСНАЯ рамка выбора
      const cid = '__sel__'+Math.random().toString(36).slice(2);
      sel.id = cid;
      selLayer.appendChild(sel);
      el.dataset.selCloneId = cid;

      selectedEl = el;
      selectedLbl.textContent = getReadableLabel(el);
      btnOk.disabled = btnCancel.disabled = false;
    });

    target.addEventListener('pointercancel', ()=>{ downPos = null; });
  });
}

// показать/скрыть слой по имени
function setLayerVisible(label, visible){
  const esc = CSS.escape(label);
  // элементы слоя и их hit-клоны
  $$(`[data-layer="${esc}"]`, svgRoot).forEach(el=>{
    if (el.dataset.hit === '1') el.style.display = visible ? '' : 'none';
    else el.classList.toggle('layer-hidden', !visible);
  });
  const hitRoot = svgRoot.querySelector('#__hit__');
  if (hitRoot){
    $$(`[data-layer="${esc}"]`, hitRoot).forEach(el=>{
      el.style.display = visible ? '' : 'none';
    });
  }
}

// очистка выбора
function clearSelection(){
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
