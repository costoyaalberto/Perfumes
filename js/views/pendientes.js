import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { openModal, closeModal, confirmDialog } from '../modal.js';
import { storeAndPriceFieldsHtml } from './porProbar.js';
import { formatFecha, escapeHtml, normalizarNombre, toast } from '../utils.js';

const content = document.getElementById('pendientes-content');
const contentProbar = document.getElementById('pendientes-probar-content');
const contentMovimientos = document.getElementById('movimientos-content');
const badge = document.getElementById('badge-pendientes');
const searchInput = document.getElementById('buscar-pendientes');
const searchInputProbar = document.getElementById('buscar-pendientes-probar');
let items = [];
let itemsProbar = [];
let movimientos = [];

const TIPO_LABEL = {
  rechazo: 'Lista Negra',
  compra: 'Colección',
  pendiente_compra: 'Pendientes de Compra',
};

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  contentProbar.innerHTML = '<p class="empty-state">Cargando…</p>';
  contentMovimientos.innerHTML = '<p class="empty-state">Cargando…</p>';
  searchInput.value = '';
  searchInputProbar.value = '';
  [items, itemsProbar, movimientos] = await Promise.all([
    api.listarPendientes(),
    api.listarPendientesProbar(),
    api.listarMovimientosRecientes(),
  ]);
  updateBadge();
  drawPendientes();
  drawPendientesProbar();

  contentMovimientos.innerHTML = movimientos.length
    ? movimientos.map(movimientoHtml).join('')
    : '<p class="empty-state">Sin movimientos en las últimas 48 horas.</p>';
}

function drawPendientes() {
  const q = normalizarNombre(searchInput.value);
  const list = q ? items.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)) : items;
  content.innerHTML = list.length
    ? list.map(cardHtml).join('')
    : `<p class="empty-state">${items.length ? 'Sin resultados.' : 'No tienes perfumes pendientes de compra.'}</p>`;
}

function drawPendientesProbar() {
  const q = normalizarNombre(searchInputProbar.value);
  const list = q ? itemsProbar.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)) : itemsProbar;
  contentProbar.innerHTML = list.length
    ? list.map(cardHtmlProbar).join('')
    : `<p class="empty-state">${itemsProbar.length ? 'Sin resultados.' : 'No tienes perfumes marcados como sin stock.'}</p>`;
}

searchInput.addEventListener('input', drawPendientes);
searchInputProbar.addEventListener('input', drawPendientesProbar);

function movimientoHtml(m) {
  return `
    <div class="movimiento-row" data-id-movimiento="${m.id}">
      <div class="movimiento-info">
        <span class="movimiento-nombre">${escapeHtml(m.nombre_perfume || '—')}</span>
        <span class="movimiento-meta">Movido a ${escapeHtml(TIPO_LABEL[m.tipo] || m.tipo)} · ${formatFecha(m.creado_en)}</span>
      </div>
      <button class="btn btn-outline btn-sm" data-action="deshacer-movimiento">Deshacer</button>
    </div>
  `;
}

