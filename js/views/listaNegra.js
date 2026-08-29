import { api } from '../api.js';
import { formatFecha, escapeHtml, normalizarNombre } from '../utils.js';

const content = document.getElementById('lista-negra-content');
const searchInput = document.getElementById('buscar-lista-negra');
let items = [];

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  items = await api.listarListaNegra();
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
      <div class="card-meta">
        <span class="chip chip-warn">${escapeHtml(p.tienda_nombre || '—')}</span>
        <span class="chip chip-price">${formatFecha(p.fecha)}</span>
      </div>
      <div class="card-comment"><strong>Motivo:</strong> ${escapeHtml(p.motivo)}</div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
    </div>
  `).join('');
}

searchInput.addEventListener('input', () => {
  const q = normalizarNombre(searchInput.value);
  if (!q) return draw(items);
  draw(items.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)));
});
