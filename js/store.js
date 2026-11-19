import { api } from './api.js';

let tiendasCache = null;

export async function getTiendas(forceRefresh = false) {
  if (!tiendasCache || forceRefresh) {
    tiendasCache = await api.listarTiendas();
  }
  return tiendasCache;
}

export function invalidateTiendas() {
  tiendasCache = null;
}

let repisasCache = null;

export async function getRepisas(forceRefresh = false) {
  if (!repisasCache || forceRefresh) {
    repisasCache = await api.listarRepisas();
  }
  return repisasCache;
}

export function invalidateRepisas() {
  repisasCache = null;
}
