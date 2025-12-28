const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

export function setLayerVisible(svgRoot, label, visible){
  const esc = CSS.escape(label);
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
