/**
 * register.js — Registro directo de equipo
 * Valida datos, crea equipo en Supabase y redirige al panel.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Segurindad: Ignorar cualquier parámetro de URL (evitar ataques de reflexión/falsos positivos de SQLi)
  if (window.location.search) {
    console.warn('Advertencia de Seguridad: Se han detectado parámetros en la URL que serán ignorados.');
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }

  // Si ya hay sesión, redirigir
  const session = DB.getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  const form         = document.getElementById('registerForm');
  const teamNameInput= document.getElementById('teamName');
  const emailInput   = document.getElementById('regEmail');
  const passInput    = document.getElementById('regPassword');
  const passConfirm  = document.getElementById('regPasswordConfirm');
  const citySelect   = document.getElementById('teamCity');
  const errorDiv     = document.getElementById('registerError');
  const btnRegister  = document.getElementById('btnRegister');
  const shieldInput  = document.getElementById('shieldInput');
  const shieldPreview= document.getElementById('shieldPreview');
  let shieldBase64   = null;

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const showError  = msg => { errorDiv.textContent = msg; };
  const clearError = ()  => { errorDiv.textContent = ''; };

  // Preview del escudo
  shieldInput.addEventListener('change', () => {
    const file = shieldInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showError('El escudo debe pesar menos de 2MB.');
      shieldInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      shieldBase64 = e.target.result;
      shieldPreview.innerHTML = `<img src="${shieldBase64}" alt="escudo" class="photo-preview-full" />`;
    };
    reader.readAsDataURL(file);
  });

  // Limpiar error al escribir
  [teamNameInput, emailInput, passInput, passConfirm, citySelect].forEach(el => {
    el.addEventListener('input',  clearError);
    el.addEventListener('change', clearError);
  });

  // Toggle mostrar/ocultar contraseña
  [['btnTogglePass', 'regPassword'], ['btnToggleConfirm', 'regPasswordConfirm']].forEach(([btnId, inputId]) => {
    const btn = document.getElementById(btnId);
    const inp = document.getElementById(inputId);
    if (btn && inp) {
      btn.addEventListener('click', () => {
        const isPass = inp.type === 'password';
        inp.type = isPass ? 'text' : 'password';
        btn.textContent = isPass ? '🙈' : '👁';
      });
    }
  });

  // ── Envío del formulario ──────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const name  = DB.sanitize(teamNameInput.value);
    const email = DB.sanitize(emailInput.value.toLowerCase());
    const pass  = passInput.value;
    const conf  = passConfirm.value;
    const city  = DB.sanitize(citySelect.value);
    const acceptTerms = document.getElementById('acceptTerms').checked;

    // Validaciones
    if (!name)                    { showError('El nombre del equipo es obligatorio.');               teamNameInput.focus(); return; }
    if (name.length < 3)          { showError('El nombre debe tener al menos 3 caracteres.');                               return; }
    if (/[<>"'`]/.test(name))     { showError('El nombre contiene caracteres no permitidos.');                              return; }
    if (!email)                   { showError('El correo electrónico es obligatorio.');               emailInput.focus();   return; }
    if (!EMAIL_REGEX.test(email)) { showError('Ingresa un correo válido (ej: equipo@dominio.com).'); emailInput.focus();   return; }
    if (!pass)                    { showError('La contraseña es obligatoria.');                       passInput.focus();    return; }
    if (pass.length < 6)          { showError('La contraseña debe tener al menos 6 caracteres.');                          return; }
    if (!/\d/.test(pass))         { showError('La contraseña debe incluir al menos un número.');                            return; }
    if (pass !== conf)            { showError('Las contraseñas no coinciden.');                       passConfirm.focus();  return; }
    if (!city)                    { showError('Selecciona un municipio.');                            citySelect.focus();   return; }
    if (!acceptTerms)             { showError('Debes aceptar la política de privacidad y tratamiento de datos.');         return; }

    // Estado de carga
    btnRegister.disabled = true;
    btnRegister.textContent = 'Registrando...';

    // Crear equipo en Supabase
    const result = await DB.addTeam({ name, email, password: pass, city, escudo: shieldBase64 || null });

    if (!result.ok) {
      showError(result.error || 'Error al registrar el equipo.');
      btnRegister.disabled = false;
      btnRegister.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg>
        Registrar Equipo`;
      return;
    }

    // Éxito: mostrar pantalla de confirmación (NO auto-login)
    const registerCard = document.getElementById('registerCard');
    const shieldImg = shieldBase64
      ? `<img src="${shieldBase64}" alt="escudo" class="photo-preview-full" />`
      : '🏆';

    registerCard.innerHTML = `
      <div class="text-center-py16">
        <div class="success-shield-wrap">
          ${shieldImg}
        </div>
        <div class="success-check-badge">
          <svg viewBox="0 0 20 20" fill="#22c55e" width="20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        </div>
        <h2 class="success-title">¡Equipo registrado!</h2>
        <p class="success-text-muted">El equipo <strong class="text-highlight">${name.replace(/</g, '&lt;')}</strong> fue inscrito correctamente.</p>
        <p class="success-text-sub">Ahora inicia sesión con tu correo y contraseña para acceder al panel.</p>
        <a href="index.html" class="btn-success-redirect">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
          Ir a Iniciar Sesión
        </a>
      </div>`;
  });
});
