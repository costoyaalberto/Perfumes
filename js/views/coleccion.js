import { api } from '../api.js';
import { getRepisas, invalidateRepisas } from '../store.js';
import { openModal, closeModal, confirmDialog } from '../modal.js';
import { formatCLP, formatFecha, escapeHtml, normalizarNombre, toast } from '../utils.js';

const content = document.getElementById('coleccion-content');
const searchInput = document.getElementById('buscar-coleccion');
const sortBtn = document.getElementById('btn-orden-coleccion');
const filtroRepisa = document.getElementById('filtro-repisa-coleccion');
const btnRepisas = document.getElementById('btn-repisas');
let items = [];
let sortMode = 'nombre'; // 'nombre' | 'fecha' | 'nota'

const SORT_LABEL = {
  nombre: 'Ordenar: Nombre',
  fecha: 'Ordenar: Fecha (recientes primero)',
  nota: 'Ordenar: Nota (mejor primero)',
};

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  const [coleccion, repisas] = await Promise.all([api.listarColeccion(), getRepisas(true)]);
  items = coleccion;
  searchInput.value = '';
  filtroRepisa.innerHTML = '<option value="">Todas las repisas</option>'
    + repisas.map((r) => `<option value="${r.id}">${escapeHtml(r.nombre)}</option>`).join('');
  refresh();
}

function currentFiltered() {
  const q = normalizarNombre(searchInput.value);
  let list = items;
  if (q) {
    list = list.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)
      || normalizarNombre(p.referencia || '').includes(q));
  }
  if (filtroRepisa.value) {
    list = list.filter((p) => p.repisa_id === filtroRepisa.value);
  }
  list = [...list];
  if (sortMode === 'fecha') {
    list.sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
  } else if (sortMode === 'nota') {
    list.sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
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
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-meta">
        <span class="chip chip-price">${formatCLP(p.precio)}</span>
        <span class="chip chip-buy">${escapeHtml(p.tienda_nombre || p.canal_compra || '—')}</span>
        <span class="chip chip-ok">${formatFecha(p.fecha_compra)}</span>
        ${p.repisa_nombre ? `<span class="chip chip-try">🗄 ${escapeHtml(p.repisa_nombre)}</span>` : ''}
        ${p.nota != null ? `<span class="chip chip-prioridad">⭐ ${p.nota}</span>` : ''}
      </div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-danger btn-sm" data-action="eliminar">Eliminar (devolución, error, etc.)</button>
      </div>
    </div>
  `).join('');
}

searchInput.addEventListener('input', refresh);
filtroRepisa.addEventListener('change', refresh);

sortBtn.addEventListener('click', () => {
  sortMode = sortMode === 'nombre' ? 'fecha' : sortMode === 'fecha' ? 'nota' : 'nombre';
  sortBtn.textContent = SORT_LABEL[sortMode];
  sortBtn.classList.toggle('active', sortMode !== 'nombre');
  refresh();
});

content.addEventListener('click', async (e) => {
  const card = e.target.closest('[data-id]');
  if (!card) return;
  const item = items.find((i) => i.id === card.dataset.id);
  if (!item) return;

  const btn = e.target.closest('button[data-action]');
  if (btn) {
    if (btn.dataset.action === 'eliminar') return handleEliminar(item);
    return;
  }

  handleEditar(item);
});

async function handleEliminar(item) {
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
}

async function handleEditar(item) {
  const repisas = await getRepisas();
  const el = openModal(`
    <h3>Editar — Colección</h3>
    <form id="form-editar-coleccion">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required value="${escapeHtml(item.nombre_perfume)}" />
      </div>
      <div class="form-row">
        <label>Referencia / a qué imita</label>
        <input type="text" name="referencia" value="${escapeHtml(item.referencia || '')}" />
      </div>
      <div class="form-row-inline">
        <div class="form-row">
          <label>Repisa</label>
          <select name="repisa_id">
            <option value="">Sin asignar</option>
            ${repisas.map((r) => `<option value="${r.id}" ${r.id === item.repisa_id ? 'selected' : ''}>${escapeHtml(r.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label>Nota (1-7)</label>
          <input type="number" name="nota" min="1" max="7" step="1" value="${item.nota ?? ''}" />
        </div>
      </div>
      <div class="form-row">
        <label>Comentario</label>
        <textarea name="comentario" rows="2">${escapeHtml(item.comentario || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-editar-coleccion').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const nota = fd.get('nota');
    try {
      await api.editarColeccion({
        p_coleccion_id: item.id,
        p_nombre_perfume: fd.get('nombre').trim(),
        p_referencia: fd.get('referencia') || null,
        p_comentario: fd.get('comentario') || null,
        p_repisa_id: fd.get('repisa_id') || null,
        p_nota: nota ? Number(nota) : null,
      });
      closeModal();
      toast('Guardado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

btnRepisas.addEventListener('click', abrirRepisas);

async function abrirRepisas() {
  const repisas = await getRepisas(true);
  const el = openModal(`
    <h3>🗄 Repisas</h3>
    <div id="repisas-lista" style="margin-bottom:14px;">
      ${repisas.length
        ? repisas.map((r) => `<div class="tienda-row"><span>${escapeHtml(r.nombre)}</span></div>`).join('')
        : '<p class="empty-state">No hay repisas todavía.</p>'}
    </div>
    <form id="form-nueva-repisa">
      <div class="form-row">
        <label>Nueva repisa</label>
        <input type="text" name="nombre" placeholder="Ej: Repisa 1" required autofocus />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cerrar">Cerrar</button>
        <button type="submit" class="btn btn-primary">Agregar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cerrar"]').addEventListener('click', closeModal);
  el.querySelector('#form-nueva-repisa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = new FormData(ev.target).get('nombre').trim();
    if (!nombre) return;
    try {
      await api.crearRepisa(nombre);
      invalidateRepisas();
      toast('Repisa creada');
      closeModal();
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}
