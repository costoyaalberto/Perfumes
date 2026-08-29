import { api } from '../api.js';
import { formatCLP, formatFecha, escapeHtml, normalizarNombre } from '../utils.js';

const content = document.getElementById('coleccion-content');
const searchInput = document.getElementById('buscar-coleccion');
let items = [];

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  items = await api.listarColeccion();
  searchInput.value = '';
  draw(items);
}

function draw(list) {
  if (!list.length) {
    content.innerHTML = '<p class="empty-state">Sin resultados.</p>';
    return;
  }
  content.innerHTML = list.map((p) => `
    <div class="card">
      <div class="card-title">${escapeHtml(p.nombre_perfume)}</div>
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-meta">
        <span class="chip chip-price">${formatCLP(p.precio)}</span>
        <span class="chip chip-buy">${escapeHtml(p.tienda_nombre || p.canal_compra || '—')}</span>
        <span class="chip chip-ok">${formatFecha(p.fecha_compra)}</span>
      </div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
    </div>
  `).join('');
}

searchInput.addEventListener('input', () => {
  const q = normalizarNombre(searchInput.value);
  if (!q) return draw(items);
  draw(items.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)
    || normalizarNombre(p.referencia || '').includes(q)));
});
