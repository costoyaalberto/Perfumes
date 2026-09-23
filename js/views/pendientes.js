import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { openModal, closeModal, confirmDialog } from '../modal.js';
import { storeAndPriceFieldsHtml, handleYaLoCompre } from './porProbar.js';
import { formatFecha, escapeHtml, normalizarNombre, toast } from '../utils.js';

const content = document.getElementById('pendientes-content');
const contentProbar = document.getElementById('pendientes-probar-content');
const contentAgotados = document.getElementById('agotados-content');
const contentMovimientos = document.getElementById('movimientos-content');
const badge = document.getElementById('badge-pendientes');
const searchInput = document.getElementById('buscar-pendientes');
const searchInputProbar = document.getElementById('buscar-pendientes-probar');
const searchInputAgotados = document.getElementById('buscar-agotados');
let items = [];
let itemsProbar = [];
let itemsAgotados = [];
let movimientos = [];

const TIPO_LABEL = {
  rechazo: 'Lista Negra',
  compra: 'Colección',
  pendiente_compra: 'Pendientes de Compra',
};

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  contentProbar.innerHTML = '<p class="empty-state">Cargando…</p>';
  contentAgotados.innerHTML = '<p class="empty-state">Cargando…</p>';
  contentMovimientos.innerHTML = '<p class="empty-state">Cargando…</p>';
  searchInput.value = '';
  searchInputProbar.value = '';
  searchInputAgotados.value = '';
  [items, itemsProbar, itemsAgotados, movimientos] = await Promise.all([
    api.listarPendientes(),
    api.listarPendientesProbar(),
    api.listarAgotados(),
    api.listarMovimientosRecientes(),
  ]);
  updateBadge();
  drawPendientes();
  drawPendientesProbar();
  drawAgotados();

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

function drawAgotados() {
  const q = normalizarNombre(searchInputAgotados.value);
  const list = q ? itemsAgotados.filter((p) => normalizarNombre(p.nombre_perfume).includes(q)) : itemsAgotados;
  contentAgotados.innerHTML = list.length
    ? list.map(cardHtmlAgotado).join('')
    : `<p class="empty-state">${itemsAgotados.length ? 'Sin resultados.' : 'No tienes perfumes marcados como agotados en general.'}</p>`;
}

searchInput.addEventListener('input', drawPendientes);
searchInputProbar.addEventListener('input', drawPendientesProbar);
searchInputAgotados.addEventListener('input', drawAgotados);

document.getElementById('btn-exportar-pendientes-probar').addEventListener('click', () => {
  exportarListadoNombres(itemsProbar, 'Pendientes por Probar');
});

document.getElementById('btn-exportar-agotados').addEventListener('click', () => {
  exportarListadoNombres(itemsAgotados, 'Agotados');
});

