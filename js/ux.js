// ux.js – UI behavior enhancements (no visual design changes, non-interfering)

(() => {
  // ---------- Toast System ----------
  const toastContainerId = 'ux-toast-container';
  function ensureToastContainer() {
    let container = document.getElementById(toastContainerId);
    if (!container) {
      container = document.createElement('div');
      container.id = toastContainerId;
      document.body.appendChild(container);
    }
    return container;
  }
  window.showToast = function(message, type = 'success') {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `ux-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    // auto‑remove after 3s with fadeOut
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.4s forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
    
    // keep max 3 toasts visible
    const toasts = container.children;
    if (toasts.length > 3) {
      for (let i = 0; i < toasts.length - 3; i++) {
        toasts[i].remove();
      }
    }
  };

  // ---------- Confirmation Modal ----------
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'ux-modal-backdrop';
  modalBackdrop.innerHTML = `
    <div class="ux-modal-content">
      <h3 id="ux-modal-title">¿Estás seguro?</h3>
      <p id="ux-modal-subtext">Esta acción no se puede deshacer.</p>
      <div class="ux-modal-buttons">
        <button class="ux-btn-cancel" id="ux-modal-cancel">Cancelar</button>
        <button class="ux-btn-confirm" id="ux-modal-confirm">Sí, eliminar</button>
      </div>
    </div>`;
  document.body.appendChild(modalBackdrop);
  
  const modalTitle = modalBackdrop.querySelector('#ux-modal-title');
  const modalSub = modalBackdrop.querySelector('#ux-modal-subtext');
  const confirmBtn = modalBackdrop.querySelector('#ux-modal-confirm');
  const cancelBtn = modalBackdrop.querySelector('#ux-modal-cancel');
  let confirmCallback = null;
  
  function openConfirm(message, subtext, onConfirm) {
    modalTitle.textContent = message || '¿Estás seguro?';
    modalSub.textContent = subtext || 'Esta acción no se puede deshacer.';
    confirmCallback = onConfirm;
    modalBackdrop.classList.add('show');
    confirmBtn.focus();
  }
  
  function closeConfirm() {
    modalBackdrop.classList.remove('show');
    confirmCallback = null;
  }
  
  confirmBtn.addEventListener('click', () => {
    if (typeof confirmCallback === 'function') confirmCallback();
    closeConfirm();
  });
  
  cancelBtn.addEventListener('click', closeConfirm);
  modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeConfirm();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalBackdrop.classList.contains('show')) {
      closeConfirm();
    }
  });
  
  // Expose globally
  window.showConfirm = openConfirm;

  // ---------- Form Validation Helpers (Non-interfering) ----------
  function showFieldError(input, message) {
    const parent = input.parentElement;
    let err = parent.querySelector('.form-error-message');
    if (!err) {
      err = document.createElement('div');
      err.className = 'form-error-message';
      parent.appendChild(err);
    }
    err.textContent = message;
    err.classList.add('show');
    input.classList.add('input-error');
  }
  
  function clearFieldError(input) {
    const parent = input.parentElement;
    const err = parent.querySelector('.form-error-message');
    if (err) err.classList.remove('show');
    input.classList.remove('input-error');
  }
  
  function setValidIcon(input) {
    input.classList.add('input-valid');
  }
  
  function removeValidIcon(input) {
    input.classList.remove('input-valid');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Attach validation behaviors to inputs only, WITHOUT hijacking form submit events
  document.addEventListener('DOMContentLoaded', () => {
    // ----- General input validation on blur & input events -----
    document.querySelectorAll('input, select, textarea').forEach(inp => {
      inp.addEventListener('blur', () => {
        clearFieldError(inp);
        if (inp.required && !inp.value.trim()) {
          showFieldError(inp, 'Este campo es obligatorio');
          return;
        }
        if (inp.type === 'email' && inp.value && !isValidEmail(inp.value)) {
          showFieldError(inp, 'Ingresa un correo válido');
          return;
        }
        if (inp.value.trim()) {
          setValidIcon(inp);
        }
      });
      
      inp.addEventListener('input', () => {
        clearFieldError(inp);
        removeValidIcon(inp);
      });
    });

    // ----- Cards keyboard activation -----
    document.querySelectorAll('.ux-card, .team-card, .match-card').forEach(card => {
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          card.click();
        }
      });
    });

    // ----- Mobile sidebar toggle -----
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const hamburger = document.createElement('button');
      hamburger.className = 'ux-hamburger';
      hamburger.innerHTML = '&#9776;';
      hamburger.setAttribute('aria-label', 'Abrir menú');
      document.body.appendChild(hamburger);
      
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
      
      // Close sidebar when clicking outside
      document.addEventListener('click', e => {
        if (!sidebar.contains(e.target) && !hamburger.contains(e.target) && sidebar.classList.contains('open')) {
          sidebar.classList.remove('open');
        }
      });
    }
  });
})();
