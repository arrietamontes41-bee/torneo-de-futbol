/**
 * register.js — Registro de equipo en 2 pasos:
 *   Paso 1: datos del equipo (nombre, email, contraseña, municipio)
 *   Paso 2: plantilla de jugadores (nombre, documento, posición, dorsal)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Si ya hay sesión, redirigir
  const session = DB.getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  // ── Paso 1: refs ──
  const form           = document.getElementById('registerForm');
  const teamNameInput  = document.getElementById('teamName');
  const emailInput     = document.getElementById('regEmail');
  const passInput      = document.getElementById('regPassword');
  const passConfirm    = document.getElementById('regPasswordConfirm');
  const citySelect     = document.getElementById('teamCity');
  const errorDiv       = document.getElementById('registerError');
  const btnNextStep    = document.getElementById('btnNextStep');

  // ── Wizard refs ──
  const panel1         = document.getElementById('panel1');
  const panel2         = document.getElementById('panel2');
  const wStep1         = document.getElementById('wStep1');
  const wStep2         = document.getElementById('wStep2');
  const stepCircle1    = document.getElementById('stepCircle1');
  const stepCircle2    = document.getElementById('stepCircle2');

  // ── Paso 2: refs ──
  const playersList    = document.getElementById('playersList');
  const playersEmpty   = document.getElementById('playersEmpty');
  const playersCountB  = document.getElementById('playersCountBadge');
  const btnAddPlayer   = document.getElementById('btnAddPlayer');
  const playersError   = document.getElementById('playersError');
  const btnBackStep    = document.getElementById('btnBackStep');
  const btnRegisterFinal = document.getElementById('btnRegisterFinal');

  // Estado local del wizard
  let players = [];   // [{nombre,documento,posicion,dorsal,fecha_nac}]
  let playerCounter = 0;

  const showError  = msg => { errorDiv.textContent = msg; };
  const clearError = ()  => { errorDiv.textContent = ''; };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  [teamNameInput, emailInput, passInput, passConfirm, citySelect].forEach(el => {
    el.addEventListener('input',  clearError);
    el.addEventListener('change', clearError);
  });

  // ──────────────────────────────────────────
  //  PASO 1 → Validar y avanzar
  // ──────────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();

    const name = teamNameInput.value.trim();
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    const conf  = passConfirm.value;
    const city  = citySelect.value;

    if (!name)                { showError('El nombre del equipo es obligatorio.');            teamNameInput.focus(); return; }
    if (name.length < 3)      { showError('El nombre debe tener al menos 3 caracteres.');                           return; }
    if (/[<>"'`]/.test(name)) { showError('El nombre del equipo contiene caracteres no permitidos.');              return; }
    if (!email)               { showError('El correo electrónico es obligatorio.');            emailInput.focus();   return; }
    if (!EMAIL_REGEX.test(email)) { showError('Ingresa un correo electrónico válido (ej: equipo@dominio.com).'); emailInput.focus(); return; }
    if (!pass)                { showError('La contraseña es obligatoria.');                   passInput.focus();    return; }
    if (pass.length < 6)      { showError('La contraseña debe tener al menos 6 caracteres.');                      return; }
    if (!/\d/.test(pass))     { showError('La contraseña debe contener al menos un número (ej: futbol1).');          return; }
    if (pass !== conf)        { showError('Las contraseñas no coinciden.');                   passConfirm.focus();  return; }
    if (!city)                { showError('Selecciona un municipio.');                         citySelect.focus();   return; }

    goToStep2();
  });

  const goToStep2 = () => {
    panel1.classList.remove('active');
    panel2.classList.add('active');

    // Update wizard circles
    stepCircle1.classList.remove('active');
    stepCircle1.classList.add('done');
    stepCircle1.textContent = '✓';
    wStep1.classList.remove('active');
    wStep1.classList.add('done');

    stepCircle2.classList.add('active');
    wStep2.classList.add('active');
  };

  btnBackStep.addEventListener('click', () => {
    panel2.classList.remove('active');
    panel1.classList.add('active');

    stepCircle1.classList.remove('done');
    stepCircle1.classList.add('active');
    stepCircle1.textContent = '1';
    wStep1.classList.remove('done');
    wStep1.classList.add('active');

    stepCircle2.classList.remove('active');
    wStep2.classList.remove('active');
  });

  // ──────────────────────────────────────────
  //  PASO 2 → Gestión de jugadores
  // ──────────────────────────────────────────
  const updatePlayersUI = () => {
    playersEmpty.style.display = players.length === 0 ? 'block' : 'none';
    playersCountB.textContent  = `${players.length} jugador${players.length !== 1 ? 'es' : ''}`;
    btnAddPlayer.style.display = players.length >= 25 ? 'none' : 'block';
  };

  const buildPlayerRow = (pid) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.pid = pid;
    const num = players.findIndex(p => p._id === pid) + 1;

    row.innerHTML = `
      <div class="player-row-title">
        <span>Jugador #${num}</span>
        <button class="btn-remove-player" type="button" title="Eliminar jugador">✕</button>
      </div>
      <div class="player-grid">
        <div class="form-field full-col">
          <label>Nombre completo *</label>
          <input type="text" class="p-nombre" placeholder="Ej: Juan Pérez" maxlength="60" required />
        </div>
        <div class="form-field">
          <label>N.º Documento *</label>
          <input type="text" class="p-documento" placeholder="CC / TI" maxlength="20" required />
        </div>
        <div class="form-field">
          <label>Dorsal *</label>
          <input type="number" class="p-dorsal" placeholder="1-99" min="1" max="99" required />
        </div>
        <div class="form-field">
          <label>Posición *</label>
          <select class="p-posicion">
            <option value="">Seleccionar</option>
            <option value="Portero">Portero</option>
            <option value="Defensa">Defensa</option>
            <option value="Mediocampista">Mediocampista</option>
            <option value="Delantero">Delantero</option>
          </select>
        </div>
        <div class="form-field">
          <label>Fecha de nacimiento</label>
          <input type="date" class="p-fecha" max="${new Date().toISOString().split('T')[0]}" />
        </div>
      </div>`;

    // Sync data on change
    const syncField = (cls, field) => {
      row.querySelector(cls).addEventListener('input', e => {
        const p = players.find(x => x._id === pid);
        if (p) p[field] = e.target.value;
      });
    };
    syncField('.p-nombre',    'nombre');
    syncField('.p-documento', 'documento');
    syncField('.p-dorsal',    'dorsal');
    syncField('.p-posicion',  'posicion');
    syncField('.p-fecha',     'fecha_nac');

    // Select change
    row.querySelector('.p-posicion').addEventListener('change', e => {
      const p = players.find(x => x._id === pid);
      if (p) p.posicion = e.target.value;
    });

    // Remove
    row.querySelector('.btn-remove-player').addEventListener('click', () => {
      players = players.filter(p => p._id !== pid);
      row.remove();
      updatePlayersUI();
      renumberRows();
    });

    return row;
  };

  const renumberRows = () => {
    document.querySelectorAll('.player-row').forEach((row, i) => {
      const title = row.querySelector('.player-row-title span');
      if (title) title.textContent = `Jugador #${i + 1}`;
    });
  };

  btnAddPlayer.addEventListener('click', () => {
    if (players.length >= 25) return;
    const pid = ++playerCounter;
    const player = { _id: pid, nombre: '', documento: '', posicion: '', dorsal: '', fecha_nac: '' };
    players.push(player);

    const row = buildPlayerRow(pid);
    playersList.insertBefore(row, playersEmpty);
    updatePlayersUI();

    // Scroll to new row
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    row.querySelector('.p-nombre').focus();
  });

  updatePlayersUI();

  // ──────────────────────────────────────────
  //  PASO 2 → Registrar equipo + jugadores
  // ──────────────────────────────────────────
  btnRegisterFinal.addEventListener('click', async () => {
    playersError.textContent = '';

    // Validar jugadores si los hay
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const n = i + 1;
      if (!p.nombre.trim())    { playersError.textContent = `Jugador #${n}: el nombre es obligatorio.`;    return; }
      if (!p.documento.trim()) { playersError.textContent = `Jugador #${n}: el documento es obligatorio.`; return; }
      if (!p.dorsal || p.dorsal < 1 || p.dorsal > 99) {
        playersError.textContent = `Jugador #${n}: el dorsal debe ser entre 1 y 99.`; return;
      }
      if (!p.posicion) { playersError.textContent = `Jugador #${n}: selecciona una posición.`; return; }
    }

    // Verificar dorsales únicos
    const dorsals = players.map(p => parseInt(p.dorsal));
    const uniqueDorsals = new Set(dorsals);
    if (dorsals.length !== uniqueDorsals.size) {
      playersError.textContent = 'Hay números de dorsal repetidos entre los jugadores.';
      return;
    }

    // Verificar documentos únicos
    const docs = players.map(p => p.documento.trim().toLowerCase());
    const uniqueDocs = new Set(docs);
    if (docs.length !== uniqueDocs.size) {
      playersError.textContent = 'Hay documentos repetidos entre los jugadores.';
      return;
    }

    btnRegisterFinal.disabled = true;
    btnRegisterFinal.textContent = 'Registrando equipo...';

    const name  = teamNameInput.value.trim();
    const email = emailInput.value.trim();
    const pass  = passInput.value;
    const city  = citySelect.value;

    // 1. Crear equipo
    const result = await DB.addTeam({ name, email, password: pass, city });

    if (!result.ok) {
      playersError.textContent = result.error;
      btnRegisterFinal.disabled = false;
      btnRegisterFinal.innerHTML = `
        <svg viewBox="0 0 20 20" fill="currentColor" width="18"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/></svg>
        Registrar Equipo`;
      return;
    }

    // 2. Guardar jugadores (si los hay)
    if (players.length > 0) {
      btnRegisterFinal.textContent = 'Guardando jugadores...';
      const playersResult = await DB.addPlayers(result.team.id, players);
      if (!playersResult.ok) {
        playersError.textContent = 'Equipo creado pero hubo un error al guardar jugadores: ' + playersResult.error;
        // No bloqueamos el login, el equipo ya fue creado
      }
    }

    // 3. Auto login
    await DB.login(email, pass);
    window.location.href = 'dashboard.html';
  });
});
