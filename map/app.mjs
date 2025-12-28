import { loadSvg } from './svg-loader.js';
import { prepareSvg } from './svg-interaction.js';
import { wireUI } from './navigation.js';

let map;
let svgRoot = null;
let svgOverlay = null;

const $ = s => document.querySelector(s);

const selectedLbl = $('#selected-label');
const btnCancel   = $('#cp-cancel');
const btnOk       = $('#cp-ok');

window.addEventListener('load', async () => {

  map = L.map('map', {
    crs: L.CRS.Simple,
    zoomControl: false,
    minZoom: -4,
    attributionControl: false,
  });

  const result = await loadSvg(map);
  svgRoot = result.svgRoot;
  svgOverlay = result.svgOverlay;

  prepareSvg(svgRoot, selectedLbl, btnOk, btnCancel);
  wireUI({ map, svgRoot, selectedLbl, btnCancel, btnOk });

  map.fitBounds(svgOverlay.getBounds());
});
