import { haySesion, initLogin, cerrarSesion } from './auth.js';
import { toast } from './utils.js';
import * as porProbar from './views/porProbar.js';
import * as pendientes from './views/pendientes.js';
import * as coleccion from './views/coleccion.js';
import * as listaNegra from './views/listaNegra.js';
import * as tiendas from './views/tiendas.js';
import * as importar from './views/importar.js';

const routes = {
  'por-probar': { view: document.getElementById('view-por-probar'), render: porProbar.render },
  pendientes: { view: document.getElementById('view-pendientes'), render: pendientes.render },
  coleccion: { view: document.getElementById('view-coleccion'), render: coleccion.render },
  'lista-negra': { view: document.getElementById('view-lista-negra'), render: listaNegra.render },
  tiendas: { view: document.getElementById('view-tiendas'), render: tiendas.render },
  importar: { view: document.getElementById('view-importar'), render: importar.render },
};

async function goTo(route) {
  if (!routes[route]) route = 'por-probar';
  Object.entries(routes).forEach(([key, r]) => {
    r.view.classList.toggle('hidden', key !== route);
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
  try {
    await routes[route].render();
  } catch (err) {
    console.error(err);
    if (!(err && err.name === 'SesionInvalidaError')) {
      toast('Error: ' + err.message, true);
    }
  }
}

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => goTo(btn.dataset.route));
});

document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('¿Cerrar sesión en este dispositivo? Deberás ingresar el PIN nuevamente.')) {
    cerrarSesion();
  }
});

function showApp() {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  pendientes.render().catch(() => {});
  goTo('por-probar');
}

function showLogin() {
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
}

window.addEventListener('sesion-expirada', () => {
  showLogin();
  toast('Tu sesión expiró, ingresa tu PIN de nuevo', true);
});

initLogin(showApp);

if (haySesion()) {
  showApp();
} else {
  showLogin();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
