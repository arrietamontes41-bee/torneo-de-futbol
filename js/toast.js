/**
 * toast.js — Sistema central de notificaciones tipo toast
 * Torneo de Fútbol Montería
 *
 * Uso: showToast('Mensaje aquí', 'success' | 'error' | 'info')
 * Máximo 3 toasts visibles al mismo tiempo.
 */

const MAX_TOASTS = 3;
const TOAST_DURATION = 4000;    // ms visibles
const TOAST_ANIM_OUT = 400;     // ms de animación de salida

function getContainer() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

/**
 * Muestra un toast en la esquina superior derecha.
 * @param {string} message  - Texto del toast
 * @param {'success'|'error'|'info'} type - Tipo visual
 */
function showToast(message, type = 'info') {
  const container = getContainer();

  // Limite: máx MAX_TOASTS simultáneos
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= MAX_TOASTS) {
    // Eliminar el más antiguo
    dismissToast(existing[0]);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Icono según tipo
  const icons = { success: '<i class="ph-fill ph-check-circle"></i>', error: '<i class="ph-fill ph-x-circle"></i>', info: '<i class="ph-fill ph-info"></i>' };
  const icon = icons[type] || '<i class="ph-fill ph-info"></i>';

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:1.1rem;flex-shrink:0;">${icon}</span>
      <span style="flex:1;font-size:0.88rem;font-weight:600;line-height:1.4;">${escapeHtml(message)}</span>
      <button onclick="dismissToast(this.parentElement.parentElement)"
        style="background:none;border:none;color:inherit;cursor:pointer;font-size:1rem;padding:0;opacity:0.7;flex-shrink:0;"
        aria-label="Cerrar notificación"><i class="ph ph-trash"></i></button>
    </div>`;

  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), TOAST_DURATION);
  toast._timer = timer;
}

function dismissToast(toast) {
  if (!toast || !toast.isConnected) return;
  clearTimeout(toast._timer);
  toast.style.animation = `toastOut ${TOAST_ANIM_OUT}ms forwards`;
  setTimeout(() => toast.remove(), TOAST_ANIM_OUT);
}

/** Escapa HTML para evitar XSS en el mensaje */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// Exportar globalmente
window.showToast    = showToast;
window.dismissToast = dismissToast;
