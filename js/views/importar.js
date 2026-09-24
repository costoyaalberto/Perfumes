import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { openModal, closeModal } from '../modal.js';
import { parseDelimitado, normalizarNombre, escapeHtml, toast } from '../utils.js';

const content = document.getElementById('importar-content');
const actualizarRefContent = document.getElementById('actualizar-referencias-content');
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
    <p class="import-format">Elige una o más tiendas: arma un texto solo con los nombres de los perfumes "Por Probar" en ellas, para pedirle una recomendación a una IA.</p>
    <form id="form-exportar-tienda">
      <div class="form-row">
        ${tiendas.map((t) => `
          <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-weight:500;">
            <input type="checkbox" name="tienda_id" value="${t.id}" /> ${escapeHtml(t.nombre)}
          </label>
        `).join('')}
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
    const idsSeleccionados = fd.getAll('tienda_id');
    if (!idsSeleccionados.length) {
      toast('Selecciona al menos una tienda', true);
      return;
    }
    const seleccionadas = tiendas.filter((t) => idsSeleccionados.includes(t.id));
    try {
      const rows = await api.listarPorProbar();
      const texto = buildExportTiendaTexto(seleccionadas, rows);
      closeModal();
      mostrarExportTienda(seleccionadas.length, texto);
    } catch (err) {
      toast('Error: ' + err.message, true);
    }
  });
});

function buildExportTiendaTexto(tiendasSeleccionadas, rows) {
  const intro = 'Estos son los perfumes que tengo pendientes de probar, agrupados por tienda. Para cada uno, decime a qué perfume conocido se parece o qué sabes de él, y qué tan recomendable es probarlo.';
  const secciones = tiendasSeleccionadas.map((t) => {
    const nombres = rows.filter((r) => r.tienda_id === t.id).map((r) => r.nombre_perfume);
    const lista = nombres.length ? nombres.join('\n') : '(sin perfumes por probar acá)';
    return `# ${t.nombre}\n${lista}`;
  });
  return `${intro}\n\n${secciones.join('\n\n')}`;
}

document.getElementById('btn-exportar-referencias').addEventListener('click', async () => {
  try {
    const [coleccion, listaNegra] = await Promise.all([
      api.listarColeccion(),
      api.listarListaNegra(),
    ]);
    const faltanColeccion = coleccion.filter((p) => !p.referencia);
    const faltanListaNegra = listaNegra.filter((p) => !p.referencia);
    const total = faltanColeccion.length + faltanListaNegra.length;
    if (!total) {
      toast('No hay perfumes con referencia faltante 🎉');
      return;
    }
    const texto = buildExportReferenciasTexto(faltanColeccion, faltanListaNegra);
    mostrarExportReferencias(texto, total);
  } catch (err) {
    toast('Error: ' + err.message, true);
  }
});

function buildExportReferenciasTexto(coleccion, listaNegra) {
  const lineas = (list) => (list.length ? list.map((p) => `${p.id}|${p.nombre_perfume}`).join('\n') : '(ninguno)');
  return `Para cada perfume de la lista de abajo, identifica a qué perfume original está inspirado (el perfume "de diseñador" que imita o del que es "dupe"). Devuélveme exactamente la misma lista completa (mismas líneas, mismo orden, sin agregar ni quitar ninguna), agregando al final de cada línea " | " seguido del nombre del perfume original que identificaste. No cambies el ID. Si no puedes identificarlo con confianza, escribe "?" en vez de inventar uno. Mantén las líneas que empiezan con "#" tal cual.

# COLECCION
${lineas(coleccion)}

# LISTA_NEGRA
${lineas(listaNegra)}`;
}

