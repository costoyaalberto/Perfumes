import { api } from '../api.js';
import { getTiendas } from '../store.js';
import { parseDelimitado, normalizarNombre, escapeHtml, toast } from '../utils.js';

const content = document.getElementById('importar-content');
let initialized = false;

export async function render() {
  if (initialized) return;
  initialized = true;
  content.innerHTML = `
    ${section('coleccion', 'Colección (perfumes ya comprados)',
      'nombre_perfume | referencia | tienda_o_canal | precio | fecha_compra (AAAA-MM-DD, opcional) | comentario (opcional)',
      'Bleu de Chanel | Dupe X | Tienda Central | 15000 | 2025-03-10 | Muy buena duración')}
    ${section('lista-negra', 'Lista Negra (rechazados)',
      'nombre_perfume | motivo | tienda (opcional, debe existir en Tiendas) | fecha (AAAA-MM-DD, opcional) | comentario (opcional)',
      'Sauvage | Muy genérico para mi gusto | Tienda Central | 2025-02-01 |')}
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
    const [nombre, motivo, tienda, fecha, comentario] = campos;
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
