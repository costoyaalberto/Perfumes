import { api } from '../api.js';
import { confirmDialog } from '../modal.js';
import { formatCLP, formatFecha, escapeHtml, normalizarNombre, toast } from '../utils.js';

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
    <div class="card" data-id="${p.id}">
      <div class="card-title">${escapeHtml(p.nombre_perfume)}</div>
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-meta">
        <span class="chip chip-price">${formatCLP(p.precio)}</span>
        <span class="chip chip-buy">${escapeHtml(p.tienda_nombre || p.canal_compra || '—')}</span>
        <span class="chip chip-ok">${formatFecha(p.fecha_compra)}</span>
      </div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-danger btn-sm" data-action="eliminar">Eliminar (devolución, error, etc.)</button>
      </div>
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

content.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="eliminar"]');
  if (!btn) return;
  const card = e.target.closest('[data-id]');
  const item = items.find((i) => i.id === card.dataset.id);
  if (!item) return;

  const ok = await confirmDialog({
    title: 'Eliminar de Colección',
    message: `¿Eliminar "${escapeHtml(item.nombre_perfume)}" de tu colección? Úsalo para devoluciones o errores de carga. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.eliminarDeColeccion(item.id);
    toast('Eliminado de Colección');
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});
