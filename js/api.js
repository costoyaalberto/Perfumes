import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const TOKEN_KEY = 'perfumes_pwa_token';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class SesionInvalidaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SesionInvalidaError';
  }
}

async function rpc(name, params = {}) {
  const token = getToken();
  const { data, error } = await client.rpc(name, { p_token: token, ...params });
  if (error) {
    if (error.code === '28000' || /sesión inválida|expirada/i.test(error.message || '')) {
      clearToken();
      window.dispatchEvent(new CustomEvent('sesion-expirada'));
      throw new SesionInvalidaError(error.message);
    }
    throw error;
  }
  return data;
}

export async function validarPin(pin) {
  const { data, error } = await client.rpc('validar_pin', { p_pin: pin });
  if (error) throw error;
  return data;
}

export const api = {
  listarTiendas: () => rpc('listar_tiendas'),
  crearTienda: (p_nombre) => rpc('crear_tienda', { p_nombre }),
  setTiendaActiva: (p_tienda_id, p_activa) => rpc('set_tienda_activa', { p_tienda_id, p_activa }),

  listarPorProbar: () => rpc('listar_por_probar'),
  crearPorProbar: (args) => rpc('crear_por_probar', args),
  agregarTiendaAPorProbar: (args) => rpc('agregar_tienda_a_por_probar', args),
  marcarSinProbador: (p_por_probar_tienda_id) => rpc('marcar_sin_probador', { p_por_probar_tienda_id }),
  meGusto: (p_por_probar_tienda_id, p_precio_final) => rpc('me_gusto', { p_por_probar_tienda_id, p_precio_final }),
  noMeGusto: (p_por_probar_tienda_id, p_motivo) => rpc('no_me_gusto', { p_por_probar_tienda_id, p_motivo }),
  editarPorProbar: (args) => rpc('editar_por_probar', args),
  eliminarPorProbarTienda: (p_por_probar_tienda_id) => rpc('eliminar_por_probar_tienda', { p_por_probar_tienda_id }),
  marcarAgotado: (p_por_probar_tienda_id) => rpc('marcar_agotado', { p_por_probar_tienda_id }),
  toggleDestacado: (p_por_probar_id, p_destacado) => rpc('toggle_destacado', { p_por_probar_id, p_destacado }),
  cambiarTienda: (args) => rpc('cambiar_tienda_por_probar', args),
  obtenerContadores: () => rpc('obtener_contadores'),

  listarPendientes: () => rpc('listar_pendientes_compra'),
  yaLoCompre: (args) => rpc('ya_lo_compre', args),

  listarPendientesProbar: () => rpc('listar_pendientes_probar'),
  volverAPorProbar: (args) => rpc('volver_a_por_probar', args),
  eliminarPendienteProbar: (p_pendiente_probar_id) => rpc('eliminar_pendiente_probar', { p_pendiente_probar_id }),

  deshacerMovimiento: (p_historial_id) => rpc('deshacer_movimiento', { p_historial_id }),
  listarMovimientosRecientes: () => rpc('listar_movimientos_recientes'),

  listarColeccion: () => rpc('listar_coleccion'),
  listarListaNegra: () => rpc('listar_lista_negra'),

  listarCandidatosDuplicado: () => rpc('listar_candidatos_duplicado'),

  exportarDatos: () => rpc('exportar_datos'),

  importarColeccion: (p_items) => rpc('importar_coleccion', { p_items }),
  importarListaNegra: (p_items) => rpc('importar_lista_negra', { p_items }),
  importarPorProbar: (p_items) => rpc('importar_por_probar', { p_items }),
};
