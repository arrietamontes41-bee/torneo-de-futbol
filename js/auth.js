/**
 * auth.js — Login page logic (async con Supabase)
 * Redirección por rol: admin → dashboard.html | equipo → team-panel.html
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Si ya hay sesión activa, redirigir según el rol
  const session = DB.getSession();
  if (session) {
    window.location.href = session.rol === 'admin' ? 'dashboard.html' : 'team-panel.html';
    return;
  }

  const form      = document.getElementById('loginForm');
  const emailInput= document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const errorDiv  = document.getElementById('loginError');
  const btnLogin  = document.getElementById('btnLogin');
  const btnTogglePass = document.getElementById('btnTogglePass');

  // Toggle mostrar/ocultar contraseña
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      btnTogglePass.textContent = isPass ? '🙈' : '👁';
    });
  }

  // Lógica de "¿Olvidaste tu contraseña?"
  const btnForgotPass = document.getElementById('btnForgotPass');
  if (btnForgotPass) {
    btnForgotPass.addEventListener('click', (e) => {
      e.preventDefault();
      const recoverEmail = prompt('Ingresa el correo electrónico asociado a tu equipo:');
      if (recoverEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoverEmail.trim())) {
          alert('Por favor, ingresa un correo electrónico válido.');
          return;
        }
        // Simulador de envío para el prototipo (Protección contra enumeración de correos)
        alert('Si el correo "' + recoverEmail.trim() + '" está registrado en nuestra base de datos, en los próximos minutos recibirás un enlace seguro para restablecer tu contraseña.\n\n(Aviso del Prototipo: Como este es un entorno de pruebas, no se enviará un correo real).');
      }
    });
  }

  const showError  = msg => { errorDiv.textContent = msg; };
  const clearError = ()  => { errorDiv.textContent = ''; };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  [emailInput, passInput].forEach(el => el.addEventListener('input', clearError));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!email)                       { showError('El correo electrónico es obligatorio.'); emailInput.focus(); return; }
    if (!EMAIL_REGEX.test(email))     { showError('Ingresa un correo electrónico válido (ej: nombre@dominio.com).'); emailInput.focus(); return; }
    if (!password)                    { showError('La contraseña es obligatoria.'); passInput.focus(); return; }
    if (password.length < 6)          { showError('La contraseña debe tener al menos 6 caracteres.'); passInput.focus(); return; }

    // Estado de carga
    btnLogin.disabled = true;
    btnLogin.textContent = 'Ingresando...';

    const result = await DB.login(email, password);

    if (result.ok) {
      // Redirigir según rol
      const destino = result.user.rol === 'admin' ? 'dashboard.html' : 'team-panel.html';
      window.location.href = destino;
    } else {
      showError(result.error);
      btnLogin.disabled = false;
      btnLogin.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor" width="18">
          <path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
        </svg>
        Iniciar sesión`;
    }
  });
});
