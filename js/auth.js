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
      btnTogglePass.innerHTML = isPass 
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
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

  // Escuchar evento de recuperación de contraseña de Supabase
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showRecover();
      stepEmail.classList.add('hidden');
      if (stepPIN) stepPIN.classList.add('hidden');
      stepPass.classList.remove('hidden');
      recoverStepText.textContent = 'Establece tu nueva contraseña';
    }
  });

  const btnSendPIN = document.getElementById('btnSendPIN');
  const recoverEmailInput = document.getElementById('recoverEmailInput');

  // Paso 1: Enviar correo de recuperación
  btnSendPIN.addEventListener('click', async () => {
    try {
      recoverError.textContent = '';
      const email = recoverEmailInput.value.trim();
      if (!EMAIL_REGEX.test(email)) {
        recoverError.textContent = 'Ingresa un correo válido.';
        return;
      }

      btnSendPIN.disabled = true;
      btnSendPIN.textContent = 'Enviando enlace...';

      const resetRes = await DB.sendPasswordResetEmail(email);
      
      if (resetRes.ok) {
        stepEmail.innerHTML = '<div class="text-center text-green-500 mb-4"><svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><p>Hemos enviado un enlace a tu correo. Por favor, revisa tu bandeja de entrada o spam para continuar.</p></div>';
        btnSendPIN.classList.add('hidden');
        recoverStepText.textContent = 'Correo enviado';
      } else {
        // Fallback genérico por seguridad
        recoverError.textContent = 'Si el correo existe, se ha enviado un enlace.';
      }
    } catch (err) {
      console.error('Error en recuperación:', err);
      recoverError.textContent = 'Error técnico. Verifica tu conexión.';
    } finally {
      if (!stepEmail.innerHTML.includes('Hemos enviado')) {
        btnSendPIN.disabled = false;
        btnSendPIN.textContent = 'Enviar Enlace';
      }
    }
  });

  // Paso 2 eliminado (Verificar PIN ya no es necesario)

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

      const updateRes = await DB.updatePassword(newPass);
      if (updateRes.ok) {
        // Redirigir según rol si pudimos cargar el perfil
        const { data: sessionData } = await DB.client.auth.getSession();
        if (sessionData.session) {
          const userId = sessionData.session.user.id;
          const { data: profile } = await DB.client.from('usuarios').select('*').eq('id', userId).single();
          if (profile) {
            DB.saveSession(profile);
            window.location.href = profile.rol === 'admin' ? 'dashboard.html' : 'team-panel.html';
            return;
          }
        }
        window.location.href = 'index.html'; // Fallback
      } else {
        recoverError.textContent = 'Error al guardar. Puede que el enlace haya expirado.';
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

    try {
      const result = await DB.login(email, password);

      if (result.ok) {
        // Redirigir según rol
        const destino = result.user.rol === 'admin' ? 'dashboard.html' : 'team-panel.html';
        window.location.href = destino;
      } else {
        showError(result.error);
        resetLoginBtn();
      }
    } catch (err) {
      console.error('Login Error:', err);
      showError('Error de conexión o de seguridad en el navegador.');
      resetLoginBtn();
    }

    function resetLoginBtn() {
      btnLogin.disabled = false;
      btnLogin.innerHTML = `Iniciar sesión`;
    }
  });
});
