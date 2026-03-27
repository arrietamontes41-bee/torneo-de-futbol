/**
 * team-panel.js — Panel de gestión para equipos (rol: 'equipo')
 * Torneo de Fútbol – Montería, Córdoba
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Protección de ruta ──────────────────────────────────────────
  const session = DB.getSession();
  if (!session)              { window.location.href = 'index.html'; return; }
  if (session.rol !== 'equipo') { window.location.href = 'dashboard.html'; return; }

  // ── Estado global ───────────────────────────────────────────────
  let myTeam        = null;
  let myPlayers     = [];
  let allMatches    = [];
  let standings     = [];
  let pendingDelete = null;   // id del jugador a eliminar

  // ── Referencias DOM ─────────────────────────────────────────────
  const teamNameHeader      = document.getElementById('teamNameHeader');
  const dashUserName        = document.getElementById('dashUserName');
  const btnLogout           = document.getElementById('btnLogout');

  // Header equipo
  const heroTeamName  = document.getElementById('heroTeamName');
  const heroCity      = document.getElementById('heroCity');
  const heroEmail     = document.getElementById('heroEmail');

  // Stats
  const statPlayers   = document.getElementById('statPlayers');
  const statPJ        = document.getElementById('statPJ');
  const statPTS       = document.getElementById('statPTS');
  const statPos       = document.getElementById('statPos');

  // Tabs
  const tabBtns       = document.querySelectorAll('.tab-btn');
  const tabContents   = document.querySelectorAll('.tab-content');

  // Jugadores
  const btnShowAddPlayer = document.getElementById('btnShowAddPlayer');
  const addPlayerForm    = document.getElementById('addPlayerForm');
  const btnSavePlayer    = document.getElementById('btnSavePlayer');
  const btnCancelPlayer  = document.getElementById('btnCancelPlayer');
  const playerName       = document.getElementById('playerName');
  const playerDoc        = document.getElementById('playerDoc');
  const playerDorsal     = document.getElementById('playerDorsal');
  const playerPos        = document.getElementById('playerPos');
  const playerDob        = document.getElementById('playerDob');
  const playerFormError  = document.getElementById('playerFormError');
  const rosterContainer  = document.getElementById('rosterContainer');

  // Partidos
  const homeMatchesContainer = document.getElementById('homeMatchesContainer');
  const matchesContainer     = document.getElementById('matchesContainer');

  // Standings
  const standingsContainer = document.getElementById('standingsContainer');

  // Modal eliminar
  const deletePlayerModal      = document.getElementById('deletePlayerModal');
  const deletePlayerName       = document.getElementById('deletePlayerName');
  const btnConfirmDeletePlayer = document.getElementById('btnConfirmDeletePlayer');
  const btnCancelDeletePlayer  = document.getElementById('btnCancelDeletePlayer');
  const closeDeletePlayerModal = document.getElementById('closeDeletePlayerModal');

  // ════════════════════════════════════════════════════════════════
  // INICIALIZACIÓN
  // ════════════════════════════════════════════════════════════════
  dashUserName.textContent = session.nombre || session.email;
  btnLogout.addEventListener('click', () => {
    DB.clearSession();
    window.location.href = 'index.html';
  });

  await loadAll();

  // ── Tabs ────────────────────────────────────────────────────────
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      tabContents.forEach(c => c.classList.toggle('active', c.id === `tabContent${capitalize(target)}`));

      if (target === 'matches')   renderMatchesTab();
      if (target === 'standings') renderStandings();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // CARGA PRINCIPAL
  // ════════════════════════════════════════════════════════════════
  async function loadAll() {
    // Buscar el equipo del usuario actual
    const teams = await DB.getTeams();
    myTeam = teams.find(t => t.usuario_id === session.id) || null;

    if (!myTeam) {
      heroTeamName.textContent = 'Sin equipo';
      teamNameHeader.textContent = 'Sin equipo asignado';
      return;
    }

    teamNameHeader.textContent = myTeam.nombre;

    // Datos en paralelo
    [myPlayers, allMatches, standings] = await Promise.all([
      DB.getPlayersByTeam(myTeam.id),
      DB.getMatches(),
      DB.getStandings()
    ]);

    renderHero();
    renderStats();
    renderHomeMatches();
    renderRoster();
  }

  // ════════════════════════════════════════════════════════════════
  // HERO DEL EQUIPO
  // ════════════════════════════════════════════════════════════════
  function renderHero() {
    heroTeamName.textContent = myTeam.nombre;
    heroCity.textContent     = myTeam.municipio || '—';
    heroEmail.textContent    = myTeam.email || '—';
  }

  // ════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS
  // ════════════════════════════════════════════════════════════════
  function renderStats() {
    statPlayers.textContent = myPlayers.length;

    const myRow = standings.find(s => s.team.id === myTeam.id);
    if (myRow) {
      statPJ.textContent  = myRow.pj;
      statPTS.textContent = myRow.pts;
      const pos = standings.indexOf(myRow) + 1;
      statPos.textContent = pos + (pos === 1 ? '°🥇' : pos === 2 ? '°🥈' : pos === 3 ? '°🥉' : '°');
    } else {
      statPJ.textContent = '0';
      statPTS.textContent = '0';
      statPos.textContent = '—';
    }
  }

  // ════════════════════════════════════════════════════════════════
  // PARTIDOS EN HOME
  // ════════════════════════════════════════════════════════════════
  function renderHomeMatches() {
    const myMatches = allMatches.filter(m =>
      m.equipo_local_id === myTeam.id || m.equipo_visit_id === myTeam.id
    );

    if (!myMatches.length) {
      homeMatchesContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>Aún no tienes partidos programados.</p></div>`;
      return;
    }

    homeMatchesContainer.innerHTML = `<div class="next-matches-list">${myMatches.map(m => matchItemHTML(m)).join('')}</div>`;
  }

  function matchItemHTML(m) {
    const localName = m.equipo_local?.nombre || '—';
    const visitName = m.equipo_visit?.nombre || '—';
    const isLocal   = m.equipo_local_id === myTeam.id;

    const localTag  = isLocal ? `<span class="my-team-name">${localName}</span>` : localName;
    const visitTag  = !isLocal ? `<span class="my-team-name">${visitName}</span>` : visitName;

    const fechaStr = m.fecha ? new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const horaStr  = m.hora ? m.hora.slice(0,5) : '';

    const statusPill = m.estado === 'finalizado'
      ? `<span class="match-status-pill pill-done">Finalizado</span>`
      : `<span class="match-status-pill pill-pending">Pendiente</span>`;

    const result = m.estado === 'finalizado'
      ? `<span class="match-result">${m.goles_local} – ${m.goles_visit}</span>`
      : '';

    return `
      <div class="next-match-item">
        <div>
          <div class="next-match-teams">${localTag} <span class="vs">VS</span> ${visitTag}</div>
          <div class="next-match-date">📅 ${fechaStr}${horaStr ? ` &nbsp;⏰ ${horaStr}` : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${result}
          ${statusPill}
        </div>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // ROSTER (TAB JUGADORES)
  // ════════════════════════════════════════════════════════════════
  function renderRoster() {
    if (!myPlayers.length) {
      rosterContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🦺</div>
          <p>No hay jugadores en tu plantilla todavía.<br/>Haz clic en <strong>Agregar Jugador</strong> para comenzar.</p>
        </div>`;
      return;
    }

    rosterContainer.innerHTML = `
      <table class="roster-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Posición</th>
            <th>Fecha Nac.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${myPlayers.map(p => `
            <tr>
              <td><span class="dorsal-badge">${p.dorsal}</span></td>
              <td>${escapeHTML(p.nombre)}</td>
              <td style="color:var(--gray-400);font-size:.8rem;">${escapeHTML(p.documento)}</td>
              <td><span class="pos-badge pos-${p.posicion}">${p.posicion}</span></td>
              <td style="color:var(--gray-400);font-size:.8rem;">${p.fecha_nac ? new Date(p.fecha_nac+'T00:00:00').toLocaleDateString('es-CO') : '—'}</td>
              <td>
                <button class="btn-delete-player" data-id="${p.id}" data-name="${escapeHTML(p.nombre)}">
                  🗑 Eliminar
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    // Eventos de eliminar
    rosterContainer.querySelectorAll('.btn-delete-player').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingDelete = btn.dataset.id;
        deletePlayerName.textContent = btn.dataset.name;
        deletePlayerModal.classList.remove('hidden');
      });
    });
  }

  // ── Mostrar/ocultar formulario ──────────────────────────────────
  btnShowAddPlayer.addEventListener('click', () => {
    addPlayerForm.classList.remove('hidden');
    btnShowAddPlayer.disabled = true;
    playerName.focus();
  });

  btnCancelPlayer.addEventListener('click', () => {
    resetPlayerForm();
  });

  // ── Guardar jugador ─────────────────────────────────────────────
  btnSavePlayer.addEventListener('click', async () => {
    playerFormError.textContent = '';

    const nombre   = playerName.value.trim();
    const doc      = playerDoc.value.trim();
    const dorsal   = parseInt(playerDorsal.value);
    const posicion = playerPos.value;
    const dob      = playerDob.value || null;

    if (!nombre)              return showFormError('El nombre es obligatorio.');
    if (!doc)                 return showFormError('El documento es obligatorio.');
    if (!dorsal || dorsal < 1 || dorsal > 99)
                              return showFormError('El dorsal debe ser entre 1 y 99.');
    if (!posicion)            return showFormError('Selecciona una posición.');
    if (myPlayers.length >= 25) return showFormError('Máximo 25 jugadores por equipo.');

    btnSavePlayer.disabled = true;
    btnSavePlayer.textContent = 'Guardando...';

    const result = await DB.addPlayers(myTeam.id, [{
      nombre, documento: doc, posicion, dorsal, fecha_nac: dob
    }]);

    if (!result.ok) {
      showFormError(result.error || 'Error al guardar jugador.');
      btnSavePlayer.disabled = false;
      btnSavePlayer.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Guardar`;
      return;
    }

    // Recargar jugadores
    myPlayers = await DB.getPlayersByTeam(myTeam.id);
    statPlayers.textContent = myPlayers.length;
    renderRoster();
    resetPlayerForm();
  });

  // ── Modal eliminar jugador ──────────────────────────────────────
  [btnCancelDeletePlayer, closeDeletePlayerModal].forEach(el => {
    el.addEventListener('click', () => {
      deletePlayerModal.classList.add('hidden');
      pendingDelete = null;
    });
  });

  btnConfirmDeletePlayer.addEventListener('click', async () => {
    if (!pendingDelete) return;
    btnConfirmDeletePlayer.disabled = true;
    btnConfirmDeletePlayer.textContent = 'Eliminando...';

    const result = await DB.deletePlayer(pendingDelete);

    btnConfirmDeletePlayer.disabled = false;
    btnConfirmDeletePlayer.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg> Sí, eliminar`;

    if (!result.ok) {
      alert('Error al eliminar el jugador: ' + (result.error || ''));
      return;
    }

    myPlayers = await DB.getPlayersByTeam(myTeam.id);
    statPlayers.textContent = myPlayers.length;
    renderRoster();
    deletePlayerModal.classList.add('hidden');
    pendingDelete = null;
  });

  // Cerrar modal al hacer clic fuera
  deletePlayerModal.addEventListener('click', (e) => {
    if (e.target === deletePlayerModal) {
      deletePlayerModal.classList.add('hidden');
      pendingDelete = null;
    }
  });

  // ════════════════════════════════════════════════════════════════
  // TAB: PARTIDOS (completo)
  // ════════════════════════════════════════════════════════════════
  async function renderMatchesTab() {
    allMatches = await DB.getMatches();
    const myMatches = allMatches.filter(m =>
      m.equipo_local_id === myTeam.id || m.equipo_visit_id === myTeam.id
    );

    if (!myMatches.length) {
      matchesContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>No hay partidos programados para tu equipo.</p></div>`;
      return;
    }

    matchesContainer.innerHTML = `<div class="next-matches-list">${myMatches.map(m => matchItemHTML(m)).join('')}</div>`;
  }

  // ════════════════════════════════════════════════════════════════
  // TAB: TABLA DE POSICIONES
  // ════════════════════════════════════════════════════════════════
  async function renderStandings() {
    standingsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p>Cargando...</p></div>`;
    standings = await DB.getStandings();

    if (!standings.length) {
      standingsContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>Aún no hay datos de posiciones.</p></div>`;
      return;
    }

    standingsContainer.innerHTML = `
      <table class="roster-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PE</th>
            <th>PP</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((s, i) => {
            const isMyTeam = s.team.id === myTeam?.id;
            return `
              <tr style="${isMyTeam ? 'background:rgba(99,102,241,.12);' : ''}">
                <td style="font-weight:700;color:${i < 3 ? '#fde047' : 'rgba(255,255,255,.5)'};">${i + 1}</td>
                <td style="font-weight:${isMyTeam ? '700' : '400'};color:${isMyTeam ? '#a5b4fc' : 'rgba(255,255,255,.85)'};">
                  ${isMyTeam ? '⭐ ' : ''}${escapeHTML(s.team.nombre)}
                </td>
                <td>${s.pj}</td>
                <td style="color:#86efac;">${s.pg}</td>
                <td>${s.pe}</td>
                <td style="color:#fca5a5;">${s.pp}</td>
                <td>${s.gf}</td>
                <td>${s.gc}</td>
                <td>${s.gf - s.gc > 0 ? '+' : ''}${s.gf - s.gc}</td>
                <td style="font-weight:700;color:#fff;">${s.pts}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  // ════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ════════════════════════════════════════════════════════════════
  function resetPlayerForm() {
    addPlayerForm.classList.add('hidden');
    btnShowAddPlayer.disabled = false;
    playerName.value = '';
    playerDoc.value  = '';
    playerDorsal.value = '';
    playerPos.value  = '';
    playerDob.value  = '';
    playerFormError.textContent = '';
    btnSavePlayer.disabled = false;
    btnSavePlayer.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Guardar`;
  }

  function showFormError(msg) {
    playerFormError.textContent = msg;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
