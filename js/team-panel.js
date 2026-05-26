/**
 * team-panel.js — Panel de Equipo
 * Solo para rol 'equipo'. Gestión de jugadores con foto.
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth Guard ────────────────────────────────────────────────
  const session = DB.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  if (session.rol === 'admin') {
    // El admin debe ir al dashboard, no al panel de equipo
    document.body.innerHTML = `
      <div style="
        min-height:100vh; display:flex; flex-direction:column; align-items:center;
        justify-content:center; background:#0f172a; color:#f1f5f9; gap:16px;
        font-family:system-ui,sans-serif; padding:24px; text-align:center;
      ">
        <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" width="64" height="64"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
        <h1 style="font-size:1.6rem; margin:0;">Panel de Administrador</h1>
        <p style="color:#94a3b8; max-width:360px; margin:0;">
          Como administrador, tu área de trabajo es el Dashboard.
          Serás redirigido automáticamente...
        </p>
        <div style="width:40px; height:4px; border-radius:2px; background:#6366f1;
          animation: prog 2s linear forwards;"></div>
        <style>@keyframes prog { from{width:40px} to{width:200px} }</style>
      </div>`;
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2200);
    return;
  }

  // ── Estado ───────────────────────────────────────────────────
  let myTeam    = null;
  let players   = [];
  let matches   = [];
  let standings = [];
  let pendingDelId = null;
  let photoBase64  = null;   // foto del jugador a agregar

  // ── DOM ──────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const headerTeamName = $('headerTeamName');
  const teamNameBig    = $('teamNameBig');
  const teamCity       = $('teamCity');
  const teamEmail      = $('teamEmail');
  const teamShield     = $('teamShield');
  const userAvatar     = $('userAvatar');
  const userName       = $('userName');
  const btnLogout      = $('btnLogout');

  const sPlayers = $('sPlayers');
  const sPJ      = $('sPJ');
  const sPTS     = $('sPTS');
  const sPOS     = $('sPOS');

  const addPlayerForm = $('addPlayerForm');
  const btnShowForm   = $('btnShowForm');
  const btnCancelPlayer = $('btnCancelPlayer');
  const btnSavePlayer   = $('btnSavePlayer');
  const photoInput      = $('photoInput');
  const photoPreview    = $('photoPreview');
  const playerErr       = $('playerErr');
  const pName    = $('pName');
  const pDoc     = $('pDoc');
  const pDorsal  = $('pDorsal');
  const pPos     = $('pPos');
  const pDob     = $('pDob');
  const playerCount = $('playerCount');
  const playersGrid = $('playersGrid');

  const homeMatchesEl  = $('homeMatches');
  const matchListEl    = $('matchList');
  const standingsWrap  = $('standingsWrap');

  const deleteModal = $('deleteModal');
  const delName     = $('delName');
  const confirmDel  = $('confirmDel');
  const cancelDel   = $('cancelDel');

  const notificationsContainer = $('notificationsContainer');
  const btnExportExcelTeam = $('btnExportExcelTeam');

  // Carnet modal
  const carnetModal  = $('carnetModal');
  const carnetPhoto  = $('carnetPhoto');
  const carnetDorsal = $('carnetDorsal');
  const carnetName   = $('carnetName');
  const carnetPos    = $('carnetPos');
  const carnetDoc    = $('carnetDoc');
  const carnetDob    = $('carnetDob');
  const carnetShield = $('carnetShield');
  const carnetTeam   = $('carnetTeam');
  const btnCarnetClose = $('btnCarnetClose');

  // ── Header usuario ───────────────────────────────────────────
  const initials = (session.nombre || session.email || '?').charAt(0).toUpperCase();
  userAvatar.textContent = initials;
  userName.textContent   = session.nombre || session.email;

  btnLogout.addEventListener('click', () => {
    DB.clearSession();
    window.location.href = 'index.html';
  });

  // ── Tabs ─────────────────────────────────────────────────────
  document.querySelectorAll('.panel-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = 'sec-' + btn.dataset.sec;
      document.getElementById(sec).classList.add('active');
      if (btn.dataset.sec === 'partidos')   renderMatchList();
      if (btn.dataset.sec === 'posiciones') renderStandings();
    });
  });

  // ── Foto preview ─────────────────────────────────────────────
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen debe pesar menos de 2MB.', 'error');
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      photoBase64 = e.target.result;
      photoPreview.innerHTML = `<img src="${photoBase64}" alt="foto" class="photo-img-full" />`;
    };
    reader.readAsDataURL(file);
  });

  // ── Formulario jugador ───────────────────────────────────────
  btnShowForm.addEventListener('click', () => {
    addPlayerForm.style.display = 'block';
    btnShowForm.style.display = 'none';
    pName.focus();
  });

  btnCancelPlayer.addEventListener('click', resetForm);

  btnSavePlayer.addEventListener('click', async () => {
    playerErr.textContent = '';
    const nombre   = pName.value.trim();
    const doc      = pDoc.value.trim();
    const dorsal   = parseInt(pDorsal.value);
    const posicion = pPos.value;
    const dob      = pDob.value || null;

    if (!nombre)                        return showErr('El nombre es obligatorio.');
    if (nombre.length < 3 || nombre.length > 80) return showErr('El nombre debe tener entre 3 y 80 letras.');
    if (!doc)                           return showErr('El documento es obligatorio.');
    if (!/^\d+$/.test(doc))             return showErr('El documento debe contener solo números.');
    if (!dorsal || dorsal < 1 || dorsal > 999) return showErr('El dorsal debe ser un número entre 1 y 999.');
    if (!posicion)                      return showErr('Selecciona una posición.');

    if (dob) {
      const pDate = new Date(dob);
      const today = new Date();
      if (pDate >= today) return showErr('La fecha de nacimiento no puede ser en el futuro.');
      if (today.getFullYear() - pDate.getFullYear() < 5) return showErr('El jugador debe tener al menos 5 años.');
      if (pDate.getFullYear() < 1950) return showErr('La fecha de nacimiento es demasiado antigua.');
    }

    if (players.length >= 25)           return showErr('Máximo 25 jugadores por equipo.');

    // Verificar dorsal duplicado en jugadores existentes
    if (players.some(p => Number(p.dorsal) === dorsal))
      return showErr(`El dorsal ${dorsal} ya está en uso por otro jugador del equipo.`);

    // Verificar documento duplicado a nivel de TORNEO (el jugador no puede estar en dos equipos del mismo torneo)
    const docCheck = await DB.checkDocumentoGlobal(doc, myTeam.torneo_id);
    if (docCheck.exists)
      return showErr(`La cédula ${doc} ya está registrada en el equipo "${docCheck.equipo}" de este torneo. Un jugador no puede pertenecer a dos equipos en el mismo torneo.`);

    btnSavePlayer.disabled = true;
    btnSavePlayer.textContent = 'Guardando...';

    const result = await DB.addPlayers(myTeam.id, [{
      nombre, documento: doc, posicion, dorsal,
      fecha_nac: dob,
      foto: photoBase64 || null
    }]);

    btnSavePlayer.disabled = false;
    btnSavePlayer.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Guardar Jugador`;

    if (!result.ok) return showErr(result.error || 'Error al guardar.');

    showToast('Jugador guardado correctamente.', 'success');
    players = await DB.getPlayersByTeam(myTeam.id);
    sPlayers.textContent = players.length;
    renderPlayers();
    resetForm();
  });

  // ── Modal eliminar ───────────────────────────────────────────
  cancelDel.addEventListener('click', () => { deleteModal.classList.add('hidden'); pendingDelId = null; });
  deleteModal.addEventListener('click', e => { if (e.target === deleteModal) { deleteModal.classList.add('hidden'); pendingDelId = null; } });

  // Carnet modal — cerrar
  btnCarnetClose.addEventListener('click', () => carnetModal.classList.add('hidden'));
  carnetModal.addEventListener('click', e => { if (e.target === carnetModal) carnetModal.classList.add('hidden'); });

  confirmDel.addEventListener('click', async () => {
    if (!pendingDelId) return;
    confirmDel.disabled = true;
    confirmDel.textContent = 'Eliminando...';

    const res = await DB.deletePlayer(pendingDelId);

    confirmDel.disabled = false;
    confirmDel.textContent = 'Sí, eliminar';

    if (!res.ok) { showToast('Error: ' + (res.error || ''), 'error'); return; }

    players = await DB.getPlayersByTeam(myTeam.id);
    sPlayers.textContent = players.length;
    renderPlayers();
    showToast('Jugador eliminado.', 'success');
    deleteModal.classList.add('hidden');
    pendingDelId = null;
  });

  // ── Actualizar Escudo ──────────────────────────────────────────────
  const updateShieldInput = $('updateShieldInput');
  updateShieldInput.addEventListener('change', () => {
    const file = updateShieldInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('El escudo debe pesar menos de 2MB.', 'error'); return; }
    
    // UI Carga temporal
    const oldHtml = teamShield.innerHTML;
    teamShield.innerHTML = '<span class="loading-icon-big"><svg style="animation: spin 1s linear infinite;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></span>';
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      const res = await DB.updateTeamShield(myTeam.id, base64);
      if (res.ok) {
        myTeam.escudo = base64;
        teamShield.innerHTML = `<img src="${base64}" alt="escudo" class="shield-img-full" />`;
        showToast('Escudo actualizado correctamente.', 'success');
      } else {
        showToast('Error al actualizar escudo: ' + res.error, 'error');
        teamShield.innerHTML = oldHtml;
      }
    };
    reader.readAsDataURL(file);
    updateShieldInput.value = '';
  });

  // ════════════════════════════════════════════════════════════
  // CARGA INICIAL
  // ════════════════════════════════════════════════════════════
  async function loadAll() {
    const allTeams = await DB.getTeams();
    myTeam = allTeams.find(t => t.usuario_id === session.id) || null;

    if (!myTeam) {
      teamNameBig.textContent    = 'Equipo no encontrado';
      headerTeamName.textContent = 'Mi Equipo';
      homeMatchesEl.innerHTML = `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg></div>No se encontró tu equipo. Contacta al administrador.</div>`;
      return;
    }

    // Cargar branding del torneo
    try {
      const tournament = await DB.getTournament(myTeam.torneo_id);
      if (tournament) {
        const teamHeaderEl = document.getElementById('teamHeaderTournamentName');
        const teamInicioEl = document.getElementById('teamInicioTournamentName');
        const carnetEl = document.getElementById('carnetTournamentName');
        
        if (teamHeaderEl) teamHeaderEl.textContent = tournament.nombre;
        if (teamInicioEl) {
          teamInicioEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="margin-right:8px; vertical-align:middle;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            ${tournament.nombre}
          `;
        }
        if (carnetEl) {
          carnetEl.innerHTML = `
            ${tournament.nombre.split('–')[0].split('-')[0].trim()}
            <strong>${tournament.municipio || 'Montería'}</strong>
          `;
        }
      }
    } catch (err) {
      console.error('Error al cargar branding del torneo en panel de equipo:', err);
    }

    // Nombre en header
    headerTeamName.textContent = myTeam.nombre;
    teamNameBig.textContent    = myTeam.nombre;
    teamCity.textContent       = myTeam.municipio || '—';
    teamEmail.textContent      = myTeam.email || '—';

    // Escudo: imagen real o iniciales
    const ini = myTeam.nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    teamShield.style.fontSize  = '1.3rem';
    teamShield.style.fontWeight = '800';
    teamShield.style.color     = '#fff';
    if (myTeam.escudo) {
      teamShield.innerHTML = `<img src="${myTeam.escudo}" alt="escudo" class="shield-img-full" />`;
    } else {
      teamShield.textContent = ini;
    }

    [players, matches, standings] = await Promise.all([
      DB.getPlayersByTeam(myTeam.id),
      DB.getMatches(myTeam.torneo_id),
      DB.getStandings(myTeam.torneo_id)
    ]);

    renderStats();
    renderPlayers();
    renderHomeMatches();
    renderHomeStars();
    renderFinesAlert();
    renderNotifications();

    const remHost = $('matchReminderHost');
    if (remHost && window.MatchReminders) {
      window.MatchReminders.renderTeamBanner(remHost, matches, myTeam.id);
    }
  }

  // ── Sanciones / Alertas ──────────────────────────────────────
  async function renderFinesAlert() {
    const finesContainer = $('finesAlertContainer');
    if (!finesContainer) return;
    
    const fines = await DB.getPendingFines(myTeam.id);
    if (!fines || fines.length === 0) {
      finesContainer.innerHTML = '';
      finesContainer.classList.add('hidden');
      return;
    }

    const finesHtml = fines.map(f => {
      const typeColor = f.tipo === 'roja' ? '#ef4444' : '#eab308';
      const typeLabel = f.tipo === 'roja' ? 'Tarjeta Roja' : 'Tarjeta Amarilla';
      const dateStr   = f.partidos?.fecha ? new Date(f.partidos.fecha).toLocaleDateString('es-CO') : '—';
      return `<div class="fines-alert-row">
                <div class="fines-alert-badge" style="background:${typeColor};"></div>
                <div class="fines-alert-info">
                  <strong class="fines-alert-title">${esc(f.jugadores?.nombre)} (Dorsal ${f.jugadores?.dorsal})</strong>
                  <div class="fines-alert-sub">Partido del ${dateStr}</div>
                </div>
                <div class="fines-alert-status" style="color:${typeColor};">Pendiente</div>
              </div>`;
    }).join('');

    finesContainer.innerHTML = `
      <div class="fines-container">
        <h3 class="fines-container-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg> Tienes tarjetas con multa pendiente de pago</h3>
        ${finesHtml}
        <p class="fines-container-footer">* Por favor, cancela la multa correspondiente con el organizador. El administrador retirará esta alerta al confirmar el pago.</p>
      </div>
    `;
    finesContainer.classList.remove('hidden');
  }

  // ── Notificaciones ─────────────────────────────────────────────
  async function renderNotifications() {
    if (!notificationsContainer) return;
    const notes = await DB.getNotifications(myTeam.id);
    const unread = notes.filter(n => !n.leida);
    
    if (unread.length === 0) {
      notificationsContainer.innerHTML = '';
      notificationsContainer.classList.add('hidden');
      return;
    }

    const html = unread.map(n => `
      <div class="fines-alert-row" style="background-color: #f0fdf4; border-color: #bbf7d0;">
        <div class="fines-alert-badge" style="background:#22c55e;"></div>
        <div class="fines-alert-info">
          <strong class="fines-alert-title" style="color:#166534;">Mensaje del Organizador</strong>
          <div class="fines-alert-sub" style="color:#15803d; font-size: 0.9rem; margin-top: 5px;">${esc(n.mensaje)}</div>
        </div>
        <button class="btn-primary-sm btn-mark-read" data-id="${n.id}" style="background-color: #16a34a; padding: 4px 8px; border-radius: 4px;">Entendido</button>
      </div>`).join('');

    notificationsContainer.innerHTML = `
      <div class="fines-container" style="border-color: #bbf7d0; background-color: #f0fdf4;">
        <h3 class="fines-container-title" style="color:#166534;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="vertical-align:middle; margin-right:4px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Tienes nuevas notificaciones</h3>
        ${html}
      </div>
    `;
    notificationsContainer.classList.remove('hidden');

    notificationsContainer.querySelectorAll('.btn-mark-read').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '...';
        await DB.markNotificationAsRead(btn.dataset.id);
        await renderNotifications();
      });
    });
  }

  // ── Stats ────────────────────────────────────────────────────
  function renderStats() {
    sPlayers.textContent = players.length;
    const row = standings.find(s => s.team.id === myTeam.id);
    if (row) {
      sPJ.textContent  = row.pj;
      sPTS.textContent = row.pts;
      const pos = standings.indexOf(row) + 1;
      sPOS.textContent = pos + '°';
    } else {
      sPJ.textContent = '0'; sPTS.textContent = '0'; sPOS.textContent = '—';
    }
  }

  // ── Jugadores (tarjetas con foto) ────────────────────────────
  // ── Carnet Digital ──────────────────────────────────────────────
  function openCarnet(p) {
    // Foto
    carnetPhoto.innerHTML = p.foto
      ? `<img src="${p.foto}" alt="${esc(p.nombre)}" />`
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="opacity:0.2;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

    // Datos
    carnetDorsal.textContent = `#${p.dorsal}`;
    carnetName.textContent   = p.nombre.length > 25 ? p.nombre.substring(0, 25) + '...' : p.nombre;

    // Posición con color
    carnetPos.textContent = p.posicion;
    carnetPos.className = `carnet-pos pos-${p.posicion}`;

    // Cédula
    carnetDoc.textContent = p.documento;

    // Fecha nacimiento
    carnetDob.textContent = p.fecha_nac
      ? new Date(p.fecha_nac + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    // Escudo e initials del equipo
    if (myTeam) {
      const ini = myTeam.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      if (myTeam.escudo) {
        carnetShield.innerHTML = `<img src="${myTeam.escudo}" alt="${esc(myTeam.nombre)}" />`;
      } else {
        carnetShield.textContent = ini;
      }
      carnetTeam.textContent = myTeam.nombre;
    }

    carnetModal.classList.remove('hidden');
  }

  function renderPlayers() {
    playerCount.textContent = players.length ? `(${players.length} jugadores)` : '';

    if (!players.length) {
      playersGrid.innerHTML = `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg></div>No hay jugadores aún.<br/>Haz clic en <strong>Agregar Jugador</strong>.</div>`;
      return;
    }

    playersGrid.innerHTML = `<div class="players-grid">${players.map(p => playerCard(p)).join('')}</div>`;

    playersGrid.querySelectorAll('.btn-carnet-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const player = players.find(p => p.id === btn.dataset.id);
        if (player) openCarnet(player);
      });
    });

    playersGrid.querySelectorAll('.btn-remove-card').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingDelId = btn.dataset.id;
        delName.textContent = btn.dataset.name;
        deleteModal.classList.remove('hidden');
      });
    });

    // ── Subir / Cambiar foto de jugador ya registrado ──────────
    playersGrid.querySelectorAll('.player-photo-file-input').forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          showToast('La imagen debe pesar menos de 2MB.', 'error');
          input.value = '';
          return;
        }
        const playerId = input.dataset.id;
        const label = input.closest('label');
        const origText = label.textContent.trim();
        label.style.opacity = '0.6';
        label.style.pointerEvents = 'none';

        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result;
          const res = await DB.updatePlayerPhoto(playerId, base64);
          label.style.opacity = '';
          label.style.pointerEvents = '';
          if (res.ok) {
            showToast('Foto actualizada correctamente.', 'success');
            players = await DB.getPlayersByTeam(myTeam.id);
            renderPlayers();
          } else {
            showToast('Error al subir la foto: ' + (res.error || ''), 'error');
          }
          input.value = '';
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function playerCard(p) {
    const foto = p.foto
      ? `<img src="${p.foto}" alt="${esc(p.nombre)}" class="player-photo" />`
      : `<div class="player-photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

    const fotoLabel = p.foto ? 'Cambiar foto' : 'Subir foto';

    const dob = p.fecha_nac
      ? new Date(p.fecha_nac + 'T00:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
      : '';

    return `
      <div class="player-card">
        <div class="player-dorsal-badge">${p.dorsal}</div>
        ${foto}
        <div class="player-name">${esc(p.nombre)}</div>
        <div class="player-pos-pill pos-${p.posicion}">${p.posicion}</div>
        <div class="player-doc">${esc(p.documento)}${dob ? ' · ' + dob : ''}</div>
        <label class="btn-upload-photo-card" title="${fotoLabel}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle; margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          ${fotoLabel}
          <input type="file" accept="image/*" class="player-photo-file-input" data-id="${p.id}" style="display:none;" />
        </label>
        <button class="btn-carnet-card" data-id="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle; margin-right:4px;"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg> Ver Carnet</button>
        <button class="btn-remove-card" data-id="${p.id}" data-name="${esc(p.nombre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle; margin-right:4px;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Eliminar</button>
      </div>`;
  }

  // ── Estrellas del torneo (inicio) ────────────────────────────────
  async function renderHomeStars() {
    const starScorer = $('starScorer');
    const starKeeper = $('starKeeper');

    if (!starScorer || !starKeeper) return;

    const [scorers, keepers] = await Promise.all([
      DB.getTopScorers(1, myTeam.torneo_id),
      DB.getBestGoalkeepers(1, myTeam.torneo_id)
    ]);

    // ─ Máximo goleador
    if (scorers.length > 0) {
      const s = scorers[0];
      const foto = s.foto
        ? `<img src="${s.foto}" alt="${esc(s.nombre)}" />`
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      starScorer.innerHTML = `
        <div class="star-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> Máximo Goleador</div>
        <div class="star-player-row">
          <div class="star-photo">${foto}</div>
          <div class="star-info">
            <div class="star-name">${esc(s.nombre)}</div>
            <div class="star-team">${esc(s.equipo)}</div>
          </div>
          <div class="star-badge">
            <span class="star-badge-num">${s.goles}</span>
            <span class="star-badge-lbl">goles</span>
          </div>
        </div>`;
    } else {
      starScorer.innerHTML = `<div class="star-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> Máximo Goleador</div><div class="empty star-empty-msg"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></div>Sin goles registrados</div>`;
    }

    // ─ Portero valla menos vencida
    if (keepers.length > 0) {
      const k = keepers[0];
      const foto = k.foto
        ? `<img src="${k.foto}" alt="${esc(k.nombre)}" />`
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>';
      starKeeper.innerHTML = `
        <div class="star-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="vertical-align:middle; margin-right:4px;"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6"/><path d="M16 12h-6"/><path d="M10 16h-4"/></svg> Valla Menos Vencida</div>
        <div class="star-player-row">
          <div class="star-photo">${foto}</div>
          <div class="star-info">
            <div class="star-name">${esc(k.nombre)}</div>
            <div class="star-team">${esc(k.equipo)}</div>
          </div>
          <div class="star-badge star-badge-alt">
            <span class="star-badge-num">${k.gc}</span>
            <span class="star-badge-lbl">en contra</span>
          </div>
        </div>`;
    } else {
      starKeeper.innerHTML = `<div class="star-card-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="vertical-align:middle; margin-right:4px;"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M16 8h-6"/><path d="M16 12h-6"/><path d="M10 16h-4"/></svg> Valla Menos Vencida</div><div class="empty star-empty-msg"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>Sin datos aún</div>`;
    }
  }

  // ── Partidos (tab inicio) ────────────────────────────────────
  function renderHomeMatches() {
    const mine = myMatches();
    if (!mine.length) {
      homeMatchesEl.innerHTML = `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>Aún no tienes partidos programados.</div>`;
      return;
    }
    homeMatchesEl.innerHTML = '<div class="match-rows-scroll">' + mine.map(m => matchRow(m)).join('') + '</div>';
  }

  // ── Partidos (tab partidos) ──────────────────────────────────
  async function renderMatchList() {
    matches = await DB.getMatches(myTeam.torneo_id);
    const mine = myMatches();
    if (!mine.length) {
      matchListEl.innerHTML = `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>No hay partidos para tu equipo.</div>`;
      return;
    }
    matchListEl.innerHTML = '<div class="match-rows-scroll">' + mine.map(m => matchRow(m)).join('') + '</div>';
  }

  function myMatches() {
    return matches.filter(m => m.equipo_local_id === myTeam.id || m.equipo_visit_id === myTeam.id);
  }

  function matchRow(m) {
    const localNombre = m.equipo_local?.nombre  || '—';
    const visitNombre = m.equipo_visit?.nombre || '—';
    const isLocal = m.equipo_local_id === myTeam.id;
    const localTag = isLocal ? `<span class="my">${esc(localNombre)}</span>` : esc(localNombre);
    const visitTag = !isLocal ? `<span class="my">${esc(visitNombre)}</span>` : esc(visitNombre);

    const fecha = m.fecha ? new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CO', { weekday:'short', day:'2-digit', month:'short' }) : '—';
    const hora  = m.hora ? m.hora.slice(0,5) : '';
    const done  = m.estado === 'finalizado';

    return `
      <div class="match-row">
        <div>
          <div class="match-row-teams">${localTag}<span class="vs">VS</span>${visitTag}</div>
          <div class="match-row-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${fecha}${hora ? ' · <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ' + hora : ''}</div>
        </div>
        <div class="flex-center-gap10">
          ${done ? `<span class="match-result-score">${m.goles_local} – ${m.goles_visit}</span>` : ''}
          <span class="pill ${done ? 'pill-done' : 'pill-pend'}">${done ? 'Finalizado' : 'Pendiente'}</span>
        </div>
      </div>`;
  }

  // ── Tabla posiciones ─────────────────────────────────────────
  async function renderStandings() {
    standingsWrap.innerHTML = `<div class="empty"><div class="empty-icon"><svg style="animation: spin 1s linear infinite;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>Calculando...</div>`;
    standings = await DB.getStandings(myTeam.torneo_id);
    if (!standings.length) {
      standingsWrap.innerHTML = `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg></div>Aún no hay datos.</div>`;
      return;
    }

    const groups = {};
    standings.forEach(r => {
      const g = r.team.grupo || 'Único';
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });

    let html = '';
    const groupNames = Object.keys(groups).sort();
    
    groupNames.forEach(gName => {
      const rowsHtml = groups[gName].map((s, i) => {
        const mine = s.team.id === myTeam?.id;
        const dg   = s.gf - s.gc;
        const medal = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1;
        return `<tr class="${mine ? 'my-row' : ''}">
          <td style="font-weight:700;">${medal}</td>
          <td>${mine ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle; margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ' : ''}${esc(s.team.nombre)}</td>
          <td>${s.pj}</td>
          <td>${s.pg}</td>
          <td>${s.pe}</td>
          <td>${s.pp}</td>
          <td>${s.gf}</td>
          <td>${s.gc}</td>
          <td>${dg > 0 ? '+' : ''}${dg}</td>
          <td style="font-weight:700;color:#fff;">${s.pts}</td>
        </tr>`;
      }).join('');

      html += `
        ${groupNames.length > 1 ? `<h3 style="margin: 20px 0 10px 0; color: #fff; font-size: 1.2rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> Grupo: ${esc(gName)}</h3>` : ''}
        <div class="overflow-x-auto" style="margin-bottom: 20px;">
          <table class="pos-table">
            <thead>
              <tr>
                <th>#</th><th>Equipo</th><th title="Partidos Jugados">PJ</th>
                <th title="Ganados">PG</th><th title="Empatados">PE</th><th title="Perdidos">PP</th>
                <th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    });

    standingsWrap.innerHTML = html + `
      <p class="standings-footer">
        Criterios: Puntos · Diferencia de goles · Goles a favor
      </p>`;
  }

  // ── Helpers ──────────────────────────────────────────────────
  function resetForm() {
    addPlayerForm.style.display = '';
    btnShowForm.style.display   = '';
    pName.value = ''; pDoc.value = ''; pDorsal.value = ''; pPos.value = ''; pDob.value = '';
    playerErr.textContent = '';
    photoBase64 = null;
    photoInput.value = '';
    photoPreview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    btnSavePlayer.disabled = false;
  }

  function showErr(msg) { playerErr.textContent = msg; }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Exportar a Excel ─────────────────────────────────────────
  if (btnExportExcelTeam) {
    btnExportExcelTeam.addEventListener('click', () => {
      if (!standings || !standings.length) {
        showToast('Primero abre la pestaña "Posiciones" para cargar los datos.', 'error');
        return;
      }

      const groups = {};
      standings.forEach(r => {
        const g = r.team.grupo || 'Único';
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
      });

      const groupNames = Object.keys(groups).sort();
      const headers = ['#', 'Equipo', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'PTS'];

      let csvContent = "\uFEFF"; // BOM para acentos

      groupNames.forEach(gName => {
        if (groupNames.length > 1) {
          csvContent += `"Grupo: ${gName}"\r\n`;
        }
        csvContent += headers.map(h => `"${h}"`).join(';') + "\r\n";
        groups[gName].forEach((s, i) => {
          const dg = s.gf - s.gc;
          const row = [
            i + 1,
            s.team.nombre,
            s.pj, s.pg, s.pe, s.pp,
            s.gf, s.gc,
            (dg > 0 ? '+' : '') + dg,
            s.pts
          ];
          csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + "\r\n";
        });
        csvContent += "\r\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'mi_tabla_posiciones.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Tabla exportada correctamente.', 'success');
    });
  }

  // ── Iniciar ──────────────────────────────────────────────────
  await loadAll();
});
