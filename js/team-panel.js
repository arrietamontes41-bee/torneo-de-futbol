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
      alert('La imagen debe pesar menos de 2MB.');
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      photoBase64 = e.target.result;
      photoPreview.innerHTML = `<img src="${photoBase64}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
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
    if (nombre.length < 3)              return showErr('El nombre debe tener al menos 3 caracteres.');
    if (!doc)                           return showErr('El documento es obligatorio.');
    if (!dorsal || dorsal < 1 || dorsal > 99) return showErr('El dorsal debe ser entre 1 y 99.');
    if (!posicion)                      return showErr('Selecciona una posición.');
    if (players.length >= 25)           return showErr('Máximo 25 jugadores por equipo.');

    // Verificar dorsal duplicado en jugadores existentes
    if (players.some(p => Number(p.dorsal) === dorsal))
      return showErr(`El dorsal ${dorsal} ya está en uso por otro jugador del equipo.`);

    // Verificar documento duplicado en jugadores existentes
    if (players.some(p => p.documento.trim().toLowerCase() === doc.toLowerCase()))
      return showErr('Este número de documento ya está registrado en el equipo.');

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

    players = await DB.getPlayersByTeam(myTeam.id);
    sPlayers.textContent = players.length;
    renderPlayers();
    resetForm();
  });

  // ── Modal eliminar ───────────────────────────────────────────
  cancelDel.addEventListener('click', () => { deleteModal.classList.add('hidden'); pendingDelId = null; });
  deleteModal.addEventListener('click', e => { if (e.target === deleteModal) { deleteModal.classList.add('hidden'); pendingDelId = null; } });

  confirmDel.addEventListener('click', async () => {
    if (!pendingDelId) return;
    confirmDel.disabled = true;
    confirmDel.textContent = 'Eliminando...';

    const res = await DB.deletePlayer(pendingDelId);

    confirmDel.disabled = false;
    confirmDel.textContent = 'Sí, eliminar';

    if (!res.ok) { alert('Error: ' + (res.error || '')); return; }

    players = await DB.getPlayersByTeam(myTeam.id);
    sPlayers.textContent = players.length;
    renderPlayers();
    deleteModal.classList.add('hidden');
    pendingDelId = null;
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
      homeMatchesEl.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>No se encontró tu equipo. Contacta al administrador.</div>`;
      return;
    }

    // Nombre en header
    headerTeamName.textContent = myTeam.nombre;
    teamNameBig.textContent    = myTeam.nombre;
    teamCity.textContent       = myTeam.municipio || '—';
    teamEmail.textContent      = myTeam.email || '—';

    // Escudo con iniciales
    const ini = myTeam.nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    teamShield.textContent = '';
    teamShield.style.fontSize = '1.3rem';
    teamShield.style.fontWeight = '800';
    teamShield.style.color = '#fff';
    teamShield.textContent = ini;

    [players, matches, standings] = await Promise.all([
      DB.getPlayersByTeam(myTeam.id),
      DB.getMatches(),
      DB.getStandings()
    ]);

    renderStats();
    renderPlayers();
    renderHomeMatches();
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
  function renderPlayers() {
    playerCount.textContent = players.length ? `(${players.length} jugadores)` : '';

    if (!players.length) {
      playersGrid.innerHTML = `<div class="empty"><div class="empty-icon">🦺</div>No hay jugadores aún.<br/>Haz clic en <strong>Agregar Jugador</strong>.</div>`;
      return;
    }

    playersGrid.innerHTML = `<div class="players-grid">${players.map(p => playerCard(p)).join('')}</div>`;

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
      : `<div class="player-photo-placeholder">👤</div>`;

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
        <button class="btn-remove-card" data-id="${p.id}" data-name="${esc(p.nombre)}">🗑 Eliminar</button>
      </div>`;
  }

  // ── Partidos (tab inicio) ────────────────────────────────────
  function renderHomeMatches() {
    const mine = myMatches();
    if (!mine.length) {
      homeMatchesEl.innerHTML = `<div class="empty"><div class="empty-icon">📅</div>Aún no tienes partidos programados.</div>`;
      return;
    }
    homeMatchesEl.innerHTML = mine.map(m => matchRow(m)).join('');
  }

  // ── Partidos (tab partidos) ──────────────────────────────────
  async function renderMatchList() {
    matches = await DB.getMatches();
    const mine = myMatches();
    if (!mine.length) {
      matchListEl.innerHTML = `<div class="empty"><div class="empty-icon">📅</div>No hay partidos para tu equipo.</div>`;
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
          <div class="match-row-date">📅 ${fecha}${hora ? ' · ⏰ ' + hora : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${done ? `<span class="match-result-score">${m.goles_local} – ${m.goles_visit}</span>` : ''}
          <span class="pill ${done ? 'pill-done' : 'pill-pend'}">${done ? 'Finalizado' : 'Pendiente'}</span>
        </div>
      </div>`;
  }

  // ── Tabla posiciones ─────────────────────────────────────────
  async function renderStandings() {
    standingsWrap.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div>Calculando...</div>`;
    standings = await DB.getStandings();

    if (!standings.length) {
      standingsWrap.innerHTML = `<div class="empty"><div class="empty-icon">🏆</div>Aún no hay datos.</div>`;
      return;
    }

    const rows = standings.map((s, i) => {
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

    standingsWrap.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="pos-table">
          <thead>
            <tr>
              <th>#</th><th>Equipo</th><th title="Partidos Jugados">PJ</th>
              <th title="Ganados">PG</th><th title="Empatados">PE</th><th title="Perdidos">PP</th>
              <th>GF</th><th>GC</th><th>DG</th><th>PTS</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="font-size:.72rem;color:rgba(255,255,255,.3);margin-top:10px;text-align:right;">
        Criterios: Puntos · Diferencia de goles · Goles a favor
      </p>`;
  }

  // ── Helpers ──────────────────────────────────────────────────
  function resetForm() {
    addPlayerForm.style.display = 'none';
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

  // ── Iniciar ──────────────────────────────────────────────────
  await loadAll();
});