function mostrarExportReferencias(texto, total) {
  const el = openModal(`
    <h3>Exportar referencias faltantes</h3>
    <p class="import-format">${total} perfume(s) sin referencia. Pega este texto en una IA y después pega su respuesta en "Actualizar referencias", más abajo en esta misma pestaña.</p>
    <textarea id="export-referencias-texto" rows="14" readonly
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
      el.querySelector('#export-referencias-texto').select();
      toast('No se pudo copiar automático — seleccionamos el texto, cópialo con Ctrl/Cmd+C', true);
    }
  });
}

function mostrarExportTienda(cantidadTiendas, texto) {
  const el = openModal(`
    <h3>Exportar — ${cantidadTiendas} tienda${cantidadTiendas === 1 ? '' : 's'}</h3>
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

  initActualizarReferencias();
}

function initActualizarReferencias() {
  actualizarRefContent.innerHTML = `
    <div class="import-section">
      <div class="import-format">
        Pega acá la respuesta completa que te dio la IA a partir del texto de
        "🧬 Exportar referencias faltantes" (con las líneas <code># COLECCION</code>
        / <code># LISTA_NEGRA</code> tal cual se las mandaste). Solo actualiza el
        campo referencia de perfumes que ya existen — no crea perfumes nuevos.
      </div>
      <textarea class="import-textarea" data-role="textarea" placeholder="Pega aquí la respuesta de la IA..."></textarea>
      <div style="margin-top:8px;">
        <button class="btn btn-primary btn-block" data-role="actualizar">Actualizar referencias</button>
      </div>
      <div class="import-result" data-role="resultado"></div>
    </div>
  `;

  const textarea = actualizarRefContent.querySelector('[data-role="textarea"]');
  const btn = actualizarRefContent.querySelector('[data-role="actualizar"]');
  const resultado = actualizarRefContent.querySelector('[data-role="resultado"]');

  btn.addEventListener('click', async () => {
    if (!textarea.value.trim()) {
      resultado.innerHTML = '<span class="line-error">Pega el texto con las referencias antes de actualizar.</span>';
      return;
    }
    const { coleccion, listaNegra, omitidas } = parseActualizarReferencias(textarea.value);
    if (!coleccion.length && !listaNegra.length) {
      resultado.innerHTML = '<span class="line-error">No se encontró ninguna línea con formato "id|referencia" válido.</span>';
      return;
    }
    btn.disabled = true;
    resultado.textContent = 'Actualizando…';
    try {
      const [okColeccion, okListaNegra] = await Promise.all([
        coleccion.length ? api.actualizarReferenciasColeccion(coleccion) : Promise.resolve(0),
        listaNegra.length ? api.actualizarReferenciasListaNegra(listaNegra) : Promise.resolve(0),
      ]);
      let html = `✅ ${okColeccion} referencia(s) actualizadas en Colección y ${okListaNegra} en Lista Negra.`;
      if (omitidas > 0) {
        html += `<br/>${omitidas} línea(s) sin referencia identificada (la IA respondió "?" o no la incluyó) — se omitieron.`;
      }
      resultado.innerHTML = html;
      textarea.value = '';
      toast('Referencias actualizadas');
    } catch (err) {
      resultado.innerHTML = `<span class="line-error">Error: ${escapeHtml(err.message)}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseActualizarReferencias(texto) {
  const coleccion = [];
  const listaNegra = [];
  let omitidas = 0;
  let seccion = 'coleccion';
  for (const rawLinea of (texto || '').split('\n')) {
    const linea = rawLinea.trim();
    if (!linea) continue;
    if (/^#?\s*COLECCION\b/i.test(linea)) { seccion = 'coleccion'; continue; }
    if (/^#?\s*LISTA_?NEGRA\b/i.test(linea)) { seccion = 'listaNegra'; continue; }
    if (linea.startsWith('#')) continue;

    const campos = linea.split('|').map((c) => c.trim());
    if (!UUID_RE.test(campos[0])) continue; // no es una línea de datos (instrucciones, texto suelto de la IA, etc.)

    const referencia = campos[campos.length - 1];
    if (campos.length < 2 || !referencia || referencia === '?') {
      omitidas++;
      continue;
    }

    const item = { id: campos[0], referencia };
    if (seccion === 'listaNegra') listaNegra.push(item);
    else coleccion.push(item);
  }
  return { coleccion, listaNegra, omitidas };
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
