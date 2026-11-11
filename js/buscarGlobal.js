import { api } from './api.js';
import { openModal, closeModal } from './modal.js';
import { escapeHtml, formatFecha } from './utils.js';

const ORIGEN_LABEL = {
  coleccion: 'Colección',
  lista_negra: 'Lista Negra',
  por_probar: 'Por Probar',
  pendientes_compra: 'Pendientes de Compra',
  sin_stock: 'Sin Stock',
  sin_probador: 'Sin Probador',
  agotados: 'Agotados',
};

const ORIGEN_ROUTE = {
  coleccion: 'coleccion',
  lista_negra: 'lista-negra',
  por_probar: 'por-probar',
  pendientes_compra: 'pendientes',
  sin_stock: 'pendientes',
  sin_probador: 'pendientes',
  agotados: 'pendientes',
};

export function initBuscarGlobal() {
  document.getElementById('btn-buscar-global').addEventListener('click', abrirBuscador);
}

function abrirBuscador() {
  const el = openModal(`
    <h3>🔍 Buscar en todo</h3>
    <p class="import-format">Busca por nombre o referencia en Colección, Lista Negra, Por Probar, Pendientes de Compra, Sin Stock, Sin Probador y Agotados a la vez.</p>
    <form id="form-buscar-global" onsubmit="return false;">
      <input id="buscar-global-input" class="search-input" type="search" placeholder="Nombre o referencia..." style="width:100%;" autofocus />
    </form>
    <div id="buscar-global-resultados" class="content" style="margin-top:14px;"></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-secondary" data-action="cerrar">Cerrar</button>
    </div>
  `);
  const input = el.querySelector('#buscar-global-input');
  const resultados = el.querySelector('#buscar-global-resultados');
  el.querySelector('[data-action="cerrar"]').addEventListener('click', closeModal);

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) {
      resultados.innerHTML = '';
      return;
    }
    timer = setTimeout(() => ejecutarBusqueda(q, resultados), 300);
  });
}

async function ejecutarBusqueda(q, resultados) {
  resultados.innerHTML = '<p class="empty-state">Buscando…</p>';
  try {
    const rows = await api.buscarGlobal(q);
    if (!rows.length) {
      resultados.innerHTML = '<p class="empty-state">Sin resultados.</p>';
      return;
    }
    resultados.innerHTML = rows.map(filaHtml).join('');
    resultados.querySelectorAll('[data-route-ir]').forEach((card) => {
      card.addEventListener('click', () => {
        closeModal();
        document.querySelector(`[data-route="${card.dataset.routeIr}"]`)?.click();
      });
    });
  } catch (err) {
    resultados.innerHTML = `<p class="empty-state">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function filaHtml(r) {
  const ruta = ORIGEN_ROUTE[r.origen] || 'por-probar';
  return `
    <div class="card card-clickable" data-route-ir="${ruta}">
      <div class="card-title-row">
        <div class="card-title">${escapeHtml(r.nombre_perfume)}</div>
        <span class="chip chip-try">${escapeHtml(ORIGEN_LABEL[r.origen] || r.origen)}</span>
      </div>
      ${r.referencia ? `<div class="card-ref">Ref: ${escapeHtml(r.referencia)}</div>` : ''}
      <div class="card-meta">
        ${r.tienda_nombre ? `<span class="chip chip-price">${escapeHtml(r.tienda_nombre)}</span>` : ''}
        ${r.fecha ? `<span class="chip chip-price">${formatFecha(r.fecha)}</span>` : ''}
        ${r.extra ? `<span class="chip chip-warn">${escapeHtml(r.extra)}</span>` : ''}
      </div>
    </div>
  `;
}
