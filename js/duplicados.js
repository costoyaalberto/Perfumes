import { api } from './api.js';
import { esNombreSimilar, formatFecha, escapeHtml } from './utils.js';

const FUENTE_LABEL = {
  coleccion: 'tu colección',
  lista_negra: 'tu lista negra',
  pendientes_compra: 'pendientes de compra',
  por_probar: 'por probar',
};

export async function buscarCoincidencias(nombre) {
  if (!nombre || !nombre.trim()) return [];
  const candidatos = await api.listarCandidatosDuplicado();
  return candidatos.filter((c) => esNombreSimilar(c.nombre_perfume, nombre));
}

export function renderCoincidenciasHtml(matches) {
  if (!matches.length) return '';
  const items = matches.map((m) => {
    const fuente = FUENTE_LABEL[m.fuente] || m.fuente;
    let detalle = `Ya está en ${fuente}`;
    if (m.fuente === 'coleccion') detalle += ` (comprado el ${formatFecha(m.fecha)})`;
    if (m.fuente === 'lista_negra') detalle += ` — rechazado el ${formatFecha(m.fecha)} por: ${escapeHtml(m.motivo || '')}`;
    if (m.fuente === 'pendientes_compra') detalle += ` (probado en ${escapeHtml(m.tienda_nombre || '—')} el ${formatFecha(m.fecha)})`;
    if (m.fuente === 'por_probar') detalle += ` (listado en ${escapeHtml(m.tienda_nombre || '—')})`;
    return `<li><strong>${escapeHtml(m.nombre_perfume)}</strong>: ${detalle}</li>`;
  }).join('');
  return `<div class="warning-box"><strong>⚠ Posibles coincidencias encontradas:</strong><ul>${items}</ul></div>`;
}
