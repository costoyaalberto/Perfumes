import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { openModal, closeModal, confirmDialog } from '../modal.js';
import { buscarCoincidencias, renderCoincidenciasHtml } from '../duplicados.js';
import { formatCLP, escapeHtml, normalizarNombre, toast, toastConAccion } from '../utils.js';

const content = document.getElementById('por-probar-content');
const searchInput = document.getElementById('buscar-por-probar');
const btnFiltroSinProbador = document.getElementById('btn-filtro-sin-probador');
const btnFiltroDestacado = document.getElementById('btn-filtro-destacado');

let rows = [];
const collapsedTiendas = new Set();
let searchQuery = '';
let onlySinProbador = false;
let onlyDestacado = false;

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  const [rowsResult, contadores] = await Promise.all([
    api.listarPorProbar(),
    api.obtenerContadores(),
  ]);
  rows = rowsResult;
  actualizarContadores(contadores);
  draw();
}

function actualizarContadores(contadores) {
  const c = (contadores && contadores[0]) || {};
  document.getElementById('stat-por-probar').textContent = c.por_probar_count ?? '—';
  document.getElementById('stat-coleccion').textContent = c.coleccion_count ?? '—';
  document.getElementById('stat-lista-negra').textContent = c.lista_negra_count ?? '—';
}

function draw() {
  if (!rows.length) {
    content.innerHTML = '<p class="empty-state">No tienes perfumes por probar todavía. Toca "+ Nuevo" para agregar uno.</p>';
    return;
  }
  const q = normalizarNombre(searchQuery);
  let filtered = rows;
  if (onlySinProbador) filtered = filtered.filter((r) => r.disponibilidad === 'sin_probador');
  if (onlyDestacado) filtered = filtered.filter((r) => r.destacado);
  if (q) filtered = filtered.filter((r) => normalizarNombre(r.nombre_perfume).includes(q));

  if (!filtered.length) {
    content.innerHTML = '<p class="empty-state">Sin resultados con ese filtro.</p>';
    return;
  }

  const grupos = new Map();
  for (const r of filtered) {
    if (!grupos.has(r.tienda_nombre)) grupos.set(r.tienda_nombre, []);
    grupos.get(r.tienda_nombre).push(r);
  }
  const html = [...grupos.entries()].map(([tienda, items]) => {
    const collapsed = collapsedTiendas.has(tienda);
    return `
    <div class="store-group ${collapsed ? 'collapsed' : ''}" data-tienda="${escapeHtml(tienda)}">
      <h3>
        <span>${escapeHtml(tienda)} <span style="font-weight:400;color:var(--muted);font-size:0.85rem;">(${items.length})</span></span>
        <span class="chevron">▾</span>
      </h3>
      <div class="store-cards">${items.map(cardHtml).join('')}</div>
    </div>
  `;
  }).join('');
  content.innerHTML = html;
}

