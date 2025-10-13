/* === Параметры из URL (даты/гости) === */
const q = new URLSearchParams(location.search);
const from   = q.get('from') || '';
const to     = q.get('to')   || '';
const guests = Number(q.get('guests') || 1);

/* === Telegram WebApp === */
const tg = window.Telegram?.WebApp; tg?.expand?.();

/* === Панель === */
document.getElementById('dates').textContent  = (from && to) ? `${from} → ${to}` : '—';
document.getElementById('guests').textContent = guests || '—';
const pickedEl   = document.getElementById('picked');
const confirmBtn = document.getElementById('confirm');
const drawToggle = document.getElementById('drawToggle');
const saveBtn    = document.getElementById('saveGeoJson');
const clearBtn   = document.getElementById('clearAll');
const posEl      = document.getElementById('pos');
const opacityInp = document.getElementById('opacity');
const moveBtn    = document.getElementById('moveSelected');
confirmBtn.disabled = true;

/* === Перетаскивание нижнего бокса === */
makeDraggablePanel(document.getElementById('panel'), document.querySelector('#panel .drag-handle'));
function makeDraggablePanel(panel, handle){
  let dragging = false, sx=0, sy=0, sl=0, st=0;
  const down = (e) => {
    dragging = true;
    panel.style.transition = 'none';
    panel.style.left = panel.offsetLeft + 'px';
    panel.style.top  = panel.offsetTop  + 'px';
    panel.style.transform = 'none';
    sx = e.clientX; sy = e.clientY; sl = panel.offsetLeft; st = panel.offsetTop;
    handle.setPointerCapture(e.pointerId);
  };
  const move = (e) => { if(!dragging) return; panel.style.left = (sl + e.clientX - sx) + 'px'; panel.style.top = (st + e.clientY - sy) + 'px'; };
  const up   = (e) => { dragging = false; try{handle.releasePointerCapture(e.pointerId);}catch{} };
  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup',   up);
}

/* === Карта === */
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5,
  inertia: true, worldCopyJump: false
});

let overlay = null;
loadImage('../assets/masterplan.png').then(({src, width, height}) => {
  const bounds = [[0,0],[height, width]];
  overlay = L.imageOverlay(src, bounds, { opacity: Number(opacityInp.value)/100 }).addTo(map);
  map.fitBounds(bounds);
  map.on('mousemove', (e) => { posEl.textContent = `${Math.round(e.latlng.lat)}, ${Math.round(e.latlng.lng)}`; });
  loadPitches();
});

function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ src: url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url + ((/\?/).test(url) ? '&' : '?') + 'v=' + Date.now();
  });
}

/* === Слой участков === */
let selectedLayer = null;
let draggingLayer = null;   // у какого слоя сейчас активен layerDrag
let moveMode = false;       // включён ли режим переноса целиком

const layerPolygons = L.geoJSON(null, {
  style: f => ({
    color: f?.properties?.is_free ? '#22c55e' : '#9ca3af',
    weight: 2,
    fillOpacity: 0.35
  }),
  onEachFeature: (f, layer) => {
    if (f?.properties?.label) layer.bindTooltip(f.properties.label, { direction:'top', offset:[0,-6] });
    layer.on('click', () => selectLayer(f, layer));
    layer.on('dblclick', () => editProps(layer));
  }
}).addTo(map);

function loadPitches(){
  fetch('./pitches.geo.json')
    .then(r => r.json())
    .then(data => {
      layerPolygons.addData(data);
      const b = layerPolygons.getBounds();
      if (b.isValid()) map.fitBounds(b.pad(0.1));
      console.log('✅ Pitches loaded:', (data.features || []).length);
    })
    .catch(err => console.error('pitches load error', err));
}

/* === Выбор участка === */
function selectLayer(feature, layer) {
  // если в режиме переноса — перевешиваем drag на новый слой
  if (moveMode) setLayerDrag(layer);

  selectedLayer = layer;
  const p = (feature && feature.properties) || {};
  pickedEl.textContent = `Выбрано: ${p.name || p.id} (${p.type || ''})`;
  confirmBtn.disabled = !Boolean(p.is_free);
  layerPolygons.resetStyle();
  layer.setStyle({ color:'#2563eb', weight:3, fillOpacity: .45 });
}

/* === Отправка выбора в бота === */
confirmBtn.addEventListener('click', () => {
  if (!selectedLayer) return;
  const p = selectedLayer.feature?.properties || {};
  tg?.sendData?.(JSON.stringify({
    from, to, guests,
    pitch_id: p.id, pitch_name: p.name || null, pitch_type: p.type || null
  }));
});

/* === Включение/выключение поведения карты на время drag === */
function disableMapInteractions(){
  map.dragging.disable();
  map.doubleClickZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
}
function enableMapInteractions(){
  map.dragging.enable();
  map.doubleClickZoom.enable();
  map.boxZoom.enable();
  map.keyboard.enable();
}