function exportarListadoNombres(lista, titulo) {
  if (!lista.length) {
    toast(`No hay perfumes en "${titulo}" para exportar`, true);
    return;
  }
  const texto = lista.map((p) => p.nombre_perfume).join('\n');
  const el = openModal(`
    <h3>Exportar — ${escapeHtml(titulo)}</h3>
    <textarea id="export-listado-texto" rows="14" readonly
      style="width:100%; font-family:ui-monospace,monospace; font-size:0.8rem; white-space:pre-wrap;">${escapeHtml(texto)}</textarea>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="cerrar">Cerrar</button>
      <button type="button" class="btn btn-primary" data-action="copiar">Copiar</button>
    </div>
  `);
  el.querySelector('[data-action="cerrar"]').addEventListener('click', closeModal);
  el.querySelector('[data-action="copiar"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast('Copiado al portapapeles');
    } catch (err) {
      el.querySelector('#export-listado-texto').select();
      toast('No se pudo copiar automático — seleccionamos el texto, cópialo con Ctrl/Cmd+C', true);
    }
  });
}

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
      ${p.es_tester ? '<div class="alert-tester">🧪 Pedir el TESTER al comprar</div>' : ''}
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-store-line">🛒 Comprar en: <strong>${escapeHtml(p.donde_comprar_tienda_nombre || p.donde_comprar || 'Sin definir (toca para editar)')}</strong></div>
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
        <button class="btn btn-outline btn-sm" data-action="agotado-general">Agotado en general</button>
        <button class="btn btn-danger btn-sm" data-action="eliminar-probar">Eliminar</button>
      </div>
    </div>
  `;
}

function cardHtmlAgotado(p) {
  return `
    <div class="card card-clickable" data-id-agotado="${p.id}">
      <div class="card-title">${escapeHtml(p.nombre_perfume)}</div>
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
      <div class="card-meta">
        <span class="chip chip-warn">Agotado desde ${formatFecha(p.fecha)}</span>
      </div>
      ${p.comentario ? `<div class="card-comment">${escapeHtml(p.comentario)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-success btn-sm" data-action="revisar-agotado">Revisar de nuevo</button>
        <button class="btn btn-danger btn-sm" data-action="eliminar-agotado">Eliminar</button>
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
    if (btn.dataset.action === 'ya-lo-compre') return handleYaLoCompre(item, render);
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
    if (btn.dataset.action === 'agotado-general') return handleAgotadoGeneral(item);
    if (btn.dataset.action === 'eliminar-probar') return handleEliminarProbar(item);
    return;
  }

  handleEditarPendienteProbar(item);
});

contentAgotados.addEventListener('click', async (e) => {
  const card = e.target.closest('[data-id-agotado]');
  if (!card) return;
  const item = itemsAgotados.find((i) => i.id === card.dataset.idAgotado);
  if (!item) return;

  const btn = e.target.closest('button[data-action]');
  if (btn) {
    if (btn.dataset.action === 'revisar-agotado') return handleRevisarAgotado(item);
    if (btn.dataset.action === 'eliminar-agotado') return handleEliminarAgotado(item);
    return;
  }

  handleEditarAgotado(item);
});

async function handleEditarPendienteCompra(item) {
  const tiendas = await getTiendas();
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
        <select name="donde_comprar_tienda_id">
          <option value="">Otro / tienda online (especifica abajo)</option>
          ${tiendas.map((t) => `<option value="${t.id}" ${t.id === item.donde_comprar_tienda_id ? 'selected' : ''}>${escapeHtml(t.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>Canal (si no es una tienda del catálogo)</label>
        <input type="text" name="donde_comprar" placeholder="Ej: AliExpress, Falabella online..." value="${escapeHtml(item.donde_comprar || '')}" />
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
        p_donde_comprar_tienda_id: fd.get('donde_comprar_tienda_id') || null,
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

async function handleAgotadoGeneral(item) {
  const ok = await confirmDialog({
    title: 'Agotado en general',
    message: `¿"${escapeHtml(item.nombre_perfume)}" ya lo buscaste en varias tiendas y no aparece en ninguna? Se moverá a "Agotados" para revisarlo solo de vez en cuando.`,
    confirmLabel: 'Marcar agotado',
  });
  if (!ok) return;
  try {
    await api.marcarAgotadoGeneral(item.id);
    toast('Movido a Agotados');
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
}

async function handleEditarAgotado(item) {
  const el = openModal(`
    <h3>Editar — Agotado</h3>
    <form id="form-editar-agotado">
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
  el.querySelector('#form-editar-agotado').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.editarAgotado({
        p_agotado_id: item.id,
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

async function handleRevisarAgotado(item) {
  const tiendas = (await getTiendas()).filter((t) => t.activa);
  if (!tiendas.length) {
    toast('Primero agrega al menos una tienda activa en la pestaña Tiendas', true);
    return;
  }
  const el = openModal(`
    <h3>Revisar de nuevo — ${escapeHtml(item.nombre_perfume)}</h3>
    <p class="import-format">Vuelve a "Por Probar" en la tienda que elijas.</p>
    <form id="form-revisar-agotado">
      ${storeAndPriceFieldsHtml(tiendas, { comentario: item.comentario })}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Volver a Por Probar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-revisar-agotado').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.revisarAgotado({
        p_agotado_id: item.id,
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

async function handleEliminarAgotado(item) {
  const ok = await confirmDialog({
    title: 'Eliminar definitivamente',
    message: `¿Eliminar "${escapeHtml(item.nombre_perfume)}" de Agotados? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!ok) return;
  try {
    await api.eliminarAgotado(item.id);
    toast('Eliminado');
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
}
