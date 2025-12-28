// ============================================================
// map/app.js — карта выбора участка
// • Получает все параметры формы из URL (from,to,guests,children_ages,phone,email)
// • При подтверждении ДОБАВЛЯЕТ pitch_id/pitch_name/layer и возвращает в ../booking/index.html
//   сохранив исходные параметры (чтобы форма восстановилась и показала участок).
// ============================================================

import { loadSvg } from './svg-loader.js';
import { prepareSvg } from './svg-interaction.js';
import { wireUI } from './navigation.js';

const map = L.map('map', {
  crs: L.CRS.Simple,
  zoomControl: false,
  minZoom: -4,
  attributionControl: false,
});
map.attributionControl?.remove?.();

let svgRoot = null;
let svgOverlay = null;

const $  = (s, r=document)=>r.querySelector(s);

const selectedLbl = $('#selected-label');
const btnCancel   = $('#cp-cancel');
const btnOk       = $('#cp-ok');

init().then(()=>{ wireUI({ map, svgRoot, selectedLbl, btnCancel, btnOk }); }).catch(console.error);

// === загрузка и подготовка ===
async function init(){
  const svgUrl = `./assets/masterplan.svg`;
  const loaded = await loadSvg(map, svgUrl);
  svgRoot = loaded.svgRoot;
  svgOverlay = loaded.svgOverlay;

  prepareSvg(svgRoot, selectedLbl, btnOk, btnCancel);
  requestAnimationFrame(() => {
    map.invalidateSize();
  });
}
