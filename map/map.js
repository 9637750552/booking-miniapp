/* === Параметры из URL (даты/гости) === */
const q = new URLSearchParams(location.search);
const from   = q.get('from') || '';
const to     = q.get('to')   || '';
const guests = Number(q.get('guests') || 1);

/* === Telegram WebApp === */
const tg = window.Telegram?.WebApp; tg?.expand?.();

/* === Обновляем панель === */
document.getElementById('dates').textContent  = (from && to) ? `${from} → ${to}` : '—';
document.getElementById('guests').textContent = guests || '—';
const pickedEl   = document.getElementById('picked');
const confirmBtn = document.getElementById('confirm');
const drawToggle = document.getElementById('drawToggle');
const saveBtn    = document.getElementById('saveGeoJson');
confirmBtn.disabled = true;

/* === Карта в CRS.Simple с подложкой мастер-плана === */
const IMG_W = 1254;   // ширина изображения (px)
const IMG_H = 843;    // высота изображения (px)
const bounds = [[0,0], [IMG_H, IMG_W]];

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2, maxZoom: 2, zoomSnap: 0.25, zoomDelta: 0.5
});
L.imageOverlay('../assets/masterplan.png', bounds).addTo(map);
map.fitBounds(bounds);

/* === Слой участков: подкраска + события === */
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
    layer.on('dblclick', () => editProps(layer)); // редактирование свойств по даблклику
  }
}).addTo(map);

/* === Загрузка GeoJSON участков === */
fetch('./pitches.geo.json')
  .then(r => r.json())
  .then(data => {
    layerPolygons.addData(data);
    const b = layerPolygons.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.15));
    console.log('✅ Pitches loaded:', (data.features || []).length);
  })
  .catch(err => console.error('pitches load error', err));

/* === Выбор участка === */
function selectLayer(feature, layer) {
  selectedLayer = layer;
  const p = (feature && feature.properties) || {};
  pickedEl.textContent = `Выбрано: ${p.name || p.id} (${p.type || ''})`;
  confirmBtn.disabled = !Boolean(p.is_free);
  // подсветка выбранного
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
  // tg?.close?.(); // при желании закрывать миниапп
});

/* === Режим оцифровки (Leaflet.Draw) === */
let drawControl = null;

function enableDraw() {
  if (drawControl) return;
  drawControl = new L.Control.Draw({
    draw: {
      polygon: { allowIntersection:false, showArea:false },
      marker:  true,
      rectangle:false, polyline:false, circle:false, circlemarker:false
    },
    edit: { featureGroup: layerPolygons }
  });
  map.addControl(drawControl);

  // создание новых объектов
  map.on(L.Draw.Event.CREATED, e => {
    const layer = e.layer;
    // назначим дефолтные свойства
    const nextId = getNextId();
    const baseProps = {
      id: nextId,
      name: `NEW-${nextId}`,
      type: "tent-60",
      capacity: 4,
      price: 1500,
      is_free: true,
      label: `N${nextId}`
    };
    layer.feature = layer.feature || { type:'Feature', properties:{}, geometry:{} };
    layer.feature.properties = { ...baseProps };
    layerPolygons.addLayer(layer);
    selectLayer(layer.feature, layer);
  });

  // после редактирования оставляем выбор свежим
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

/* === Редактирование свойств выбранного полигона === */
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
  // перекрасим слой, если менялась доступность
  layer.setStyle && layer.setStyle({ color: isFree ? '#22c55e' : '#9ca3af' });
  selectLayer(f, layer);
}

/* === Экспорт pitches.geo.json === */
saveBtn.addEventListener('click', () => {
  const data = layerPolygons.toGeoJSON();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pitches.geo.json';
  a.click();
});

/* === Вспомогательное: следующий id === */
function getNextId() {
  let maxId = 1000;
  layerPolygons.eachLayer(l => {
    const id = l?.feature?.properties?.id;
    if (typeof id === 'number' && id > maxId) maxId = id;
  });
  return maxId + 1;
}
