import { clearSelection, submitSelection } from './svg-interaction.js';
import { setLayerVisible } from './layers.js';

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

export function wireUI({ map, svgRoot, selectedLbl, btnCancel, btnOk }){
  $('#zoom-in').addEventListener('click', ()=>map.zoomIn());
  $('#zoom-out').addEventListener('click', ()=>map.zoomOut());

  // Назад: просто вернуться с исходными параметрами (если были)
  $('#back-btn').addEventListener('click', ()=>{
    const base = '../booking/index.html';
    const qs = location.search;
    location.href = qs ? `${base}${qs}` : base;
  });

  $$('.toggle[data-layer]').forEach(btn=>{
    const layer = btn.dataset.layer;
    btn.addEventListener('click', ()=>{
      const on = !btn.classList.contains('on');
      setLayerVisible(svgRoot, layer, on);
      btn.classList.toggle('on', on);
    });
  });

  btnCancel.addEventListener('click', ()=>clearSelection(selectedLbl, btnOk, btnCancel));
  btnOk.addEventListener('click', submitSelection);
}
