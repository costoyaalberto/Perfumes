import { api } from '../api.js';
import { getTiendas, invalidateTiendas } from '../store.js';
import { openModal, closeModal } from '../modal.js';
import { escapeHtml, toast } from '../utils.js';

const content = document.getElementById('tiendas-content');

export async function render() {
  content.innerHTML = '<p class="empty-state">Cargando…</p>';
  const tiendas = await getTiendas(true);
  if (!tiendas.length) {
    content.innerHTML = '<p class="empty-state">No hay tiendas registradas. Toca "+ Tienda" para agregar la primera.</p>';
    return;
  }
  content.innerHTML = tiendas.map((t) => `
    <div class="tienda-row ${t.activa ? '' : 'inactiva'}" data-id="${t.id}">
      <span>${escapeHtml(t.nombre)}</span>
      <label class="switch">
        <input type="checkbox" data-action="toggle-activa" ${t.activa ? 'checked' : ''} />
        <span class="slider"></span>
      </label>
    </div>
  `).join('');
}

content.addEventListener('change', async (e) => {
  const checkbox = e.target.closest('[data-action="toggle-activa"]');
  if (!checkbox) return;
  const row = e.target.closest('[data-id]');
  try {
    await api.setTiendaActiva(row.dataset.id, checkbox.checked);
    row.classList.toggle('inactiva', !checkbox.checked);
    invalidateTiendas();
    toast('Tienda actualizada');
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    toast('Error: ' + err.message, true);
  }
});

document.getElementById('btn-nueva-tienda').addEventListener('click', () => {
  const el = openModal(`
    <h3>Nueva tienda</h3>
    <form id="form-nueva-tienda">
      <div class="form-row">
        <label>Nombre</label>
        <input type="text" name="nombre" required autofocus />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-nueva-tienda').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nombre = new FormData(ev.target).get('nombre').trim();
    if (!nombre) return;
    try {
      await api.crearTienda(nombre);
      invalidateTiendas();
      closeModal();
      toast('Tienda creada');
      render();
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
});
