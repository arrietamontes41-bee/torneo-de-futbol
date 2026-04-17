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

  // Helpers
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const showError   = msg => { if (errorDiv) errorDiv.textContent = msg; };
  const clearError  = ()  => { if (errorDiv) errorDiv.textContent = ''; };

  // Toggle mostrar/ocultar contraseña
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      btnTogglePass.textContent = isPass ? '🙈' : '👁';
    });
  }

  // --- Lógica de "¿Olvidaste tu contraseña?" (NUEVA UI PERSISTENTE) ---
  const loginCard     = document.getElementById('loginCard');
  const recoverCard   = document.getElementById('recoverCard');
  const btnForgotPass = document.getElementById('btnForgotPass');
  const btnBackLogin  = document.getElementById('btnBackToLogin');
  
  const recoverStepText = document.getElementById('recoverStepText');
  const stepEmail       = document.getElementById('stepEmail');
  const stepPIN         = document.getElementById('stepPIN');
  const stepPass        = document.getElementById('stepPass');
  const recoverError    = document.getElementById('recoverError');

  // Funciones de navegación
  const showRecover = () => {
    loginCard.classList.add('hidden');
    recoverCard.classList.remove('hidden');
    recoverError.textContent = '';
  };
  const showLogin = () => {
    recoverCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
    clearError();
  };

  if (btnForgotPass) btnForgotPass.addEventListener('click', showRecover);
  if (btnBackLogin)  btnBackLogin.addEventListener('click', showLogin);

  // Paso 1: Enviar PIN
  btnSendPIN.addEventListener('click', async () => {
    try {
      recoverError.textContent = '';
      const email = recoverEmailInput.value.trim();
      if (!EMAIL_REGEX.test(email)) {
        recoverError.textContent = 'Ingresa un correo válido.';
        return;
      }

      btnSendPIN.disabled = true;
      btnSendPIN.textContent = 'Enviando...';

      const resetRes = await DB.resetPasswordAndGetTemp(email);
      // Engaño de seguridad: Si no existe, decimos que lo enviamos igual.
      if (resetRes.ok) {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email: email,
            to_name: resetRes.userName || 'Usuario',
            temp_password: resetRes.tempPass,
            reply_to: "no-reply@torneofutbol.com"
          },
          { publicKey: EMAILJS_PUBLIC_KEY }
        );
      }

      // Avanzar al paso del PIN (siempre avanzamos para seguridad, o si fue exitoso)
      stepEmail.classList.add('hidden');
      stepPIN.classList.remove('hidden');
      recoverStepText.textContent = 'Ingresa el código enviado al correo';
    } catch (err) {
      console.error('Error en recuperación:', err);
      recoverError.textContent = 'Error técnico. Verifica tu conexión.';
    } finally {
      btnSendPIN.disabled = false;
      btnSendPIN.textContent = 'Enviar Código';
    }
  });

  // Paso 2: Verificar PIN
  const btnVerifyPIN = document.getElementById('btnVerifyPIN');
  const recoverPinInput = document.getElementById('recoverPinInput');
  let loggedSession = null; // Guardar sesión tras login con PIN

  btnVerifyPIN.addEventListener('click', async () => {
    try {
      recoverError.textContent = '';
      const email = recoverEmailInput.value.trim();
      const pin = recoverPinInput.value.replace(/\D/g, '');

      if (pin.length < 6) {
        recoverError.textContent = 'Ingresa los 6 dígitos.';
        return;
      }

      btnVerifyPIN.disabled = true;
      btnVerifyPIN.textContent = 'Verificando...';

      const res = await DB.login(email, pin);
      if (res.ok) {
        loggedSession = res.user;
        stepPIN.classList.add('hidden');
        stepPass.classList.remove('hidden');
        recoverStepText.textContent = 'Establece tu nueva contraseña';
      } else {
        recoverError.textContent = 'Código incorrecto. Reintenta.';
      }
    } catch (err) {
      console.error('Error en verificación:', err);
      recoverError.textContent = 'Error de conexión.';
    } finally {
      btnVerifyPIN.disabled = false;
      btnVerifyPIN.textContent = 'Verificar Código';
    }
  });

  // Paso 3: Actualizar Contraseña
  const btnUpdatePass = document.getElementById('btnUpdatePass');
  const recoverNewPass = document.getElementById('recoverNewPass');

  btnUpdatePass.addEventListener('click', async () => {
    try {
      recoverError.textContent = '';
      const newPass = recoverNewPass.value;

      if (newPass.length < 6) {
        recoverError.textContent = 'Mínimo 6 caracteres.';
        return;
      }

      btnUpdatePass.disabled = true;
      btnUpdatePass.textContent = 'Guardando...';

      const updateRes = await DB.updatePassword(loggedSession.id, newPass);
      if (updateRes.ok) {
        window.location.href = loggedSession.rol === 'admin' ? 'dashboard.html' : 'team-panel.html';
      } else {
        recoverError.textContent = 'Error al guardar.';
      }
    } catch (err) {
      console.error('Error al actualizar:', err);
      recoverError.textContent = 'Error técnico.';
    } finally {
      btnUpdatePass.disabled = false;
      btnUpdatePass.textContent = 'Actualizar y Entrar';
    }
  });

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
