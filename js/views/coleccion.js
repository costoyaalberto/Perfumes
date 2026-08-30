import { api } from '../api.js';
import { formatCLP, formatFecha, escapeHtml, normalizarNombre } from '../utils.js';

const content = document.getElementById('coleccion-content');
const searchInput = document.getElementById('buscar-coleccion');
const sortBtn = document.getElementById('btn-orden-coleccion');
let items = [];
let sortMode = 'nombre'; // 'nombre' | 'fecha'

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  items = await api.listarColeccion();
  searchInput.value = '';
  refresh();
}

function currentFiltered() {
  const q = normalizarNombre(searchInput.value);
  let list = items;
  if (q) {
    list = list.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)
      || normalizarNombre(p.referencia || '').includes(q));
  }
  list = [...list];
  if (sortMode === 'fecha') {
    list.sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
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

searchInput.addEventListener('input', refresh);

sortBtn.addEventListener('click', () => {
  sortMode = sortMode === 'nombre' ? 'fecha' : 'nombre';
  sortBtn.textContent = sortMode === 'nombre' ? 'Ordenar: Nombre' : 'Ordenar: Fecha (recientes primero)';
  sortBtn.classList.toggle('active', sortMode === 'fecha');
  refresh();
});
