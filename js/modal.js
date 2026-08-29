const overlay = document.getElementById('modal-overlay');
const box = document.getElementById('modal-box');

export function openModal(html) {
  box.innerHTML = html;
  overlay.classList.remove('hidden');
  return box;
}

export function closeModal() {
  overlay.classList.add('hidden');
  box.innerHTML = '';
}

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

export function confirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    const el = openModal(`
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancelar</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="ok">${confirmLabel}</button>
      </div>
    `);
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
    el.querySelector('[data-action="ok"]').addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
  });
}
