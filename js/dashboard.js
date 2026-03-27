/**
 * dashboard.js — Panel de administración (async con Supabase)
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ---- Auth Guard ----
  const session = DB.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  // ---- DOM refs ----
  const userRoleBadge  = document.getElementById('userRoleBadge');
  const dashUserName   = document.getElementById('dashUserName');
  const btnLogout      = document.getElementById('btnLogout');

  const statTeams      = document.getElementById('statTeams');
  const statScheduled  = document.getElementById('statScheduled');
  const statCompleted  = document.getElementById('statCompleted');

  const tabBtns        = document.querySelectorAll('.tab-btn');
  const tabContents    = document.querySelectorAll('.tab-content');

  const teamsContainer    = document.getElementById('teamsContainer');
  const btnNewMatch       = document.getElementById('btnNewMatch');
  const matchFormWrapper  = document.getElementById('matchFormWrapper');
  const matchForm         = document.getElementById('matchForm');
  const matchFormTitle    = document.getElementById('matchFormTitle');
  const editMatchId       = document.getElementById('editMatchId');
  const homeTeamSel       = document.getElementById('homeTeam');
  const awayTeamSel       = document.getElementById('awayTeam');
  const matchDateInput    = document.getElementById('matchDate');
  const matchTimeInput    = document.getElementById('matchTime');
  const matchFormError    = document.getElementById('matchFormError');
  const btnCancelMatch    = document.getElementById('btnCancelMatch');
  const matchesContainer  = document.getElementById('matchesContainer');
  const standingsContainer= document.getElementById('standingsContainer');

  const resultModal        = document.getElementById('resultModal');
  const resultTeamsDisplay = document.getElementById('resultTeamsDisplay');
  const homeGoalsInput     = document.getElementById('homeGoals');
  const awayGoalsInput     = document.getElementById('awayGoals');
  const homeGoalsLabel     = document.getElementById('homeGoalsLabel');
  const awayGoalsLabel     = document.getElementById('awayGoalsLabel');
  const resultMatchId      = document.getElementById('resultMatchId');
  const resultFormError    = document.getElementById('resultFormError');
  const btnSaveResult      = document.getElementById('btnSaveResult');
  const btnCancelResult    = document.getElementById('btnCancelResult');
  const closeResultModal   = document.getElementById('closeResultModal');

  // ---- Session UI ----
  dashUserName.textContent    = session.nombre || session.email;
  userRoleBadge.textContent   = session.rol === 'admin' ? 'Administrador' : 'Equipo';

  // ---- Logout ----
  btnLogout.addEventListener('click', () => {
    DB.clearSession();
    window.location.href = 'index.html';
  });

  // ---- Loading overlay ----
  const setLoading = (on) => {
    document.body.style.cursor = on ? 'wait' : '';
  };

  // ---- Tabs ----
  tabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tabContent${capitalize(btn.dataset.tab)}`).classList.add('active');
      if (btn.dataset.tab === 'standings') await renderStandings();
    });
  });

  // ---- Refresh ----
  const refresh = async () => {
    setLoading(true);
    await Promise.all([renderStats(), renderTeams(), renderMatches()]);
    setLoading(false);
  };

  // ---- STATS ----
  const renderStats = async () => {
    const s = await DB.getStats();
    statTeams.textContent     = s.teams;
    statScheduled.textContent = s.scheduled;
    statCompleted.textContent = s.completed;
  };

  // ---- TEAMS ----
  const renderTeams = async () => {
    const teams = await DB.getTeams();
    if (!teams.length) {
      teamsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <p>No hay equipos registrados aún</p>
          <a href="register.html" class="btn-secondary-sm">+ Registrar Equipo</a>
        </div>`;
      homeTeamSel.innerHTML = '<option value="">Seleccionar equipo</option>';
      awayTeamSel.innerHTML = '<option value="">Seleccionar equipo</option>';
      return;
    }

    teamsContainer.innerHTML = `<div class="teams-grid">${teams.map(teamCard).join('')}</div>`;

    if (session.rol === 'admin') {
      teamsContainer.querySelectorAll('.team-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (confirm(`¿Eliminar el equipo "${btn.dataset.name}"? Esto también borrará sus partidos.`)) {
            setLoading(true);
            await DB.deleteTeam(btn.dataset.id);
            await refresh();
          }
        });
      });
    }

    // Repoblar selects de partidos
    const opts  = teams.map(t => `<option value="${t.id}">${escHtml(t.nombre)}</option>`).join('');
    const blank = '<option value="">Seleccionar equipo</option>';
    homeTeamSel.innerHTML = blank + opts;
    awayTeamSel.innerHTML = blank + opts;
  };

  const teamCard = t => {
    const initials  = t.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const deleteBtn = session.rol === 'admin'
      ? `<button class="btn-icon btn-icon-red team-delete-btn" data-id="${t.id}" data-name="${escHtml(t.nombre)}" title="Eliminar equipo">✕</button>`
      : '';
    return `
      <div class="team-card">
        ${deleteBtn}
        <div class="team-avatar">${initials}</div>
        <div class="team-name">${escHtml(t.nombre)}</div>
        <div class="team-city">📍 ${escHtml(t.municipio || 'Montería')}</div>
        <div class="team-email">${escHtml(t.email)}</div>
        <span class="team-badge">Inscrito</span>
      </div>`;
  };

  // ---- MATCHES ----
  const renderMatches = async () => {
    const matches = await DB.getMatches();
    if (!matches.length) {
      matchesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>No hay partidos programados</p>
        </div>`;
      return;
    }

    const sorted = [...matches].sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === 'finalizado' ? 1 : -1;
      return new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`);
    });

    matchesContainer.innerHTML = `<div class="matches-list">${sorted.map(matchCard).join('')}</div>`;

    matchesContainer.querySelectorAll('.btn-result').forEach(btn => {
      btn.addEventListener('click', () => openResultModal(btn.dataset.id, matches));
    });
    matchesContainer.querySelectorAll('.btn-edit-match').forEach(btn => {
      btn.addEventListener('click', () => openEditMatch(btn.dataset.id, matches));
    });
    matchesContainer.querySelectorAll('.btn-delete-match').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar este partido?')) {
          setLoading(true);
          await DB.deleteMatch(btn.dataset.id);
          await refresh();
        }
      });
    });
  };

  const matchCard = m => {
    const home = m.equipo_local;
    const away = m.equipo_visit;
    if (!home || !away) return '';
    const completed = m.estado === 'finalizado';
    const dateStr   = m.fecha ? formatDate(m.fecha) : '—';
    const timeStr   = m.hora  ? m.hora.slice(0, 5) : '—';

    const scoreBlock = completed
      ? `<div class="match-score">${m.goles_local} – ${m.goles_visit}</div>`
      : `<div class="match-score pending">VS</div>`;

    const resultBtn = session.rol === 'admin' && !completed
      ? `<button class="btn-icon btn-icon-green btn-result" data-id="${m.id}" title="Ingresar resultado">⚽</button>`
      : '';
    const editBtn = session.rol === 'admin' && !completed
      ? `<button class="btn-icon btn-icon-blue btn-edit-match" data-id="${m.id}" title="Editar partido">✏️</button>`
      : '';
    const delBtn = session.rol === 'admin'
      ? `<button class="btn-icon btn-icon-red btn-delete-match" data-id="${m.id}" title="Eliminar partido">✕</button>`
      : '';

    return `
      <div class="match-card ${completed ? 'completed' : ''}">
        <div class="match-teams">
          <div class="match-team">
            <div class="match-team-name">${escHtml(home.nombre)}</div>
            <div class="match-team-label">Local</div>
          </div>
          ${scoreBlock}
          <div class="match-team away">
            <div class="match-team-name">${escHtml(away.nombre)}</div>
            <div class="match-team-label">Visitante</div>
          </div>
        </div>
        <div class="match-meta">
          📅 ${dateStr} &nbsp; 🕐 ${timeStr}
          &nbsp;
          <span class="match-status-badge ${completed ? 'status-completed' : 'status-pending'}">
            ${completed ? 'Finalizado' : 'Programado'}
          </span>
        </div>
        <div class="match-actions">${resultBtn}${editBtn}${delBtn}</div>
      </div>`;
  };

  // Nuevo partido
  btnNewMatch.addEventListener('click', async () => {
    const teams = await DB.getTeams();
    if (teams.length < 2) {
      alert('Necesitas al menos 2 equipos registrados para crear un partido.');
      return;
    }
    editMatchId.value       = '';
    matchFormTitle.textContent = 'Programar Nuevo Partido';
    matchForm.reset();
    matchFormError.textContent = '';
    matchFormWrapper.classList.remove('hidden');
    matchFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  btnCancelMatch.addEventListener('click', () => {
    matchFormWrapper.classList.add('hidden');
    matchForm.reset();
    editMatchId.value = '';
  });

  matchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    matchFormError.textContent = '';

    const homeId = homeTeamSel.value;
    const awayId = awayTeamSel.value;
    const date   = matchDateInput.value;
    const time   = matchTimeInput.value;

    if (!homeId || !awayId)  { matchFormError.textContent = 'Selecciona ambos equipos.';       return; }
    if (homeId === awayId)   { matchFormError.textContent = 'Los equipos deben ser distintos.'; return; }
    if (!date)               { matchFormError.textContent = 'Selecciona una fecha.';            return; }
    if (!time)               { matchFormError.textContent = 'Selecciona una hora.';             return; }

    setLoading(true);
    const id = editMatchId.value;
    const result = id
      ? await DB.updateMatch(id, { homeTeamId: homeId, awayTeamId: awayId, date, time })
      : await DB.addMatch({ homeTeamId: homeId, awayTeamId: awayId, date, time });

    if (result.ok) {
      matchFormWrapper.classList.add('hidden');
      matchForm.reset();
      editMatchId.value = '';
      await refresh();
    } else {
      matchFormError.textContent = result.error;
      setLoading(false);
    }
  });

  const openEditMatch = (id, matches) => {
    const m = matches.find(x => x.id === id);
    if (!m) return;
    editMatchId.value         = id;
    matchFormTitle.textContent = 'Editar Partido';
    homeTeamSel.value         = m.equipo_local_id;
    awayTeamSel.value         = m.equipo_visit_id;
    matchDateInput.value      = m.fecha;
    matchTimeInput.value      = m.hora ? m.hora.slice(0, 5) : '';
    matchFormError.textContent = '';
    matchFormWrapper.classList.remove('hidden');
    matchFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Modal resultado
  const openResultModal = (id, matches) => {
    const m = matches.find(x => x.id === id);
    if (!m) return;
    const home = m.equipo_local;
    const away = m.equipo_visit;
    resultMatchId.value        = id;
    resultTeamsDisplay.textContent = `${home?.nombre || '?'} vs ${away?.nombre || '?'}`;
    homeGoalsLabel.textContent = `Goles ${home?.nombre || 'Local'}`;
    awayGoalsLabel.textContent = `Goles ${away?.nombre || 'Visitante'}`;
    homeGoalsInput.value = m.goles_local !== null ? m.goles_local : 0;
    awayGoalsInput.value = m.goles_visit !== null ? m.goles_visit : 0;
    resultFormError.textContent = '';
    resultModal.classList.remove('hidden');
  };

  const closeModal = () => resultModal.classList.add('hidden');
  closeResultModal.addEventListener('click', closeModal);
  btnCancelResult.addEventListener('click',  closeModal);
  resultModal.addEventListener('click', e => { if (e.target === resultModal) closeModal(); });

  btnSaveResult.addEventListener('click', async () => {
    const id = resultMatchId.value;
    const hg = parseInt(homeGoalsInput.value);
    const ag = parseInt(awayGoalsInput.value);

    if (isNaN(hg) || isNaN(ag) || hg < 0 || ag < 0) {
      resultFormError.textContent = 'Ingresa goles válidos (número ≥ 0).';
      return;
    }

    setLoading(true);
    const result = await DB.setMatchResult(id, hg, ag);
    if (result.ok) {
      closeModal();
      await refresh();
      if (document.getElementById('tabContentStandings').classList.contains('active')) {
        await renderStandings();
      }
    } else {
      resultFormError.textContent = result.error;
      setLoading(false);
    }
  });

  // ---- STANDINGS ----
  const renderStandings = async () => {
    standingsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <p>Calculando tabla...</p>
      </div>`;

    const rows = await DB.getStandings();

    if (!rows.length) {
      standingsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <p>No hay equipos registrados</p>
        </div>`;
      return;
    }

    const medals = ['🥇','🥈','🥉'];

    const tableRows = rows.map((r, i) => {
      const dg       = r.gf - r.gc;
      const dgStr    = dg > 0 ? `+${dg}` : `${dg}`;
      const rankClass= i < 3 ? `rank-${i + 1}` : '';
      const medal    = i < 3 ? `<span class="pos-medal">${medals[i]}</span>` : '';
      const initials = r.team.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      return `
        <tr class="${rankClass}">
          <td class="pos-num">${medal || (i + 1)}</td>
          <td>
            <div class="team-name-cell">
              <div class="team-avatar-sm">${initials}</div>
              <span>${escHtml(r.team.nombre)}</span>
            </div>
          </td>
          <td>${r.pj}</td>
          <td>${r.pg}</td>
          <td>${r.pe}</td>
          <td>${r.pp}</td>
          <td>${r.gf}</td>
          <td>${r.gc}</td>
          <td>${dgStr}</td>
          <td class="pts-cell">${r.pts}</td>
        </tr>`;
    }).join('');

    standingsContainer.innerHTML = `
      <div class="standings-wrap">
        <table class="standings-table">
          <thead>
            <tr>
              <th>#</th><th>Equipo</th>
              <th title="Partidos Jugados">PJ</th>
              <th title="Ganados">G</th>
              <th title="Empatados">E</th>
              <th title="Perdidos">P</th>
              <th title="Goles a favor">GF</th>
              <th title="Goles en contra">GC</th>
              <th title="Diferencia de goles">DG</th>
              <th title="Puntos">Pts</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <p style="font-size:.78rem;color:var(--gray-400);margin-top:10px;text-align:right;">
        Criterios: Puntos · Diferencia de goles · Goles a favor
      </p>`;
  };

  // ---- Utils ----
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

  const escHtml = str => String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const formatDate = dateStr => {
    const [y, m, d] = dateStr.split('-');
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d} ${months[parseInt(m) - 1]} ${y}`;
  };

  // ---- Init ----
  await refresh();
});
