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
  const icons = { success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>', error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>', info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' };
  const icon = icons[type] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:1.1rem;flex-shrink:0;">${icon}</span>
      <span style="flex:1;font-size:0.88rem;font-weight:600;line-height:1.4;">${escapeHtml(message)}</span>
      <button onclick="dismissToast(this.parentElement.parentElement)"
        style="background:none;border:none;color:inherit;cursor:pointer;font-size:1rem;padding:0;opacity:0.7;flex-shrink:0;"
        aria-label="Cerrar notificación"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