function cardHtml(r) {
  const dispChip = r.disponibilidad === 'con_probador'
    ? '<span class="chip chip-ok">Con probador</span>'
    : '<span class="chip chip-warn">Sin probador</span>';
  const modChip = r.modalidad === 'comprar_aqui'
    ? '<span class="chip chip-buy">Comprar aquí</span>'
    : '<span class="chip chip-try">Solo probar</span>';
  return `
    <div class="card card-clickable ${r.destacado ? 'card-destacado' : ''}" data-ppt-id="${r.por_probar_tienda_id}">
      <div class="card-title-row">
        <div class="card-title">${escapeHtml(r.nombre_perfume)}</div>
        <button type="button" class="star-btn ${r.destacado ? 'active' : ''}" data-action="destacado" title="Destacar">${r.destacado ? '★' : '☆'}</button>
      </div>
      ${r.referencia ? `<div class="card-ref">Ref: ${escapeHtml(r.referencia)}</div>` : ''}
      <div class="card-meta">
        <span class="chip chip-price">${formatCLP(r.precio)}</span>
        ${dispChip}
        ${modChip}
      </div>
      ${r.comentario ? `<div class="card-comment">${escapeHtml(r.comentario)}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-success btn-sm" data-action="me-gusto">Me gustó</button>
        <button class="btn btn-danger btn-sm" data-action="no-me-gusto">No me gustó</button>
        ${r.disponibilidad === 'con_probador' ? '<button class="btn btn-outline btn-sm" data-action="sin-probador">Sin probador</button>' : ''}
        <button class="btn btn-outline btn-sm" data-action="agregar-tienda">+ Otra tienda</button>
      </div>
    </div>
  `;
}

function findRow(pptId) {
  return rows.find((r) => r.por_probar_tienda_id === pptId);
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  draw();
});

btnFiltroSinProbador.addEventListener('click', () => {
  onlySinProbador = !onlySinProbador;
  btnFiltroSinProbador.classList.toggle('active', onlySinProbador);
  draw();
});

btnFiltroDestacado.addEventListener('click', () => {
  onlyDestacado = !onlyDestacado;
  btnFiltroDestacado.classList.toggle('active', onlyDestacado);
  draw();
});

content.addEventListener('click', async (e) => {
  const h3 = e.target.closest('.store-group h3');
  if (h3) {
    const group = h3.closest('.store-group');
    const tienda = group.dataset.tienda;
    if (collapsedTiendas.has(tienda)) collapsedTiendas.delete(tienda);
    else collapsedTiendas.add(tienda);
    group.classList.toggle('collapsed');
    return;
  }

  const card = e.target.closest('[data-ppt-id]');
  if (!card) return;
  const row = findRow(card.dataset.pptId);
  if (!row) return;

  const btn = e.target.closest('button[data-action]');
  if (btn) {
    if (btn.dataset.action === 'me-gusto') return handleMeGusto(row);
    if (btn.dataset.action === 'no-me-gusto') return handleNoMeGusto(row);
    if (btn.dataset.action === 'sin-probador') return handleSinProbador(row);
    if (btn.dataset.action === 'agregar-tienda') return handleAgregarTienda(row);
    if (btn.dataset.action === 'destacado') return handleToggleDestacado(row);
    return;
  }

  handleEditar(row);
});

async function handleToggleDestacado(row) {
  try {
    await api.toggleDestacado(row.por_probar_id, !row.destacado);
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
}

async function handleEditar(row) {
  const el = openModal(`
    <h3>Editar — ${escapeHtml(row.tienda_nombre)}</h3>
    <form id="form-editar">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required value="${escapeHtml(row.nombre_perfume)}" />
      </div>
      <div class="form-row">
        <label>Referencia / a qué imita</label>
        <input type="text" name="referencia" value="${escapeHtml(row.referencia || '')}" />
      </div>
      <p class="import-format">El nombre y la referencia se comparten si este perfume está listado en más de una tienda.</p>
      <div class="form-row">
        <label>Precio en ${escapeHtml(row.tienda_nombre)}</label>
        <input type="number" name="precio" min="0" step="1" value="${row.precio ?? ''}" />
      </div>
      <div class="form-row">
        <label>Comentario</label>
        <textarea name="comentario" rows="2">${escapeHtml(row.comentario || '')}</textarea>
      </div>
      <div class="form-row">
        <label>Disponibilidad</label>
        <div class="radio-group">
          <label><input type="radio" name="disponibilidad" value="con_probador" ${row.disponibilidad === 'con_probador' ? 'checked' : ''} /> Con probador</label>
          <label><input type="radio" name="disponibilidad" value="sin_probador" ${row.disponibilidad === 'sin_probador' ? 'checked' : ''} /> Sin probador</label>
        </div>
      </div>
      <div class="form-row">
        <label>Modalidad</label>
        <div class="radio-group">
          <label><input type="radio" name="modalidad" value="comprar_aqui" ${row.modalidad === 'comprar_aqui' ? 'checked' : ''} /> Comprar aquí</label>
          <label><input type="radio" name="modalidad" value="solo_probar" ${row.modalidad === 'solo_probar' ? 'checked' : ''} /> Solo probar</label>
        </div>
      </div>
      <div class="modal-actions" style="justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" data-action="cambiar-tienda">Cambiar tienda</button>
          <button type="button" class="btn btn-outline btn-sm" data-action="agotado">Sin stock</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="eliminar">Quitar de esta tienda</button>
        </div>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('[data-action="cambiar-tienda"]').addEventListener('click', () => handleCambiarTienda(row));
  el.querySelector('[data-action="agotado"]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Marcar sin stock',
      message: `"${escapeHtml(row.nombre_perfume)}" se quitará de todas las tiendas donde estaba listado y pasará a "Pendientes por Probar" para revisarlo más adelante.`,
      confirmLabel: 'Mover a Pendientes',
    });
    if (!ok) return;
    try {
      await api.marcarAgotado(row.por_probar_tienda_id);
      closeModal();
      toast('Movido a Pendientes por Probar');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
  el.querySelector('[data-action="eliminar"]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Quitar de esta tienda',
      message: `¿Quitar "${escapeHtml(row.nombre_perfume)}" de ${escapeHtml(row.tienda_nombre)}? No se mueve a colección ni a lista negra, solo se borra esta tienda.`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.eliminarPorProbarTienda(row.por_probar_tienda_id);
      closeModal();
      toast('Eliminado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
  el.querySelector('#form-editar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.editarPorProbar({
        p_por_probar_tienda_id: row.por_probar_tienda_id,
        p_nombre_perfume: fd.get('nombre').trim(),
        p_referencia: fd.get('referencia') || null,
        p_precio: fd.get('precio') ? Number(fd.get('precio')) : null,
        p_comentario: fd.get('comentario') || null,
        p_disponibilidad: fd.get('disponibilidad'),
        p_modalidad: fd.get('modalidad'),
      });
      closeModal();
      toast('Guardado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

// Para cuando el usuario SABE dónde reapareció el perfume (a diferencia de
// "Sin stock", que es para cuando no sabe y hay que ir a buscarlo).
async function handleCambiarTienda(row) {
  const todasTiendas = await getTiendas();
  const yaListadas = new Set(rows.filter((r) => r.por_probar_id === row.por_probar_id).map((r) => r.tienda_id));
  const disponibles = todasTiendas.filter((t) => t.activa && !yaListadas.has(t.id));
  if (!disponibles.length) {
    toast('No hay otra tienda activa disponible para mover este perfume', true);
    return;
  }
  const el = openModal(`
    <h3>Cambiar tienda — ${escapeHtml(row.nombre_perfume)}</h3>
    <p class="import-format">Se mantiene el precio, comentario y modalidad; la disponibilidad vuelve a "con probador".</p>
    <form id="form-cambiar-tienda">
      <div class="form-row">
        <label>Nueva tienda</label>
        <select name="tienda_id" required>
          ${disponibles.map((t) => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Cambiar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-cambiar-tienda').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.cambiarTienda({
        p_por_probar_tienda_id: row.por_probar_tienda_id,
        p_tienda_id: fd.get('tienda_id'),
      });
      closeModal();
      toast('Tienda cambiada');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

async function handleSinProbador(row) {
  const ok = await confirmDialog({
    title: 'Marcar sin probador',
    message: `¿Confirmas que "${escapeHtml(row.nombre_perfume)}" ya no tiene probador disponible en ${escapeHtml(row.tienda_nombre)}?`,
  });
  if (!ok) return;
  try {
    await api.marcarSinProbador(row.por_probar_tienda_id);
    toast('Actualizado');
    render();
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
}

async function handleMeGusto(row) {
  const esCompra = row.modalidad === 'comprar_aqui';
  const el = openModal(`
    <h3>Me gustó — ${escapeHtml(row.nombre_perfume)}</h3>
    ${esCompra
      ? `<p>Se moverá a tu <strong>Colección</strong>. Confirma el precio final de compra.</p>
         <form id="form-me-gusto">
           <div class="form-row">
             <label>Precio final</label>
             <input type="number" name="precio" min="0" step="1" value="${row.precio ?? ''}" required />
           </div>
           <div class="modal-actions">
             <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
             <button type="submit" class="btn btn-success">Mover a Colección</button>
           </div>
         </form>`
      : `<p>Se moverá a <strong>Pendientes de Compra</strong> (modalidad "solo probar").</p>
         <form id="form-me-gusto-pendiente">
           <div class="form-row">
             <label>¿Dónde piensas comprarlo? (opcional, se puede editar después)</label>
             <input type="text" name="donde_comprar" placeholder="Ej: Tienda X, Online, Falabella..." />
           </div>
           <div class="modal-actions">
             <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
             <button type="submit" class="btn btn-success">Mover a Pendientes</button>
           </div>
         </form>`}
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  if (esCompra) {
    el.querySelector('#form-me-gusto').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const precio = Number(new FormData(ev.target).get('precio'));
      try {
        const historialId = await api.meGusto(row.por_probar_tienda_id, precio, null);
        closeModal();
        avisarConDeshacer('Movido a Colección 🎉', historialId);
        render();
      } catch (err) {
        toast('Error: ' + err.message, true);
      }
    });
  } else {
    el.querySelector('#form-me-gusto-pendiente').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const dondeComprar = new FormData(ev.target).get('donde_comprar');
      try {
        const historialId = await api.meGusto(row.por_probar_tienda_id, null, dondeComprar || null);
        closeModal();
        avisarConDeshacer('Movido a Pendientes de Compra', historialId);
        render();
      } catch (err) {
        toast('Error: ' + err.message, true);
      }
    });
  }
}

