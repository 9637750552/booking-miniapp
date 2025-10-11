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
const pickedEl     = document.getElementById('picked');
const confirmBtn   = document.getElementById('confirm');
const drawToggle   = document.getElementById('drawToggle');
const saveBtn      = document.getElementById('saveGeoJson');
const clearBtn     = document.getElementById('clearAll');
const posEl        = document.getElementById('pos');
const opacityInp   = document.getElementById('opacity');
const moveBtn      = document.getElementById('moveSelected');
confirmBtn.disabled = true;

/* === Перетаскивание панели (drag & drop, pointer events) === */
makeDraggablePanel(document.getElementById('panel'), document.querySelector('#panel .drag-handle'));
function makeDraggablePanel(panel, handle){
  let dragging = false, startX=0, startY=0, startLeft=0, startTop=0;
  const onPointerDown = (e) => {
    dragging = true;
    panel.style.transition = 'none';
    panel.style.left = panel.offsetLeft + 'px';
    panel.style.top  = panel.offsetTop  + 'px';
    panel.style.transform = 'none';
    startX = e.clientX; startY = e.clientY;
    startLeft = panel.offsetLeft; startTop = panel.offsetTop;
    handle.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = (startLeft + dx) + 'px';
    panel.style.top  = (startTop  + dy) + 'px';
  };
  const onPointerUp = (e) => { dragging = false; handle.releasePointerCapture(e.pointerId); };
  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
}

/* === Карта в CRS.Simple === */
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5,
  inertia: true, worldCopyJump: false
});

/* === Загружаем изображение, берём реальные размеры === */
let overlay = null;
loadImage('../assets/masterplan.png').then(({src, width, height}) => {
  const bounds = [[0,0],[height, width]];         // [y,x]
  overlay = L.imageOverlay(src, bounds, { opacity: Number(opacityInp.value)/100 }).addTo(map);

  // ВАЖНО: не ставим setMaxBounds → карта свободно перетаскивается без "возврата"
  map.fitBounds(bounds);

  map.on('mousemove', (e) => {
    posEl.textContent = `${Math.round(e.latlng.lat)}, ${Math.round(e.latlng.lng)}`;
  });

  // После подложки грузим участки
  loadPitches();
});

/* помощник: получить naturalWidth/Height */
function loadImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ src: url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url + ((/\?/).test(url) ? '&' : '?') + 'v=' + Date.now(); // bypass cache
  });
}

/* === Слой участков === */
let selectedLayer = null;
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
  const f = selectedLayer.feature || {};
  const p = f.properties || {};
  const payload = {
    from, to, guests,
    pitch_id:   p.id,
    pitch_name: p.name || null,
    pitch_type: p.type || null
  };
  tg?.sendData?.(JSON.stringify(payload));
  // tg?.close?.();
});

/* === Режим оцифровки (Leaflet.Draw) === */
let drawControl = null;

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
    const baseProps = {
      id: nextId, name: `NEW-${nextId}`, type: "tent-60",
      capacity: 4, price: 1500, is_free: true, label: `N${nextId}`
    };
    layer.feature = layer.feature || { type:'Feature', properties:{}, geometry:{} };
    layer.feature.properties = { ...baseProps };
    layerPolygons.addLayer(layer);
    selectLayer(layer.feature, layer);
  });

  map.on(L.Draw.Event.EDITED, () => {
    if (selectedLayer) selectLayer(selectedLayer.feature, selectedLayer);
  });
}

function disableDraw() {
  if (!drawControl) return;
  map.removeControl(drawControl);
  map.off(L.Draw.Event.CREATED);
  map.off(L.Draw.Event.EDITED);
  drawControl = null;
}

drawToggle.addEventListener('change', (e) => {
  e.target.checked ? enableDraw() : disableDraw();
});

/* === Перемещать целиком выбранный (Leaflet.PM) === */
let moveMode = false;
moveBtn.addEventListener('click', () => {
  if (!selectedLayer) {
    alert('Сначала выберите участок кликом.');
    return;
  }
  moveMode = !moveMode;
  if (moveMode) {
    selectedLayer.pm.enable({ draggable:true, snappable:false, allowSelfIntersection:false });
    moveBtn.classList.add('active');
    moveBtn.textContent = '⤴︎ Готово (выкл. перенос)';
  } else {
    selectedLayer.pm.disable();
    moveBtn.classList.remove('active');
    moveBtn.textContent = '⤴︎ Переместить выбранный';
  }
});

/* === Редактирование свойств по даблклику === */
function editProps(layer) {
  const f = layer.feature || {};
  const p = f.properties || {};
  const name    = prompt("name:", p.name ?? "") ?? p.name ?? null;
  const type    = prompt("type (tent-60/rv-80/rv-100/facility):", p.type ?? "") ?? p.type ?? null;
  const capacity= Number(prompt("capacity:", p.capacity ?? 0) ?? p.capacity ?? 0);
  const price   = Number(prompt("price:", p.price ?? 0) ?? p.price ?? 0);
  const isFree  = prompt("is_free (true/false):", String(p.is_free ?? true)).toLowerCase() !== "false";

  f.properties = { ...p, name, type, capacity, price, is_free: isFree, label: name || p.label };
  layer.feature = f;
  layer.setStyle && layer.setStyle({ color: isFree ? '#22c55e' : '#9ca3af' });
  selectLayer(f, layer);
}

/* === Сохранить/Очистить === */
saveBtn.addEventListener('click', () => {
  const data = layerPolygons.toGeoJSON();
  downloadJSON(data, 'pitches.geo.json');
});
clearBtn.addEventListener('click', () => {
  if (!confirm('Удалить все полигоны и точки?')) return;
  layerPolygons.clearLayers();
});

/* === Прозрачность подложки === */
opacityInp.addEventListener('input', () => {
  if (overlay) overlay.setOpacity(Number(opacityInp.value)/100);
});

/* === Вспомогательные === */
function getNextId() {
  let maxId = 1000;
  layerPolygons.eachLayer(l => {
    const id = l?.feature?.properties?.id;
    if (typeof id === 'number' && id > maxId) maxId = id;
  });
  return maxId + 1;
}
function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
