// ============================================================
// map/app.js — карта выбора участка
// • Получает все параметры формы из URL (from,to,guests,children_ages,phone,email)
// • При подтверждении ДОБАВЛЯЕТ pitch_id/pitch_name/layer и возвращает в ../booking/index.html
//   сохранив исходные параметры (чтобы форма восстановилась и показала участок).
// ============================================================

import { loadSvg } from './svg-loader.js';
import { prepareSvg, setLayerVisible } from './svg-interaction.js';
import { createSelectionState } from './selection-state.js';
import { wireNavigation } from './navigation.js';

const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: false,
  minZoom: -4,
  attributionControl: false,
});
map.attributionControl?.remove?.();

let svgRoot = null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const selectedLbl = $('#selected-label');
const btnCancel = $('#cp-cancel');
const btnOk = $('#cp-ok');

const selectionState = createSelectionState({
  selectedLabelEl: selectedLbl,
  btnCancel,
  btnOk,
});

init().then(() => {
  wireUI();
}).catch(console.error);

// === загрузка и подготовка ===
async function init() {
  const svgUrl = './assets/masterplan.svg';
  const { svgRoot: root } = await loadSvg(map, svgUrl);
  svgRoot = root;
  prepareSvg(svgRoot, selectionState);
}

// === UI ===
function wireUI() {
  $('#zoom-in').addEventListener('click', () => map.zoomIn());
  $('#zoom-out').addEventListener('click', () => map.zoomOut());

  // Назад: просто вернуться с исходными параметрами (если были)
  $('#back-btn').addEventListener('click', () => {
    const base = '../booking/index.html';
    const qs = location.search;
    location.href = qs ? `${base}${qs}` : base;
  });

  $$('.toggle[data-layer]').forEach(btn => {
    const layer = btn.dataset.layer;
    btn.addEventListener('click', () => {
      const on = !btn.classList.contains('on');
      setLayerVisible(svgRoot, layer, on);
      btn.classList.toggle('on', on);
    });
  });

  wireNavigation({ btnCancel, btnOk, selectionState });
}
