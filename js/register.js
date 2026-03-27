/**
 * register.js — Team registration logic (async con Supabase)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Si ya hay sesión, redirigir
  const session = DB.getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  const form        = document.getElementById('registerForm');
  const teamName    = document.getElementById('teamName');
  const emailInput  = document.getElementById('regEmail');
  const passInput   = document.getElementById('regPassword');
  const passConfirm = document.getElementById('regPasswordConfirm');
  const citySelect  = document.getElementById('teamCity');
  const errorDiv    = document.getElementById('registerError');
  const btnRegister = document.getElementById('btnRegister');

  const showError  = msg => { errorDiv.textContent = msg; };
  const clearError = ()  => { errorDiv.textContent = ''; };

  [teamName, emailInput, passInput, passConfirm, citySelect].forEach(el => {
    el.addEventListener('input',  clearError);
    el.addEventListener('change', clearError);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const name  = teamName.value.trim();
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    const conf  = passConfirm.value;
    const city  = citySelect.value;

    if (!name)               { showError('El nombre del equipo es obligatorio.');            teamName.focus();    return; }
    if (name.length < 3)     { showError('El nombre debe tener al menos 3 caracteres.');                          return; }
    if (!email)              { showError('El correo electrónico es obligatorio.');           emailInput.focus();  return; }
    if (!pass)               { showError('La contraseña es obligatoria.');                   passInput.focus();   return; }
    if (pass.length < 6)     { showError('La contraseña debe tener al menos 6 caracteres.');                     return; }
    if (pass !== conf)       { showError('Las contraseñas no coinciden.');                   passConfirm.focus(); return; }
    if (!city)               { showError('Selecciona un municipio.');                        citySelect.focus();  return; }

    btnRegister.disabled    = true;
    btnRegister.textContent = 'Registrando...';

    const result = await DB.addTeam({ name, email, password: pass, city });

    if (result.ok) {
      // Auto login tras el registro
      await DB.login(email, pass);
      window.location.href = 'dashboard.html';
    } else {
      showError(result.error);
      btnRegister.disabled = false;
      btnRegister.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor" width="18">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
        </svg>
        Registrar Equipo`;
    }
  });
});
