/**
 * register.js — Registro directo de equipo
 * Valida datos, crea equipo en Supabase y redirige al panel.
 */

document.addEventListener('DOMContentLoaded', async () => {
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

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const showError  = msg => { errorDiv.textContent = msg; };
  const clearError = ()  => { errorDiv.textContent = ''; };

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

    const name  = teamNameInput.value.trim();
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    const conf  = passConfirm.value;
    const city  = citySelect.value;

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

    // Estado de carga
    btnRegister.disabled = true;
    btnRegister.textContent = 'Registrando...';

    // Crear equipo en Supabase
    const result = await DB.addTeam({ name, email, password: pass, city });

    if (!result.ok) {
      showError(result.error || 'Error al registrar el equipo.');
      btnRegister.disabled = false;
      btnRegister.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg>
        Registrar Equipo`;
      return;
    }

    // Auto login y redirigir al panel
    await DB.login(email, pass);
    window.location.href = 'team-panel.html';
  });
});
