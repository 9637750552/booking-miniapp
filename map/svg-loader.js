// === загрузка и подготовка ===
export async function loadSvg(map, svgUrl) {
  const r = await fetch(svgUrl, { cache: 'no-store' });
  if (!r.ok) throw new Error(`SVG load error: ${r.status}`);
  const text = await r.text();

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('SVG parse error');

  const svgRoot = doc.documentElement;
  const vb = svgRoot.getAttribute('viewBox');
  if (!vb) throw new Error('No viewBox in SVG');
  const [ , , w, h ] = vb.split(/\s+/).map(Number);

  const bounds = [[0,0],[h,w]];
  const svgOverlay = L.svgOverlay(svgRoot, bounds, { opacity: 0.98, interactive: false }).addTo(map);
  map.fitBounds(bounds);

  return { svgRoot, svgOverlay };
}
