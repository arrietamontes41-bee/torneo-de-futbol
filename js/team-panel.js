/**
 * team-panel.js — Panel de Equipo
 * Solo para rol 'equipo'. Gestión de jugadores con foto.
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Auth Guard ────────────────────────────────────────────────
  const session = DB.getSession();
  if (!session)               { window.location.href = 'index.html';   return; }
  if (session.rol === 'admin') { window.location.href = 'dashboard.html'; return; }

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

    // Verificar documento duplicado a nivel GLOBAL (todos los equipos del torneo)
    const docCheck = await DB.checkDocumentoGlobal(doc);
    if (docCheck.exists)
      return showErr(`La cédula ${doc} ya está registrada en el equipo "${docCheck.equipo}". Un jugador no puede pertenecer a dos equipos.`);

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
    teamShield.innerHTML = '<span class="loading-icon-big"><i class="fa-solid fa-hourglass-half"></i></span>';
    
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
      homeMatchesEl.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>No se encontró tu equipo. Contacta al administrador.</div>`;
      return;
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
      DB.getMatches(),
      DB.getStandings()
    ]);

    renderStats();
    renderPlayers();
    renderHomeMatches();
    renderHomeStars();
    renderFinesAlert();
    renderNotifications();
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
        <h3 class="fines-container-title"><i class="fa-solid fa-triangle-exclamation"></i> Tienes tarjetas con multa pendiente de pago</h3>
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
        <h3 class="fines-container-title" style="color:#166534;">🔔 Tienes nuevas notificaciones</h3>
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
      : '\ud83d\udc64';

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
      playersGrid.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-shirt"></i></div>No hay jugadores aún.<br/>Haz clic en <strong>Agregar Jugador</strong>.</div>`;
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
  }

  function playerCard(p) {
    const foto = p.foto
      ? `<img src="${p.foto}" alt="${esc(p.nombre)}" class="player-photo" />`
      : `<div class="player-photo-placeholder"><i class="fa-solid fa-user"></i></div>`;

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
        <button class="btn-carnet-card" data-id="${p.id}">🎫 Ver Carnet</button>
        <button class="btn-remove-card" data-id="${p.id}" data-name="${esc(p.nombre)}">🗑 Eliminar</button>
      </div>`;
  }

  // ── Estrellas del torneo (inicio) ────────────────────────────────
  async function renderHomeStars() {
    const starScorer = $('starScorer');
    const starKeeper = $('starKeeper');

    if (!starScorer || !starKeeper) return;

    const [scorers, keepers] = await Promise.all([
      DB.getTopScorers(1),
      DB.getBestGoalkeepers(1)
    ]);

    // ─ Máximo goleador
    if (scorers.length > 0) {
      const s = scorers[0];
      const foto = s.foto
        ? `<img src="${s.foto}" alt="${esc(s.nombre)}" />`
        : '<i class="fa-solid fa-user"></i>';
      starScorer.innerHTML = `
        <div class="star-card-label"><i class="fa-solid fa-futbol"></i> Máximo Goleador</div>
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
      starScorer.innerHTML = `<div class="star-card-label"><i class="fa-solid fa-futbol"></i> Máximo Goleador</div><div class="empty star-empty-msg"><div class="empty-icon"><i class="fa-solid fa-futbol"></i></div>Sin goles registrados</div>`;
    }

    // ─ Portero valla menos vencida
    if (keepers.length > 0) {
      const k = keepers[0];
      const foto = k.foto
        ? `<img src="${k.foto}" alt="${esc(k.nombre)}" />`
        : '🧴';
      starKeeper.innerHTML = `
        <div class="star-card-label">🧾 Valla Menos Vencida</div>
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
      starKeeper.innerHTML = `<div class="star-card-label">🧾 Valla Menos Vencida</div><div class="empty star-empty-msg"><div class="empty-icon"><i class="fa-solid fa-shield-halved"></i></div>Sin datos aún</div>`;
    }
  }

  // ── Partidos (tab inicio) ────────────────────────────────────
  function renderHomeMatches() {
    const mine = myMatches();
    if (!mine.length) {
      homeMatchesEl.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-calendar-days"></i></div>Aún no tienes partidos programados.</div>`;
      return;
    }
    homeMatchesEl.innerHTML = mine.map(m => matchRow(m)).join('');
  }

  // ── Partidos (tab partidos) ──────────────────────────────────
  async function renderMatchList() {
    matches = await DB.getMatches();
    const mine = myMatches();
    if (!mine.length) {
      matchListEl.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-calendar-days"></i></div>No hay partidos para tu equipo.</div>`;
      return;
    }
    matchListEl.innerHTML = mine.map(m => matchRow(m)).join('');
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
          <div class="match-row-date"><i class="fa-solid fa-calendar-days"></i> ${fecha}${hora ? ' · ⏰ ' + hora : ''}</div>
        </div>
        <div class="flex-center-gap10">
          ${done ? `<span class="match-result-score">${m.goles_local} – ${m.goles_visit}</span>` : ''}
          <span class="pill ${done ? 'pill-done' : 'pill-pend'}">${done ? 'Finalizado' : 'Pendiente'}</span>
        </div>
      </div>`;
  }

  // ── Tabla posiciones ─────────────────────────────────────────
  async function renderStandings() {
    standingsWrap.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-hourglass-half"></i></div>Calculando...</div>`;
    standings = await DB.getStandings();
    if (!standings.length) {
      standingsWrap.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-trophy"></i></div>Aún no hay datos.</div>`;
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
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
        return `<tr class="${mine ? 'my-row' : ''}">
          <td style="font-weight:700;">${medal}</td>
          <td>${mine ? '⭐ ' : ''}${esc(s.team.nombre)}</td>
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
        ${groupNames.length > 1 ? `<h3 style="margin: 20px 0 10px 0; color: #fff; font-size: 1.2rem;"><i class="fa-solid fa-trophy"></i> Grupo: ${esc(gName)}</h3>` : ''}
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
    photoPreview.innerHTML = '📷';
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
