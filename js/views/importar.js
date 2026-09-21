import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { openModal, closeModal } from '../modal.js';
import { parseDelimitado, normalizarNombre, escapeHtml, formatCLP, toast } from '../utils.js';

const content = document.getElementById('importar-content');
let initialized = false;

document.getElementById('btn-exportar').addEventListener('click', async () => {
  try {
    const datos = await api.exportarDatos();
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const fecha = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perfumes-backup-${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup descargado');
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

document.getElementById('btn-reporte-seguimiento').addEventListener('click', async () => {
  try {
    const texto = await api.generarReporteSeguimiento(48);
    mostrarReporteSeguimiento(texto);
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

function mostrarReporteSeguimiento(texto) {
  const el = openModal(`
    <h3>Reporte de novedades (últimas 48h)</h3>
    <textarea id="reporte-texto" rows="14" readonly
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
      el.querySelector('#reporte-texto').select();
      toast('No se pudo copiar automático — seleccionamos el texto, cópialo con Ctrl/Cmd+C', true);
    }
  });
}

document.getElementById('btn-exportar-tienda').addEventListener('click', async () => {
  const tiendas = (await getTiendas()).filter((t) => t.activa);
  if (!tiendas.length) {
    toast('Primero agrega al menos una tienda activa en la pestaña Tiendas', true);
    return;
  }
  const el = openModal(`
    <h3>Exportar tienda</h3>
    <p class="import-format">Arma un texto con los perfumes "Por Probar" de la tienda elegida, para pasarle a una IA antes de ir a probar.</p>
    <form id="form-exportar-tienda">
      <div class="form-row">
        <label>Tienda</label>
        <select name="tienda_id" required>
          <option value="">Selecciona una tienda...</option>
          ${tiendas.map((t) => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Generar</button>
      </div>
    </form>
  `);
  el.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  el.querySelector('#form-exportar-tienda').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const tienda = tiendas.find((t) => t.id === fd.get('tienda_id'));
    if (!tienda) return;
    try {
      const rows = (await api.listarPorProbar()).filter((r) => r.tienda_id === tienda.id);
      const texto = buildExportTiendaTexto(tienda.nombre, rows);
      closeModal();
      mostrarExportTienda(tienda.nombre, texto);
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
});

function buildExportTiendaTexto(tiendaNombre, rows) {
  if (!rows.length) {
    return `No hay perfumes "Por Probar" en la tienda "${tiendaNombre}".`;
  }
  const lineas = rows.map((r, i) => {
    const partes = [`${i + 1}. ${r.nombre_perfume}`];
    if (r.referencia) partes.push(`   Referencia: ${r.referencia}`);
    if (r.precio != null) partes.push(`   Precio: ${formatCLP(r.precio)}`);
    partes.push(`   Disponibilidad: ${r.disponibilidad === 'con_probador' ? 'Con probador' : 'Sin probador'}`);
    partes.push(`   Modalidad: ${r.modalidad === 'comprar_aqui' ? 'Comprar aquí' : 'Solo probar'}`);
    if (r.comentario) partes.push(`   Comentario: ${r.comentario}`);
    return partes.join('\n');
  });
  return `Perfumes "Por Probar" en "${tiendaNombre}" (${rows.length}):\n\n${lineas.join('\n\n')}`;
}

function mostrarExportTienda(tiendaNombre, texto) {
  const el = openModal(`
    <h3>Exportar — ${escapeHtml(tiendaNombre)}</h3>
    <textarea id="export-tienda-texto" rows="14" readonly
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
      el.querySelector('#export-tienda-texto').select();
      toast('No se pudo copiar automático — seleccionamos el texto, cópialo con Ctrl/Cmd+C', true);
    }
  });
}

export async function render() {
  if (initialized) return;
  initialized = true;
  content.innerHTML = `
    ${section('coleccion', 'Colección (perfumes ya comprados)',
      'nombre_perfume | referencia | tienda_o_canal | precio | fecha_compra (AAAA-MM-DD, opcional) | comentario (opcional)',
      'Bleu de Chanel | Dupe X | Tienda Central | 15000 | 2025-03-10 | Muy buena duración')}
    ${section('lista-negra', 'Lista Negra (rechazados)',
      'nombre_perfume | referencia (opcional) | motivo | tienda (opcional, debe existir en Tiendas) | fecha (AAAA-MM-DD, opcional) | comentario (opcional)',
      'Sauvage | Dior Sauvage original | Muy genérico para mi gusto | Tienda Central | 2025-02-01 |')}
    ${section('por-probar', 'Por Probar (una línea por cada tienda donde está listado)',
      'nombre_perfume | referencia | tienda (debe existir en Tiendas) | precio | disponibilidad (con_probador/sin_probador) | modalidad (comprar_aqui/solo_probar) | comentario',
      'Aventus | Dupe Y | Tienda Norte | 12000 | con_probador | comprar_aqui | Pendiente probar en la piel')}
    <p class="muted" style="font-size:0.8rem;color:var(--muted);">
      Las líneas que empiezan con "#" se ignoran. Si un nombre de tienda no coincide con el catálogo
      (pestaña Tiendas), esa línea se reporta como error y no se importa.
    </p>
  `;

  wireSection('coleccion', importarColeccion);
  wireSection('lista-negra', importarListaNegra);
  wireSection('por-probar', importarPorProbar);
}

function section(id, title, formato, ejemplo) {
  return `
    <div class="import-section" data-section="${id}">
      <h4>${title}</h4>
      <div class="import-format">Formato: <code>${escapeHtml(formato)}</code><br/>Ejemplo: <code>${escapeHtml(ejemplo)}</code></div>
      <textarea class="import-textarea" data-role="textarea" placeholder="Pega aquí tus datos, una línea por registro..."></textarea>
      <div style="margin-top:8px;">
        <button class="btn btn-primary btn-block" data-role="importar">Importar</button>
      </div>
      <div class="import-result" data-role="resultado"></div>
    </div>
  `;
}

function wireSection(id, handler) {
  const el = content.querySelector(`[data-section="${id}"]`);
  const textarea = el.querySelector('[data-role="textarea"]');
  const btn = el.querySelector('[data-role="importar"]');
  const resultado = el.querySelector('[data-role="resultado"]');

  btn.addEventListener('click', async () => {
    if (!textarea.value.trim()) {
      resultado.innerHTML = '<span class="line-error">Pega al menos una línea antes de importar.</span>';
      return;
    }
    btn.disabled = true;
    resultado.textContent = 'Importando…';
    try {
      const { ok, total, errores } = await handler(textarea.value);
      let html = `✅ ${ok} de ${total} registros importados.`;
      if (errores.length) {
        html += `<br/><span class="line-error">${errores.length} línea(s) con error:</span>`;
        html += '<ul>' + errores.map((e) => `<li class="line-error">Línea ${e.linea}: ${escapeHtml(e.mensaje)}</li>`).join('') + '</ul>';
      } else if (ok > 0) {
        textarea.value = '';
      }
      resultado.innerHTML = html;
      if (ok > 0) toast(`${ok} registro(s) importados en "${id}"`);
    } catch (err) {
      resultado.innerHTML = `<span class="line-error">Error: ${escapeHtml(err.message)}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
}

async function buildTiendaMap() {
  const tiendas = await getTiendas(true);
  const map = new Map();
  for (const t of tiendas) map.set(normalizarNombre(t.nombre), t.id);
  return map;
}

function toNumberOrNull(v) {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(v.replace(/[^0-9.-]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function toDateOrNull(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  return v.trim();
}

async function importarColeccion(texto) {
  const { rows, errores: parseErrores } = parseDelimitado(texto, 1);
  const tiendaMap = await buildTiendaMap();
  const items = [];
  const errores = [...parseErrores];

  for (const { campos, linea } of rows) {
    const [nombre, referencia, tiendaOCanal, precio, fecha, comentario] = campos;
    const tiendaId = tiendaOCanal ? tiendaMap.get(normalizarNombre(tiendaOCanal)) : null;
    items.push({
      nombre_perfume: nombre,
      referencia: referencia || '',
      tienda_compra_id: tiendaId || '',
      canal_compra: (tiendaOCanal && !tiendaId) ? tiendaOCanal : '',
      precio: toNumberOrNull(precio) ?? '',
      fecha_compra: toDateOrNull(fecha) || '',
      comentario: comentario || '',
      __linea: linea,
    });
  }

  return enviarLote(items, errores, api.importarColeccion);
}

async function importarListaNegra(texto) {
  const { rows, errores: parseErrores } = parseDelimitado(texto, 1);
  const tiendaMap = await buildTiendaMap();
  const items = [];
  const errores = [...parseErrores];

  for (const { campos, linea } of rows) {
    const [nombre, referencia, motivo, tienda, fecha, comentario] = campos;
    let tiendaId = '';
    if (tienda) {
      tiendaId = tiendaMap.get(normalizarNombre(tienda));
      if (!tiendaId) {
        errores.push({ linea, mensaje: `Tienda "${tienda}" no existe en el catálogo. Agrégala primero en la pestaña Tiendas.` });
        continue;
      }
    }
    items.push({
      nombre_perfume: nombre,
      referencia: referencia || '',
      motivo: motivo || 'Sin especificar',
      tienda_probada_id: tiendaId || '',
      fecha: toDateOrNull(fecha) || '',
      comentario: comentario || '',
      __linea: linea,
    });
  }

  return enviarLote(items, errores, api.importarListaNegra);
}

async function importarPorProbar(texto) {
  const { rows, errores: parseErrores } = parseDelimitado(texto, 3);
  const tiendaMap = await buildTiendaMap();
  const errores = [...parseErrores];
  const grupos = new Map(); // key: nombre normalizado + referencia normalizada

  for (const { campos, linea } of rows) {
    const [nombre, referencia, tienda, precio, disponibilidad, modalidad, comentario] = campos;
    if (!tienda) {
      errores.push({ linea, mensaje: 'Falta el nombre de la tienda.' });
      continue;
    }
    const tiendaId = tiendaMap.get(normalizarNombre(tienda));
    if (!tiendaId) {
      errores.push({ linea, mensaje: `Tienda "${tienda}" no existe en el catálogo. Agrégala primero en la pestaña Tiendas.` });
      continue;
    }
    const disp = ['con_probador', 'sin_probador'].includes(disponibilidad) ? disponibilidad : 'con_probador';
    const mod = ['comprar_aqui', 'solo_probar'].includes(modalidad) ? modalidad : 'comprar_aqui';
    const key = normalizarNombre(nombre) + '||' + normalizarNombre(referencia || '');
    if (!grupos.has(key)) {
      grupos.set(key, { nombre_perfume: nombre, referencia: referencia || '', tiendas: [] });
    }
    grupos.get(key).tiendas.push({
      tienda_id: tiendaId,
      precio: toNumberOrNull(precio) ?? '',
      comentario: comentario || '',
      disponibilidad: disp,
      modalidad: mod,
    });
  }

  const items = [...grupos.values()];
  if (!items.length) {
    return { ok: 0, total: rows.length, errores };
  }

  try {
    const count = await api.importarPorProbar(items);
    return { ok: count, total: rows.length, errores };
  } catch (err) {
    errores.push({ linea: '-', mensaje: err.message });
    return { ok: 0, total: rows.length, errores };
  }
}

async function enviarLote(items, errores, apiFn) {
  const total = items.length + errores.length;
  if (!items.length) {
    return { ok: 0, total, errores };
  }
  const clean = items.map(({ __linea, ...rest }) => rest);
  try {
    const count = await apiFn(clean);
    return { ok: count, total, errores };
  } catch (err) {
    errores.push({ linea: '-', mensaje: err.message });
    return { ok: 0, total, errores };
  }
}