function avisarConDeshacer(mensaje, historialId) {
  if (!historialId) {
    toast(mensaje);
    return;
  }
  toastConAccion(mensaje, 'Deshacer', async () => {
    try {
      await api.deshacerMovimiento(historialId);
      toast('Movimiento deshecho');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

async function handleNoMeGusto(row) {
  const el = openModal(`
    <h3>No me gustó — ${escapeHtml(row.nombre_perfume)}</h3>
    <p>Se moverá a la <strong>Lista Negra</strong> y se quitará de todas las tiendas donde estaba listado.</p>
    <form id="form-no-me-gusto">
      <div class="form-row">
        <label>Motivo (obligatorio)</label>
        <textarea name="motivo" rows="3" required></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-danger">Mover a Lista Negra</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-no-me-gusto').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const motivo = new FormData(ev.target).get('motivo').trim();
    if (!motivo) return;
    try {
      const historialId = await api.noMeGusto(row.por_probar_tienda_id, motivo);
      closeModal();
      avisarConDeshacer('Movido a Lista Negra', historialId);
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

async function handleAgregarTienda(row) {
  const todasTiendas = await getTiendas();
  const yaListadas = new Set(rows.filter((r) => r.por_probar_id === row.por_probar_id).map((r) => r.tienda_id));
  const disponibles = todasTiendas.filter((t) => t.activa && !yaListadas.has(t.id));
  if (!disponibles.length) {
    toast('Ya está listado en todas las tiendas activas', true);
    return;
  }
  const el = openModal(`
    <h3>Agregar tienda — ${escapeHtml(row.nombre_perfume)}</h3>
    <form id="form-agregar-tienda">
      ${storeAndPriceFieldsHtml(disponibles)}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Agregar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-agregar-tienda').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await api.agregarTiendaAPorProbar({
        p_por_probar_id: row.por_probar_id,
        p_tienda_id: fd.get('tienda_id'),
        p_precio: fd.get('precio') ? Number(fd.get('precio')) : null,
        p_comentario: fd.get('comentario') || null,
        p_disponibilidad: fd.get('disponibilidad'),
        p_modalidad: fd.get('modalidad'),
      });
      closeModal();
      toast('Tienda agregada');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}

export function storeAndPriceFieldsHtml(tiendas, selected = {}) {
  const sel = {
    tienda_id: selected.tienda_id || '',
    precio: selected.precio ?? '',
    comentario: selected.comentario || '',
    disponibilidad: selected.disponibilidad || 'con_probador',
    modalidad: selected.modalidad || 'comprar_aqui',
  };
  return `
    <div class="form-row">
      <label>Tienda</label>
      <select name="tienda_id" required>
        ${tiendas.map((t) => `<option value="${t.id}" ${t.id === sel.tienda_id ? 'selected' : ''}>${escapeHtml(t.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="form-row-inline">
      <div class="form-row">
        <label>Precio</label>
        <input type="number" name="precio" min="0" step="1" value="${escapeHtml(sel.precio)}" />
      </div>
    </div>
    <div class="form-row">
      <label>Comentario</label>
      <textarea name="comentario" rows="2">${escapeHtml(sel.comentario)}</textarea>
    </div>
    <div class="form-row">
      <label>Disponibilidad</label>
      <div class="radio-group">
        <label><input type="radio" name="disponibilidad" value="con_probador" ${sel.disponibilidad === 'con_probador' ? 'checked' : ''} /> Con probador</label>
        <label><input type="radio" name="disponibilidad" value="sin_probador" ${sel.disponibilidad === 'sin_probador' ? 'checked' : ''} /> Sin probador</label>
      </div>
    </div>
    <div class="form-row">
      <label>Modalidad</label>
      <div class="radio-group">
        <label><input type="radio" name="modalidad" value="comprar_aqui" ${sel.modalidad === 'comprar_aqui' ? 'checked' : ''} /> Comprar aquí</label>
        <label><input type="radio" name="modalidad" value="solo_probar" ${sel.modalidad === 'solo_probar' ? 'checked' : ''} /> Solo probar</label>
      </div>
    </div>
  `;
}

// ---------------- Nuevo perfume ----------------

document.getElementById('btn-nuevo-perfume').addEventListener('click', async () => {
  const tiendas = (await getTiendas()).filter((t) => t.activa);
  if (!tiendas.length) {
    toast('Primero agrega al menos una tienda activa en la pestaña Tiendas', true);
    return;
  }
  const el = openModal(`
    <h3>Nuevo perfume por probar</h3>
    <form id="form-nuevo-perfume">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required autofocus />
      </div>
      <div class="form-row">
        <label>Referencia / a qué imita (opcional)</label>
        <input type="text" name="referencia" />
      </div>
      ${storeAndPriceFieldsHtml(tiendas)}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);

  const form = el.querySelector('#form-nuevo-perfume');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const nombre = fd.get('nombre').trim();
    if (!nombre) return;

    const matches = await buscarCoincidencias(nombre);
    if (matches.length) {
      const proceed = await confirmDialog({
        title: 'Posible duplicado',
        message: renderCoincidenciasHtml(matches) + '¿Deseas agregarlo de todas formas?',
        confirmLabel: 'Continuar de todas formas',
      });
      // confirmDialog reutiliza el mismo overlay, así que reemplaza el
      // formulario en pantalla; si el usuario confirma, ya tenemos los
      // datos capturados en fd y podemos guardar directamente.
      if (!proceed) {
        reopenNuevoPerfumeModal(nombre, fd);
        return;
      }
    }

    try {
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      await api.crearPorProbar({
        p_nombre: nombre,
        p_referencia: fd.get('referencia') || null,
        p_tienda_id: fd.get('tienda_id'),
        p_precio: fd.get('precio') ? Number(fd.get('precio')) : null,
        p_comentario: fd.get('comentario') || null,
        p_disponibilidad: fd.get('disponibilidad'),
        p_modalidad: fd.get('modalidad'),
      });
      closeModal();
      toast('Perfume agregado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
});

async function reopenNuevoPerfumeModal(nombre, fd) {
  // El usuario canceló el aviso de duplicado: reabre el formulario con
  // los mismos valores para que pueda corregir el nombre si quiere.
  const tiendas = (await getTiendas()).filter((t) => t.activa);
  const el = openModal(`
    <h3>Nuevo perfume por probar</h3>
    <form id="form-nuevo-perfume">
      <div class="form-row">
        <label>Nombre del perfume</label>
        <input type="text" name="nombre" required value="${escapeHtml(nombre)}" />
      </div>
      <div class="form-row">
        <label>Referencia / a qué imita (opcional)</label>
        <input type="text" name="referencia" value="${escapeHtml(fd.get('referencia') || '')}" />
      </div>
      ${storeAndPriceFieldsHtml(tiendas, {
        tienda_id: fd.get('tienda_id'),
        precio: fd.get('precio'),
        comentario: fd.get('comentario'),
        disponibilidad: fd.get('disponibilidad'),
        modalidad: fd.get('modalidad'),
      })}
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar de todas formas</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-nuevo-perfume').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd2 = new FormData(ev.target);
    try {
      await api.crearPorProbar({
        p_nombre: fd2.get('nombre').trim(),
        p_referencia: fd2.get('referencia') || null,
        p_tienda_id: fd2.get('tienda_id'),
        p_precio: fd2.get('precio') ? Number(fd2.get('precio')) : null,
        p_comentario: fd2.get('comentario') || null,
        p_disponibilidad: fd2.get('disponibilidad'),
        p_modalidad: fd2.get('modalidad'),
      });
      closeModal();
      toast('Perfume agregado');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
}