/* === Назначить drag для конкретного слоя (без вершин!) === */
function setLayerDrag(layer){
  // отключим drag у предыдущего
  if (draggingLayer && draggingLayer !== layer) {
    try { draggingLayer.pm.disableLayerDrag(); } catch {}
    removeDragGuards(draggingLayer);
  }

  draggingLayer = layer;

  // выключаем «редактирование вершин» на всякий случай
  try { layer.pm.disable(); } catch {}

  // ВКЛЮЧАЕМ ПЕРЕНОС ВСЕЙ ФИГУРЫ
  try { layer.pm.enableLayerDrag(); } catch {} // <-- ключевая строка

  attachDragGuards(layer);
}

function attachDragGuards(layer){
  // не даём событиям стартовать панораму карты
  const stop = (e) => { if(!moveMode) return; if(e.originalEvent){ e.originalEvent.preventDefault(); e.originalEvent.stopPropagation(); } L.DomEvent.stop(e); };
  layer.off('mousedown touchstart pointerdown', stop);
  layer.on('mousedown touchstart pointerdown', stop);

  // при начале/окончании перетаскивания — выключаем/включаем поведение карты
  layer.off('pm:dragstart'); layer.off('pm:dragend');
  layer.on('pm:dragstart', () => disableMapInteractions());
  layer.on('pm:dragend',   () => enableMapInteractions());
}

function removeDragGuards(layer){
  layer.off('mousedown'); layer.off('touchstart'); layer.off('pointerdown');
  layer.off('pm:dragstart'); layer.off('pm:dragend');
}

/* === Кнопка режима переноса === */
moveBtn.addEventListener('click', () => {
  if (!selectedLayer) {
    alert('Сначала выберите участок кликом.');
    return;
  }
  moveMode = !moveMode;

  if (moveMode) {
    setLayerDrag(selectedLayer);
    disableMapInteractions();              // чтобы карта не дёрнулась на первый пик
    moveBtn.classList.add('active');
    moveBtn.textContent = '⤴︎ Готово (выкл. перенос)';
  } else {
    try { selectedLayer.pm.disableLayerDrag(); } catch {}
    enableMapInteractions();
    removeDragGuards(selectedLayer);
    moveBtn.classList.remove('active');
    moveBtn.textContent = '⤴︎ Переместить выбранный';
  }
});

/* === Режим оцифровки (Leaflet.Draw) === */
let drawControl = null;
drawToggle.addEventListener('change', (e) => e.target.checked ? enableDraw() : disableDraw());

function enableDraw() {
  if (drawControl) return;
  drawControl = new L.Control.Draw({
    position: 'topright',
    draw: {
      polygon:   { allowIntersection:false, showArea:false },
      rectangle: true,
      marker:    true,
      polyline:  false, circle:false, circlemarker:false
    },
    edit: { featureGroup: layerPolygons }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, e => {
    const layer = e.layer;
    const nextId = getNextId();
    const baseProps = { id: nextId, name: `NEW-${nextId}`, type: "tent-60", capacity: 4, price: 1500, is_free: true, label: `N${nextId}` };
    layer.feature = layer.feature || { type:'Feature', properties:{}, geometry:{} };
    layer.feature.properties = { ...baseProps };
    layerPolygons.addLayer(layer);
    selectLayer(layer.feature, layer);
  });

  map.on(L.Draw.Event.EDITED, () => { if (selectedLayer) selectLayer(selectedLayer.feature, selectedLayer); });
}
function disableDraw() {
  if (!drawControl) return;
  map.removeControl(drawControl);
  map.off(L.Draw.Event.CREATED);
  map.off(L.Draw.Event.EDITED);
  drawControl = null;
}

/* === Редактирование свойств по даблклику === */
function editProps(layer) {
  const p = layer.feature?.properties || {};
  const name     = prompt("name:", p.name ?? "") ?? p.name ?? null;
  const type     = prompt("type (tent-60/rv-80/rv-100/facility):", p.type ?? "") ?? p.type ?? null;
  const capacity = Number(prompt("capacity:", p.capacity ?? 0) ?? p.capacity ?? 0);
  const price    = Number(prompt("price:", p.price ?? 0) ?? p.price ?? 0);
  const isFree   = prompt("is_free (true/false):", String(p.is_free ?? true)).toLowerCase() !== "false";

  layer.feature.properties = { ...p, name, type, capacity, price, is_free: isFree, label: name || p.label };
  layer.setStyle && layer.setStyle({ color: isFree ? '#22c55e' : '#9ca3af' });
  selectLayer(layer.feature, layer);
}

/* === Сохранить/Очистить === */
saveBtn.addEventListener('click', () => downloadJSON(layerPolygons.toGeoJSON(), 'pitches.geo.json'));
clearBtn.addEventListener('click', () => { if (confirm('Удалить все полигоны и точки?')) layerPolygons.clearLayers(); });

/* === Прозрачность подложки === */
opacityInp.addEventListener('input', () => { if (overlay) overlay.setOpacity(Number(opacityInp.value)/100); });

/* === Вспомогательное === */
function getNextId() {
  let maxId = 1000;
  layerPolygons.eachLayer(l => { const id = l?.feature?.properties?.id; if (typeof id === 'number' && id > maxId) maxId = id; });
  return maxId + 1;
}
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}
