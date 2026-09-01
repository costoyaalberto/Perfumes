export function normalizarNombre(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function esNombreSimilar(a, b) {
  const na = normalizarNombre(a);
  const nb = normalizarNombre(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na))) return true;
  const dist = levenshtein(na, nb);
  const umbral = Math.max(1, Math.floor(Math.min(na.length, nb.length) * 0.15));
  return dist <= umbral;
}

export function formatCLP(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

export function formatFecha(v) {
  if (!v) return '—';
  const iso = typeof v === 'string' && v.length === 10 ? `${v}T00:00:00` : v;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('es-CL');
}

export function escapeHtml(str) {
  return (str ?? '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parsea texto delimitado por "|", una entrada por línea.
// Ignora líneas vacías y líneas que empiezan con "#".
// Devuelve { rows: [{ campos: string[], linea: number }], errores: [{ linea, mensaje }] }
export function parseDelimitado(texto, minCampos) {
  const rows = [];
  const errores = [];
  const lineas = (texto || '').split('\n');
  lineas.forEach((raw, idx) => {
    const linea = idx + 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const campos = trimmed.split('|').map((c) => c.trim());
    if (campos.length < minCampos || !campos[0]) {
      errores.push({ linea, mensaje: `Formato inválido (se esperaban al menos ${minCampos} campos separados por "|")` });
      return;
    }
    rows.push({ campos, linea });
  });
  return { rows, errores };
}

let toastTimer;
export function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.innerHTML = '';
  el.textContent = msg;
  el.classList.remove('hidden', 'error');
  if (isError) el.classList.add('error');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// Toast con un botón de acción (ej. "Deshacer"), visible más tiempo que el normal.
export function toastConAccion(msg, accionLabel, onAccion, duracionMs = 9000) {
  const el = document.getElementById('toast');
  el.classList.remove('error');
  el.innerHTML = `<span>${escapeHtml(msg)}</span> <button type="button" class="toast-action">${escapeHtml(accionLabel)}</button>`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  const hide = () => el.classList.add('hidden');
  el.querySelector('.toast-action').addEventListener('click', () => {
    hide();
    onAccion();
  });
  toastTimer = setTimeout(hide, duracionMs);
}
