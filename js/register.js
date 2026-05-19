/**
 * register.js — Registro con selección de rol
 * - Delegado de Equipo: crea equipo + usuario con rol 'team'
 * - Administrador: valida código secreto y crea usuario con rol 'admin'
 */

// ⚠️ Cambia este valor por tu código secreto real (mantenlo en privado)
const ADMIN_SECRET_CODE = '123456789';

document.addEventListener('DOMContentLoaded', async () => {
  // Seguridad: Ignorar parámetros de URL (evitar ataques de reflexión)
  if (window.location.search) {
    console.warn('Advertencia de Seguridad: parámetros en la URL ignorados.');
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }

  // Si ya hay sesión, redirigir
  const session = DB.getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  // ── Referencias al DOM ────────────────────────────────────────
  const form              = document.getElementById('registerForm');
  const teamNameInput     = document.getElementById('teamName');
  const adminNameInput    = document.getElementById('adminName');
  const emailInput        = document.getElementById('regEmail');
  const passInput         = document.getElementById('regPassword');
  const passConfirm       = document.getElementById('regPasswordConfirm');
  const citySelect        = document.getElementById('teamCity');
  const adminCodeInput    = document.getElementById('adminCode');
  const errorDiv          = document.getElementById('registerError');
  const btnRegister       = document.getElementById('btnRegister');
  const shieldInput       = document.getElementById('shieldInput');
  const shieldPreview     = document.getElementById('shieldPreview');

  // Roles
  const roleTeamCard      = document.getElementById('roleTeam');
  const roleAdminCard     = document.getElementById('roleAdmin');
  const teamSection       = document.getElementById('teamSection');
  const citySection       = document.getElementById('citySection');
  const adminNameSection  = document.getElementById('adminNameSection');
  const adminCodeSection  = document.getElementById('adminCodeSection');
  const adminTournamentSection = document.getElementById('adminTournamentSection');
  const adminTournamentNameInput = document.getElementById('adminTournamentName');
  const adminTournamentDescInput = document.getElementById('adminTournamentDesc');
  const adminTournamentCitySelect = document.getElementById('adminTournamentCity');
  const registerTitle     = document.getElementById('registerTitle');
  const registerSubtitle  = document.getElementById('registerSubtitle');

  let shieldBase64 = null;
  let currentRole  = 'team'; // 'team' | 'admin'

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const showError   = msg => { errorDiv.textContent = msg; };
  const clearError  = ()  => { errorDiv.textContent = ''; };

  // ── Selector de Rol ──────────────────────────────────────────
  function switchRole(role) {
    currentRole = role;
    clearError();

    if (role === 'team') {
      roleTeamCard.classList.add('active');
      roleAdminCard.classList.remove('active');

      teamSection.classList.remove('hidden-section');
      citySection.classList.remove('hidden-section');
      adminNameSection.classList.remove('visible');
      adminCodeSection.classList.remove('visible');
      if (adminTournamentSection) adminTournamentSection.classList.remove('visible');

      // Quitar required de campos de admin, poner en los de equipo
      teamNameInput.required = true;
      citySelect.required    = true;
      adminNameInput.required= false;
      adminCodeInput.required= false;
      if (adminTournamentNameInput) adminTournamentNameInput.required = false;

      registerTitle.textContent    = 'Registrarte como delegado o como equipo';
      registerSubtitle.textContent = 'Únete al torneo';
      btnRegister.textContent      = 'Registrarte como delegado o como equipo';

    } else {
      roleAdminCard.classList.add('active');
      roleTeamCard.classList.remove('active');

      teamSection.classList.add('hidden-section');
      citySection.classList.add('hidden-section');
      adminNameSection.classList.add('visible');
      adminCodeSection.classList.add('visible');
      if (adminTournamentSection) adminTournamentSection.classList.add('visible');

      // Quitar required de campos de equipo, poner en los de admin
      teamNameInput.required = false;
      citySelect.required    = false;
      adminNameInput.required= true;
      adminCodeInput.required= true;
      if (adminTournamentNameInput) adminTournamentNameInput.required = true;

      registerTitle.textContent    = 'Registro de Administrador';
      registerSubtitle.textContent = 'Acceso restringido al organizador';
      btnRegister.textContent      = 'Registrar como Admin';
    }
  }

  // Inicializar como equipo
  switchRole('team');

  roleTeamCard.addEventListener('click',  () => switchRole('team'));
  roleAdminCard.addEventListener('click', () => switchRole('admin'));
  roleTeamCard.addEventListener('keydown',  e => { if (e.key === 'Enter' || e.key === ' ') switchRole('team'); });
  roleAdminCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') switchRole('admin'); });

  // ── Preview del escudo ───────────────────────────────────────
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

  // ── Limpiar error al escribir ────────────────────────────────
  [teamNameInput, adminNameInput, emailInput, passInput, passConfirm, citySelect, adminCodeInput].forEach(el => {
    el.addEventListener('input',  clearError);
    el.addEventListener('change', clearError);
  });

  // ── Toggle mostrar/ocultar contraseña ────────────────────────
  [['btnTogglePass', 'regPassword'], ['btnToggleConfirm', 'regPasswordConfirm']].forEach(([btnId, inputId]) => {
    const btn = document.getElementById(btnId);
    const inp = document.getElementById(inputId);
    if (btn && inp) {
      btn.addEventListener('click', () => {
        const isPass = inp.type === 'password';
        inp.type = isPass ? 'text' : 'password';
        btn.innerHTML = isPass
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      });
    }
  });

  // ── Envío del formulario ─────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email       = DB.sanitize(emailInput.value.toLowerCase());
    const pass        = passInput.value;
    const conf        = passConfirm.value;
    const acceptTerms = document.getElementById('acceptTerms').checked;

    // Validaciones comunes
    if (!email)                   { showError('El correo electrónico es obligatorio.');               emailInput.focus();   return; }
    if (!EMAIL_REGEX.test(email)) { showError('Ingresa un correo válido (ej: nombre@dominio.com).'); emailInput.focus();   return; }
    if (!pass)                    { showError('La contraseña es obligatoria.');                       passInput.focus();    return; }
    if (pass.length < 6)          { showError('La contraseña debe tener al menos 6 caracteres.');                          return; }
    if (!/\d/.test(pass))         { showError('La contraseña debe incluir al menos un número.');                            return; }
    if (pass !== conf)            { showError('Las contraseñas no coinciden.');                       passConfirm.focus();  return; }
    if (!acceptTerms)             { showError('Debes aceptar la política de privacidad y tratamiento de datos.');          return; }

    // Estado de carga
    btnRegister.disabled = true;
    const originalText   = btnRegister.textContent;
    btnRegister.textContent = 'Registrando...';

    let result;

    // ── Flujo por rol ────────────────────────────────────────────
    if (currentRole === 'team') {
      // Validaciones exclusivas de equipo
      const name = DB.sanitize(teamNameInput.value);
      const city = DB.sanitize(citySelect.value);

      if (!name)               { showError('El nombre del equipo es obligatorio.');         teamNameInput.focus(); resetBtn(); return; }
      if (name.length < 3)     { showError('El nombre debe tener al menos 3 caracteres.');                         resetBtn(); return; }
      if (/[<>"'`]/.test(name)){ showError('El nombre contiene caracteres no permitidos.');                        resetBtn(); return; }
      if (!city)               { showError('Selecciona un municipio.');                     citySelect.focus();    resetBtn(); return; }

      result = await DB.addTeam({ name, email, password: pass, city, escudo: shieldBase64 || null });

      if (result.ok) {
        showSuccessTeam(name);
        return;
      }

    } else {
      // Validaciones exclusivas de admin
      const adminName = DB.sanitize(adminNameInput.value);
      const code      = adminCodeInput.value.trim();
      
      const tournamentName = adminTournamentNameInput ? DB.sanitize(adminTournamentNameInput.value) : '';
      const tournamentDesc = adminTournamentDescInput ? DB.sanitize(adminTournamentDescInput.value) : '';
      const tournamentCity = adminTournamentCitySelect ? adminTournamentCitySelect.value : 'Montería';

      if (!adminName)              { showError('Tu nombre completo es obligatorio.');    adminNameInput.focus(); resetBtn(); return; }
      if (adminName.length < 3)   { showError('El nombre debe tener al menos 3 caracteres.');                   resetBtn(); return; }
      if (!tournamentName)         { showError('El nombre del torneo es obligatorio.');  adminTournamentNameInput.focus(); resetBtn(); return; }
      if (!code)                   { showError('El código de acceso es obligatorio.');   adminCodeInput.focus(); resetBtn(); return; }
      if (code !== ADMIN_SECRET_CODE) {
        showError('Código de acceso incorrecto. Contacta al organizador del torneo.');
        adminCodeInput.value = '';
        adminCodeInput.focus();
        resetBtn();
        return;
      }

      result = await DB.addAdmin({
        name: adminName,
        email,
        password: pass,
        tournamentName,
        tournamentDesc,
        tournamentCity
      });

      if (result.ok) {
        showSuccessAdmin(adminName);
        return;
      }
    }

    // Error
    showError(result.error || 'Error al registrar. Intenta de nuevo.');
    resetBtn();

    function resetBtn() {
      btnRegister.disabled = false;
      btnRegister.textContent = originalText;
    }
  });

  // ── Pantallas de éxito ───────────────────────────────────────
  function showSuccessTeam(name) {
    const registerCard = document.getElementById('registerCard');
    const shieldImg = shieldBase64
      ? `<img src="${shieldBase64}" alt="escudo" class="photo-preview-full" />`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40" style="opacity:0.3;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/><path d="M7 20h10"/></svg>`;
    registerCard.innerHTML = `
      <div class="text-center-py16">
        <div class="success-shield-wrap">${shieldImg}</div>
        <div class="success-check-badge">
          <svg viewBox="0 0 20 20" fill="#22c55e" width="20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        </div>
        <h2 class="success-title">¡Equipo registrado!</h2>
        <p class="success-text-muted">El equipo <strong class="text-highlight">${name.replace(/</g, '&lt;')}</strong> fue inscrito correctamente.</p>
        <p class="success-text-sub">Ahora inicia sesión con tu correo y contraseña para acceder al panel del delegado.</p>
        <a href="index.html" class="btn-success-redirect">Ir a Iniciar Sesión</a>
      </div>`;
  }

  function showSuccessAdmin(name) {
    const registerCard = document.getElementById('registerCard');
    registerCard.innerHTML = `
      <div class="text-center-py16">
        <div class="success-shield-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5" width="56" height="56" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
        <div class="success-check-badge">
          <svg viewBox="0 0 20 20" fill="#22c55e" width="20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        </div>
        <h2 class="success-title">¡Admin registrado!</h2>
        <p class="success-text-muted">Bienvenido, <strong class="text-highlight">${name.replace(/</g, '&lt;')}</strong>. Tu cuenta de administrador fue creada correctamente.</p>
        <p class="success-text-sub">Inicia sesión para acceder al panel de control del torneo.</p>
        <a href="index.html" class="btn-success-redirect">Ir a Iniciar Sesión</a>
      </div>`;
  }
});
