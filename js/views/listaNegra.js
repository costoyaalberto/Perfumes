import { api } from '../api.js';
import { formatFecha, escapeHtml, normalizarNombre } from '../utils.js';

const content = document.getElementById('lista-negra-content');
const searchInput = document.getElementById('buscar-lista-negra');
const sortBtn = document.getElementById('btn-orden-lista-negra');
let items = [];
let sortMode = 'nombre'; // 'nombre' | 'fecha'

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  items = await api.listarListaNegra();
  searchInput.value = '';
  refresh();
}

function currentFiltered() {
  const q = normalizarNombre(searchInput.value);
  let list = items;
  if (q) list = list.filter((p) => normalizarNombre(p.nombre_perfume).includes(q));
  list = [...list];
  if (sortMode === 'fecha') {
    list.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  } else {
    list.sort((a, b) => a.nombre_perfume.localeCompare(b.nombre_perfume, 'es'));
  }
  return list;
}

function refresh() {
  draw(currentFiltered());
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

searchInput.addEventListener('input', refresh);

sortBtn.addEventListener('click', () => {
  sortMode = sortMode === 'nombre' ? 'fecha' : 'nombre';
  sortBtn.textContent = sortMode === 'nombre' ? 'Ordenar: Nombre' : 'Ordenar: Fecha (recientes primero)';
  sortBtn.classList.toggle('active', sortMode === 'fecha');
  refresh();
});
