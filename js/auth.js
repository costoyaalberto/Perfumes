import { validarPin, setToken, getToken, clearToken } from './api.js';

export function haySesion() {
  return !!getToken();
}

export function cerrarSesion() {
  clearToken();
  window.location.reload();
}

export function initLogin(onSuccess) {
  const form = document.getElementById('login-form');
  const input = document.getElementById('pin-input');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const pin = input.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      errorEl.textContent = 'El PIN debe tener 4 dígitos.';
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const token = await validarPin(pin);
      if (!token) {
        errorEl.textContent = 'PIN incorrecto.';
        input.value = '';
        input.focus();
        return;
      }
      setToken(token);
      onSuccess();
    } catch (err) {
      errorEl.textContent = 'Error de conexión: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  });
}
