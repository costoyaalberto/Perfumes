import { api } from '../api.js';
import { openModal, closeModal, confirmDialog } from '../modal.js';
import { formatFecha, escapeHtml, normalizarNombre, toast } from '../utils.js';

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
    <div class="card card-clickable" data-id="${p.id}">
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

content.addEventListener('click', (e) => {
  const card = e.target.closest('[data-id]');
  if (!card) return;
  const item = items.find((i) => i.id === card.dataset.id);
  if (item) handleEditar(item);
});

async function handleEditar(item) {
  const el = openModal(`
    <h3>Editar — Lista Negra</h3>
    <form id="form-editar-lista-negra">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required value="${escapeHtml(item.nombre_perfume)}" />
      </div>
      <div class="form-row">
        <label>Motivo (obligatorio)</label>
        <textarea name="motivo" rows="2" required>${escapeHtml(item.motivo || '')}</textarea>
      </div>
      <div class="form-row">
        <label>Comentario</label>
        <textarea name="comentario" rows="2">${escapeHtml(item.comentario || '')}</textarea>
      </div>
      <div class="modal-actions" style="justify-content:space-between;">
        <button type="button" class="btn btn-danger btn-sm" data-action="eliminar">Eliminar</button>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('[data-action="eliminar"]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Eliminar de Lista Negra',
      message: `¿Eliminar "${escapeHtml(item.nombre_perfume)}" de la Lista Negra? Útil para duplicados o errores de carga. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.eliminarDeListaNegra(item.id);
      closeModal();
      toast('Eliminado de Lista Negra');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
  el.querySelector('#form-editar-lista-negra').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const motivo = fd.get('motivo').trim();
    if (!motivo) return;
    try {
      await api.editarListaNegra({
        p_lista_negra_id: item.id,
        p_nombre_perfume: fd.get('nombre').trim(),
        p_motivo: motivo,
        p_comentario: fd.get('comentario') || null,
      });
      closeModal();
      toast('Guardado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}