contentMovimientos.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="deshacer-movimiento"]');
  if (!btn) return;
  const row = e.target.closest('[data-id-movimiento]');
  try {
    await api.deshacerMovimiento(row.dataset.idMovimiento);
    toast('Movimiento deshecho');
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

function updateBadge() {
  const total = items.length + itemsProbar.length;
  if (total) {
    badge.textContent = total;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function cardHtml(p) {
  return `
    <div class="card card-clickable" data-id="${p.id}">
      <div class="card-title">${escapeHtml(p.nombre_perfume)}</div>
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-store-line">🛒 Comprar en: <strong>${escapeHtml(p.donde_comprar || 'Sin definir (toca para editar)')}</strong></div>
      <div class="card-meta">
        <span class="chip chip-try">Probado en ${escapeHtml(p.tienda_nombre || '—')}</span>
        <span class="chip chip-price">${formatFecha(p.fecha_prueba)}</span>
      </div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-success btn-sm" data-action="ya-lo-compre">Ya lo compré</button>
      </div>
    </div>
  `;
}

function cardHtmlProbar(p) {
  return `
    <div class="card card-clickable" data-id-probar="${p.id}">
      <div class="card-title">${escapeHtml(p.nombre_perfume)}</div>
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-store-line">📍 Sin stock en: <strong>${escapeHtml(p.tienda_nombre || '—')}</strong></div>
      <div class="card-meta">
        <span class="chip chip-price">${formatFecha(p.fecha)}</span>
      </div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-success btn-sm" data-action="volvio">Ya volvió</button>
        <button class="btn btn-danger btn-sm" data-action="eliminar-probar">Eliminar</button>
      </div>
    </div>
  `;
}

content.addEventListener('click', async (e) => {
  const card = e.target.closest('[data-id]');
  if (!card) return;
  const item = items.find((i) => i.id === card.dataset.id);
  if (!item) return;

  const btn = e.target.closest('button[data-action]');
  if (btn) {
    if (btn.dataset.action === 'ya-lo-compre') return handleYaLoCompre(item);
    return;
  }

  handleEditarPendienteCompra(item);
});

contentProbar.addEventListener('click', async (e) => {
  const card = e.target.closest('[data-id-probar]');
  if (!card) return;
  const item = itemsProbar.find((i) => i.id === card.dataset.idProbar);
  if (!item) return;

  const btn = e.target.closest('button[data-action]');
  if (btn) {
    if (btn.dataset.action === 'volvio') return handleVolvio(item);
    if (btn.dataset.action === 'eliminar-probar') return handleEliminarProbar(item);
    return;
  }

  handleEditarPendienteProbar(item);
});

async function handleYaLoCompre(item) {
  const tiendas = await getTiendas();
  const el = openModal(`
    <h3>Ya lo compré — ${escapeHtml(item.nombre_perfume)}</h3>
    <form id="form-ya-lo-compre">
      <div class="form-row">
        <label>¿Dónde lo compraste?</label>
        <select name="tienda_id">
          <option value="">Otro / tienda online (especifica abajo)</option>
          ${tiendas.map((t) => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Canal (si no es una tienda del catálogo)</label>
        <input type="text" name="canal_compra" placeholder="Ej: AliExpress, Falabella online..." value="${escapeHtml(item.donde_comprar || '')}" />
      </div>
      <div class="form-row">
        <label>Precio</label>
        <input type="number" name="precio" min="0" step="1" required />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-success">Mover a Colección</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-ya-lo-compre').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.yaLoCompre({
        p_pendiente_id: item.id,
        p_tienda_compra_id: fd.get('tienda_id') || null,
        p_canal_compra: fd.get('canal_compra') || null,
        p_precio: Number(fd.get('precio')),
      });
      closeModal();
      toast('Movido a Colección 🎉');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

async function handleEditarPendienteCompra(item) {
  const el = openModal(`
    <h3>Editar pendiente de compra</h3>
    <form id="form-editar-pendiente">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required value="${escapeHtml(item.nombre_perfume)}" />
      </div>
      <div class="form-row">
        <label>Referencia / a qué imita</label>
        <input type="text" name="referencia" value="${escapeHtml(item.referencia || '')}" />
      </div>
      <div class="form-row">
        <label>¿Dónde piensas comprarlo?</label>
        <input type="text" name="donde_comprar" placeholder="Ej: Tienda X, Online, Falabella..." value="${escapeHtml(item.donde_comprar || '')}" />
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
      title: 'Eliminar pendiente de compra',
      message: `¿Eliminar "${escapeHtml(item.nombre_perfume)}" de Pendientes de Compra? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.eliminarPendienteCompra(item.id);
      closeModal();
      toast('Eliminado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
  el.querySelector('#form-editar-pendiente').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.editarPendienteCompra({
        p_pendiente_id: item.id,
        p_nombre_perfume: fd.get('nombre').trim(),
        p_referencia: fd.get('referencia') || null,
        p_comentario: fd.get('comentario') || null,
        p_donde_comprar: fd.get('donde_comprar') || null,
      });
      closeModal();
      toast('Guardado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

async function handleEditarPendienteProbar(item) {
  const el = openModal(`
    <h3>Editar — sin stock</h3>
    <form id="form-editar-pendiente-probar">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required value="${escapeHtml(item.nombre_perfume)}" />
      </div>
      <div class="form-row">
        <label>Referencia / a qué imita</label>
        <input type="text" name="referencia" value="${escapeHtml(item.referencia || '')}" />
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
  el.querySelector('#form-editar-pendiente-probar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.editarPendienteProbar({
        p_pendiente_probar_id: item.id,
        p_nombre_perfume: fd.get('nombre').trim(),
        p_referencia: fd.get('referencia') || null,
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

async function handleVolvio(item) {
  const tiendas = (await getTiendas()).filter((t) => t.activa);
  if (!tiendas.length) {
    toast('Primero agrega al menos una tienda activa en la pestaña Tiendas', true);
    return;
  }
  const el = openModal(`
    <h3>Volvió a aparecer — ${escapeHtml(item.nombre_perfume)}</h3>
    <p class="import-format">Estaba sin stock en <strong>${escapeHtml(item.tienda_nombre || '—')}</strong> —
      dejamos esa tienda preseleccionada por si reapareció ahí mismo; cambia la opción si fue en otro lado.</p>
    <form id="form-volvio">
      ${storeAndPriceFieldsHtml(tiendas, { tienda_id: item.tienda_agotado_id, comentario: item.comentario })}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Volver a Por Probar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-volvio').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.volverAPorProbar({
        p_pendiente_probar_id: item.id,
        p_tienda_id: fd.get('tienda_id'),
        p_precio: fd.get('precio') ? Number(fd.get('precio')) : null,
        p_comentario: fd.get('comentario') || null,
        p_disponibilidad: fd.get('disponibilidad'),
        p_modalidad: fd.get('modalidad'),
      });
      closeModal();
      toast('De vuelta en Por Probar');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

async function handleEliminarProbar(item) {
  const ok = await confirmDialog({
    title: 'Eliminar definitivamente',
    message: `¿Eliminar "${escapeHtml(item.nombre_perfume)}" de Pendientes por Probar? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.eliminarPendienteProbar(item.id);
    toast('Eliminado');
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
}
