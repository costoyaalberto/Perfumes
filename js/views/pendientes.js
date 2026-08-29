import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { openModal, closeModal } from '../modal.js';
import { formatFecha, escapeHtml, toast } from '../utils.js';

const content = document.getElementById('pendientes-content');
const badge = document.getElementById('badge-pendientes');
let items = [];

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  items = await api.listarPendientes();
  updateBadge();
  if (!items.length) {
    content.innerHTML = '<p class="empty-state">No tienes perfumes pendientes de compra.</p>';
    return;
  }
  content.innerHTML = items.map(cardHtml).join('');
}

function updateBadge() {
  if (items.length) {
    badge.textContent = items.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function cardHtml(p) {
  return `
    <div class="card" data-id="${p.id}">
      <div class="card-title">${escapeHtml(p.nombre_perfume)}</div>
      ${p.referencia ? `<div class="card-ref">Ref: ${escapeHtml(p.referencia)}</div>` : ''}
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

content.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="ya-lo-compre"]');
  if (!btn) return;
  const card = e.target.closest('[data-id]');
  const item = items.find((i) => i.id === card.dataset.id);
  if (item) handleYaLoCompre(item);
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
        <input type="text" name="canal_compra" placeholder="Ej: AliExpress, Falabella online..." />
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
