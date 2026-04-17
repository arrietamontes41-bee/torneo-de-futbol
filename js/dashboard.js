/**
 * dashboard.js — Panel de administración (async con Supabase)
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ---- Auth Guard ----
  const session = DB.getSession();
  if (!session)              { window.location.href = 'index.html';    return; }
  if (session.rol !== 'admin') { window.location.href = 'team-panel.html'; return; }

  // ---- DOM refs ----
  const dashUserNameSide = document.getElementById('dashUserNameSide');
  const userInitial     = document.getElementById('userInitial');
  const btnLogout        = document.getElementById('btnLogout');

  const statTeams      = document.getElementById('statTeams');
  const statScheduled  = document.getElementById('statScheduled');
  const statCompleted  = document.getElementById('statCompleted');

  // Sidebar navigation elements
  const sidebar          = document.getElementById('sidebar');
  const sidebarBtns      = document.querySelectorAll('.sidebar-btn');
  const btnSidebarOpen   = document.getElementById('btnSidebarOpen');
  const btnSidebarClose  = document.getElementById('btnSidebarClose');
  const tabContents      = document.querySelectorAll('.tab-content');
  const currentViewTitle = document.getElementById('currentViewTitle');

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
  const matchFaseInput    = document.getElementById('matchFase');
  const matchFormError    = document.getElementById('matchFormError');
  const btnCancelMatch    = document.getElementById('btnCancelMatch');
  const matchesContainer  = document.getElementById('matchesContainer');
  const standingsContainer= document.getElementById('standingsContainer');
  const btnExportExcel    = document.getElementById('btnExportExcel');
  const btnGenerateLiguilla= document.getElementById('btnGenerateLiguilla');
  const btnAutoGroups     = document.getElementById('btnAutoGroups');

  // Acta Modal
  const actaModal    = document.getElementById('actaModal');
  const actaMatchId  = document.getElementById('actaMatchId');
  const actaMeta     = document.getElementById('actaMeta');
  const actaHomeName = document.getElementById('actaHomeName');
  const actaAwayName = document.getElementById('actaAwayName');
  const actaHomeBody = document.getElementById('actaHomeBody');
  const actaAwayBody = document.getElementById('actaAwayBody');
  const actaHomeTotal= document.getElementById('actaHomeTotal');
  const actaAwayTotal= document.getElementById('actaAwayTotal');
  const actaError    = document.getElementById('actaError');
  const btnSaveActa  = document.getElementById('btnSaveActa');
  const btnCancelActa= document.getElementById('btnCancelActa');
  const closeActaBtn = document.getElementById('closeActaModal');

  // Roster modal
  const rosterModal       = document.getElementById('rosterModal');
  const rosterModalTitle  = document.getElementById('rosterModalTitle');
  const rosterModalSub    = document.getElementById('rosterModalSub');
  const rosterContent     = document.getElementById('rosterContent');
  const closeRosterModal  = document.getElementById('closeRosterModal');
  const btnCloseRoster    = document.getElementById('btnCloseRoster');

  // ---- Session UI ----
  const fullName = session.nombre || session.email;
  if (dashUserNameSide) dashUserNameSide.textContent = fullName;
  if (userInitial) userInitial.textContent = fullName.charAt(0).toUpperCase();

  // ---- Sidebar Toggle (Mobile) ----
  const toggleSidebar = () => sidebar?.classList.toggle('open');
  btnSidebarOpen?.addEventListener('click', toggleSidebar);
  btnSidebarClose?.addEventListener('click', toggleSidebar);

  // ---- Sidebar Navigation ----
  sidebarBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetTab = btn.dataset.tab;
      console.log('Navegando a pestaña:', targetTab);
      
      // Update UI
      sidebarBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      tabContents.forEach(c => c.classList.remove('active'));
      const activeContent = document.getElementById(`tabContent${capitalize(targetTab)}`);
      
      if (activeContent) {
        console.log('Se encontró el contenedor para:', targetTab);
        activeContent.classList.add('active');
      } else {
        console.error('No se encontró el contenedor tabContent' + capitalize(targetTab));
      }

      // Update Breadcrumb
      if (currentViewTitle) {
        currentViewTitle.textContent = btn.innerText.trim();
      }

      // Close sidebar on mobile
      if (window.innerWidth <= 1024) toggleSidebar();

      // View-specific loading
      if (targetTab === 'standings') await renderStandings();
      if (targetTab === 'sanciones') await renderSanciones();
      if (targetTab === 'overview') await renderStats();
    });
  });

  // ---- Logout ----
  btnLogout?.addEventListener('click', () => {
    DB.clearSession();
    window.location.href = 'index.html';
  });

  // ---- Loading overlay ----
  const setLoading = (on) => {
    document.body.classList.toggle('cursor-wait', on);
  };

  // ---- Refresh ----
  const refresh = async () => {
    setLoading(true);
    await Promise.all([renderStats(), renderTeams(), renderMatches()]);
    setLoading(false);
  };

  // ---- STATS ----
  const renderStats = async () => {
    const [s, scorers, goalkeepers] = await Promise.all([
      DB.getStats(),
      DB.getTopScorers(10),
      DB.getBestGoalkeepers(10)
    ]);
    
    // General stats
    statTeams.textContent     = s.teams;
    statScheduled.textContent = s.scheduled;
    statCompleted.textContent = s.completed;

    // Render Scorer Leaderboard
    const scorersContainer = document.getElementById('topScorersContainer');
    if (scorersContainer) {
      if (!scorers.length) {
        scorersContainer.innerHTML = `<div class="empty-state"><p>No hay goles registrados</p></div>`;
      } else {
        scorersContainer.innerHTML = scorers.map((p, i) => `
          <div class="leader-item">
            <div class="leader-rank">#${i + 1}</div>
            <div class="leader-avatar">${(p.nombre || '?').charAt(0)}</div>
            <div class="leader-info">
              <span class="leader-name">${escHtml(p.nombre)}</span>
              <span class="leader-team">${escHtml(p.equipo)}</span>
            </div>
            <div class="leader-score">${p.goles} Goles</div>
          </div>
        `).join('');
      }
    }

    // Render Best Defense Leaderboard (Goalkeepers)
    const defenseContainer = document.getElementById('bestDefenseContainer');
    if (defenseContainer) {
      if (!goalkeepers.length) {
        defenseContainer.innerHTML = `<div class="empty-state"><p>No hay datos disponibles</p></div>`;
      } else {
        defenseContainer.innerHTML = goalkeepers.map((p, i) => `
          <div class="leader-item">
            <div class="leader-rank">#${i + 1}</div>
            <div class="leader-avatar">🧤</div>
            <div class="leader-info">
              <span class="leader-name">${escHtml(p.nombre)}</span>
              <span class="leader-team">${escHtml(p.equipo)}</span>
            </div>
            <div class="leader-score score-defense">${p.gc} GC</div>
          </div>
        `).join('');
      }
    }
  };

  // ---- TEAMS ----
  const renderTeams = async () => {
    const teams = await DB.getTeams();
    if (!teams.length) {
      teamsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <p>No hay equipos registrados aún</p>
          <a href="register.html" class="btn-secondary-sm">+ Registrar Equipo</a>
        </div>`;
      homeTeamSel.innerHTML = '<option value="">Seleccionar equipo</option>';
      awayTeamSel.innerHTML = '<option value="">Seleccionar equipo</option>';
      return;
    }

    teamsContainer.innerHTML = `<div class="teams-grid">${teams.map(teamCard).join('')}</div>`;

    // Click en tarjeta para ver plantilla
    teamsContainer.querySelectorAll('.team-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Evitar conflicto con el botón eliminar
        if (e.target.closest('.team-delete-btn')) return;
        const teamId   = card.dataset.id;
        const teamName = card.dataset.name;
        const teamCity = card.dataset.city;
        openRosterModal(teamId, teamName, teamCity);
      });
    });

    if (session.rol === 'admin') {
      teamsContainer.querySelectorAll('.team-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`¿Eliminar el equipo "${btn.dataset.name}"? Esto también borrará sus partidos y jugadores.`)) {
            setLoading(true);
            const res = await DB.deleteTeam(btn.dataset.id);
            if (res.ok) {
              showToast('Equipo eliminado correctamente.', 'success');
              await refresh();
            } else {
              showToast('Error al borrar equipo: ' + res.error, 'error');
              setLoading(false);
            }
          }
        });
      });

      teamsContainer.querySelectorAll('.team-group-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const currentGroup = btn.dataset.group || 'Único';
          const newGroup = prompt(`Asignar grupo para ${btn.dataset.name}:`, currentGroup);
          if (newGroup !== null && newGroup.trim() !== '' && newGroup !== currentGroup) {
            setLoading(true);
            const res = await DB.updateTeamGroup(btn.dataset.id, newGroup.trim());
            if (res.ok) {
              showToast(`Grupo actualizado a "${newGroup.trim()}".`, 'success');
              await refresh();
            } else {
              showToast('Error al actualizar grupo: ' + res.error, 'error');
              setLoading(false);
            }
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
    const avatar = t.escudo
      ? `<img src="${t.escudo}" alt="escudo" class="img-fit-inherit" />`
      : initials;
    const deleteBtn = session.rol === 'admin'
      ? `<button class="btn-icon btn-icon-red team-delete-btn" data-id="${t.id}" data-name="${escHtml(t.nombre)}" title="Eliminar equipo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`
      : '';
    const groupBtn = session.rol === 'admin'
      ? `<button class="btn-primary-sm team-group-btn" style="margin-top:5px; padding:2px 5px; font-size:11px;" data-id="${t.id}" data-name="${escHtml(t.nombre)}" data-group="${escHtml(t.grupo || 'Único')}">Grupo: ${escHtml(t.grupo || 'Único')}</button>`
      : `<div style="font-size:11px; margin-top:5px;">Grupo: ${escHtml(t.grupo || 'Único')}</div>`;
      
    return `
      <div class="team-card cursor-pointer" data-id="${t.id}" data-name="${escHtml(t.nombre)}" data-city="${escHtml(t.municipio || 'Montería')}" title="Ver plantilla">
        ${deleteBtn}
        <div class="team-avatar">${avatar}</div>
        <div class="team-name">${escHtml(t.nombre)}</div>
        <div class="team-city">📍 ${escHtml(t.municipio || 'Montería')}</div>
        <div class="team-email">${escHtml(t.email)}</div>
        ${groupBtn}
        <span class="team-badge" style="margin-top: 5px;">Inscrito</span>
        <div class="text-muted-xs mt-6">👆 Ver plantilla</div>
      </div>`;
  };

  // ---- MATCHES ----
  const renderMatches = async () => {
    const matches = await DB.getMatches();
    if (!matches.length) {
      matchesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
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
      btn.addEventListener('click', () => openActa(btn.dataset.id, matches));
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
    const faseStr   = m.fase && m.fase !== 'Clasificación General' ? ` | <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> ${m.fase}` : '';

    const scoreBlock = completed
      ? `<div class="match-score">${m.goles_local} – ${m.goles_visit}</div>`
      : `<div class="match-score pending">VS</div>`;

    const resultBtn = session.rol === 'admin' && !completed
      ? `<button class="btn-icon btn-icon-green btn-result" data-id="${m.id}" title="Ingresar resultado"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></button>`
      : '';
    const editBtn = session.rol === 'admin' && !completed
      ? `<button class="btn-icon btn-icon-blue btn-edit-match" data-id="${m.id}" title="Editar partido"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>`
      : '';
    const delBtn = session.rol === 'admin'
      ? `<button class="btn-icon btn-icon-red btn-delete-match" data-id="${m.id}" title="Eliminar partido"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${dateStr} &nbsp; 🕐 ${timeStr} ${faseStr}
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
      showToast('Necesitas al menos 2 equipos registrados para crear un partido.', 'error');
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

  const filterAwayTeams = async () => {
    const teams = await DB.getTeams(); 
    const homeId = homeTeamSel.value;
    const fase = matchFaseInput ? matchFaseInput.value : 'Clasificación General';
    
    if (!homeId) {
      awayTeamSel.innerHTML = '<option value="">Seleccionar equipo</option>' + teams.map(t => `<option value="${t.id}">${escHtml(t.nombre)}</option>`).join('');
      return;
    }

    const homeTeam = teams.find(t => t.id === homeId);
    let validAwayTeams = teams.filter(t => t.id !== homeId);

    if (fase === 'Clasificación General' && homeTeam && homeTeam.grupo && homeTeam.grupo !== 'Único') {
      validAwayTeams = validAwayTeams.filter(t => t.grupo === homeTeam.grupo);
    }
    
    const currentAway = awayTeamSel.value;
    awayTeamSel.innerHTML = '<option value="">Seleccionar equipo</option>' + validAwayTeams.map(t => `<option value="${t.id}">${escHtml(t.nombre)}</option>`).join('');
    if (validAwayTeams.find(t => t.id === currentAway)) {
      awayTeamSel.value = currentAway;
    }
  };

  homeTeamSel.addEventListener('change', filterAwayTeams);
  if (matchFaseInput) {
    matchFaseInput.addEventListener('change', filterAwayTeams);
  }

  matchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    matchFormError.textContent = '';

    const homeId = homeTeamSel.value;
    const awayId = awayTeamSel.value;
    const date   = matchDateInput.value;
    const time   = matchTimeInput.value;
    const fase   = matchFaseInput ? matchFaseInput.value : 'Clasificación General';

    if (!homeId || !awayId)  { matchFormError.textContent = 'Selecciona ambos equipos.';       return; }
    if (homeId === awayId)   { matchFormError.textContent = 'Los equipos deben ser distintos.'; return; }
    if (!date)               { matchFormError.textContent = 'Selecciona una fecha.';            return; }
    if (!time)               { matchFormError.textContent = 'Selecciona una hora.';             return; }

    setLoading(true);
    const id = editMatchId.value;
    const result = id
      ? await DB.updateMatch(id, { homeTeamId: homeId, awayTeamId: awayId, date, time, fase })
      : await DB.addMatch({ homeTeamId: homeId, awayTeamId: awayId, date, time, fase });

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
    if (matchFaseInput) matchFaseInput.value = m.fase || 'Clasificación General';
    matchFormError.textContent = '';
    matchFormWrapper.classList.remove('hidden');
    matchFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ---- LIGUILLA AUTOMATICA ----
  if (btnGenerateLiguilla) {
    btnGenerateLiguilla.addEventListener('click', async () => {
      const option = prompt('¿Qué fase deseas generar asumiendo la tabla de posiciones general?\n1. Octavos de Final (Top 16)\n2. Cuartos de Final (Top 8)\n3. Semifinal (Top 4)', '2');
      if (!option) return;
      
      let numToAdvance = 0;
      let phaseName = '';
      if (option === '1') { numToAdvance = 16; phaseName = 'Octavos de Final'; }
      else if (option === '2') { numToAdvance = 8; phaseName = 'Cuartos de Final'; }
      else if (option === '3') { numToAdvance = 4; phaseName = 'Semifinal'; }
      else { showToast('Opción no válida.', 'error'); return; }

      setLoading(true);
      const standings = await DB.getStandings();
      if (standings.length < numToAdvance) {
        showToast(`No hay suficientes equipos (se requieren ${numToAdvance}).`, 'error');
        setLoading(false);
        return;
      }

      const topTeams = standings.slice(0, numToAdvance).map(s => s.team);
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7); // Programar 7 días despues por default
      const defaultDate = nextDate.toISOString().split('T')[0];

      let generated = 0;
      for (let i = 0; i < numToAdvance / 2; i++) {
        const home = topTeams[i];
        const away = topTeams[numToAdvance - 1 - i];
        await DB.addMatch({
          homeTeamId: home.id,
          awayTeamId: away.id,
          date: defaultDate,
          time: '18:00',
          fase: phaseName
        });
        generated++;
      }

      showToast(`Se generaron ${generated} partidos para ${phaseName}.`, 'success');
      await refresh();
    });
  }

  // ---- AUTO REPARTIR GRUPOS ----
  if (btnAutoGroups) {
    btnAutoGroups.addEventListener('click', async () => {
      const teams = await DB.getTeams();
      if (teams.length < 2) {
        showToast('Se necesitan al menos 2 equipos para crear grupos.', 'error');
        return;
      }
      
      const numGroupsStr = prompt(`Tienes ${teams.length} equipos registrados.\n¿En cuántos grupos quieres dividirlos automáticamente? (Ej. 2, 4, 8)\n\nIMPORTANTE: Escribe "1" si deseas BORRAR a todos de sus grupos y volver a la tabla Única general.`, '2');
      if (!numGroupsStr) return;
      const numGroups = parseInt(numGroupsStr);
      if (isNaN(numGroups) || numGroups < 1 || numGroups > 10) {
        showToast('Por favor ingresa un número de grupos válido (entre 1 y 10).', 'error');
        return;
      }

      if (numGroups === 1) {
        if (!confirm('¿Seguro que deseas eliminar todos los grupos y restaurar la Clasificación General de tabla única para todos los equipos?')) return;
        setLoading(true);
        let promises = teams.map(t => DB.updateTeamGroup(t.id, 'Único'));
        await Promise.all(promises);
        showToast('Todos los equipos restaurados al grupo Único.', 'success');
        await refresh();
        return;
      }

      const confirmMsg = `¿Seguro que deseas repartir a los ${teams.length} equipos en ${numGroups} grupos de manera aleatoria? Esto sobrescribirá su grupo actual.`;
      if (!confirm(confirmMsg)) return;

      setLoading(true);
      
      const shuffled = [...teams];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      
      let promises = [];
      shuffled.forEach((team, index) => {
        const groupIndex = index % numGroups;
        const groupName = groupLetters[groupIndex];
        promises.push(DB.updateTeamGroup(team.id, groupName));
      });

      await Promise.all(promises);
      showToast(`${teams.length} equipos repartidos en ${numGroups} grupos (A, B...).`, 'success');
      await refresh();
    });
  }

  // ---- EXPORTAR EXCEL ----
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      if (!_lastStandingsRows || !_lastStandingsRows.length) {
        showToast('Primero abre la pestaña "Tabla de Posiciones" para cargar los datos.', 'error');
        return;
      }

      // Agrupar igual que renderStandings
      const groups = {};
      _lastStandingsRows.forEach(r => {
        const g = r.team.grupo || 'Único';
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
      });

      const groupNames = Object.keys(groups).sort();
      const headers = ['#', 'Equipo', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'Pts'];

      let csvContent = "\uFEFF"; // BOM para acentos en Excel

      groupNames.forEach(gName => {
        if (groupNames.length > 1) {
          csvContent += `"Grupo: ${gName}"\r\n`;
        }
        // Cabecera con separador ; (Excel en español usa ; no ,)
        csvContent += headers.map(h => `"${h}"`).join(';') + "\r\n";
        // Filas
        groups[gName].forEach((r, i) => {
          const dg = r.gf - r.gc;
          const row = [
            i + 1,
            r.team.nombre,
            r.pj, r.pg, r.pe, r.pp,
            r.gf, r.gc,
            (dg > 0 ? '+' : '') + dg,
            r.pts
          ];
          csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + "\r\n";
        });
        csvContent += "\r\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'tabla_posiciones_torneo.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Tabla exportada correctamente.', 'success');
    });
  }

  // ── ACTA DE PARTIDO ────────────────────────────────────────────
  const closeActa = () => actaModal.classList.add('hidden');
  [btnCancelActa, closeActaBtn].forEach(b => b?.addEventListener('click', closeActa));
  actaModal.addEventListener('click', e => { if (e.target === actaModal) closeActa(); });

  const openActa = async (matchId, allMatches) => {
    const m = allMatches.find(x => x.id === matchId);
    if (!m) return;
    actaMatchId.value      = matchId;
    actaHomeName.textContent = m.equipo_local?.nombre  || 'Local';
    actaAwayName.textContent = m.equipo_visit?.nombre || 'Visitante';
    actaMeta.textContent     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${m.fecha ? formatDate(m.fecha) : '—'}  ·  ⏰ ${m.hora ? m.hora.slice(0,5) : '—'}`;
    actaError.textContent    = '';
    actaModal.classList.remove('hidden');
    actaHomeBody.innerHTML = loadingRow();
    actaAwayBody.innerHTML = loadingRow();

    const [homePlayers, awayPlayers, events] = await Promise.all([
      DB.getPlayersByTeam(m.equipo_local_id),
      DB.getPlayersByTeam(m.equipo_visit_id),
      DB.getMatchEvents(matchId)
    ]);
    renderActaTeam(actaHomeBody, actaHomeTotal, homePlayers, events);
    renderActaTeam(actaAwayBody, actaAwayTotal, awayPlayers, events);
  };

  const loadingRow = () =>
    `<tr><td colspan="5" class="acta-status-cell">Cargando jugadores...</td></tr>`;

  const renderActaTeam = (tbody, totalEl, players, events) => {
    if (!players.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="acta-status-cell">Sin jugadores registrados</td></tr>`;
      totalEl.textContent = 0; return;
    }
    const getEv = (jId, tipo) => { const e = events.find(x => x.jugador_id === jId && x.tipo === tipo); return e ? e.cantidad : 0; };

    tbody.innerHTML = players.map(p => {
      const g = getEv(p.id,'gol'), ta = getEv(p.id,'amarilla'), tr = getEv(p.id,'roja');
      return `<tr>
        <td><span class="dors-sm">${p.dorsal}</span></td>
        <td>${escHtml(p.nombre)}</td>
        <td><button class="card-btn ${ta?'on-yellow':''}" data-player="${p.id}" data-equipo="${p.equipo_id}" data-tipo="amarilla">🟡</button></td>
        <td><button class="card-btn ${tr?'on-red':''}"    data-player="${p.id}" data-equipo="${p.equipo_id}" data-tipo="roja">🔴</button></td>
        <td><input class="goles-inp" type="number" min="0" max="20" value="${g}" data-player="${p.id}" data-equipo="${p.equipo_id}" /></td>
      </tr>`;
    }).join('');

    const recalc = () => {
      const tot = [...tbody.querySelectorAll('.goles-inp')].reduce((s,i) => s+(parseInt(i.value)||0), 0);
      totalEl.textContent = tot;
    };
    tbody.querySelectorAll('.goles-inp').forEach(i => i.addEventListener('input', recalc));
    tbody.querySelectorAll('.card-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.tipo==='amarilla') b.classList.toggle('on-yellow');
      if (b.dataset.tipo==='roja')     b.classList.toggle('on-red');
    }));
    recalc();
  };

  btnSaveActa.addEventListener('click', async () => {
    const matchId = actaMatchId.value;
    actaError.textContent = '';
    const events = [];
    const collect = (container) => {
      container.querySelectorAll('.goles-inp').forEach(inp => {
        const g = parseInt(inp.value)||0;
        if (g>0) events.push({jugador_id:inp.dataset.player, equipo_id:inp.dataset.equipo, tipo:'gol', cantidad:g});
      });
      container.querySelectorAll('.card-btn.on-yellow').forEach(b =>
        events.push({jugador_id:b.dataset.player, equipo_id:b.dataset.equipo, tipo:'amarilla', cantidad:1}));
      container.querySelectorAll('.card-btn.on-red').forEach(b =>
        events.push({jugador_id:b.dataset.player, equipo_id:b.dataset.equipo, tipo:'roja', cantidad:1}));
    };
    collect(actaHomeBody); collect(actaAwayBody);
    const homeGoals = parseInt(actaHomeTotal.textContent)||0;
    const awayGoals = parseInt(actaAwayTotal.textContent)||0;
    btnSaveActa.disabled = true; btnSaveActa.textContent = 'Guardando...';
    const [evRes, mRes] = await Promise.all([
      DB.saveMatchEvents(matchId, events),
      DB.setMatchResult(matchId, homeGoals, awayGoals)
    ]);
    btnSaveActa.disabled = false;
    btnSaveActa.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Guardar Resultado`;
    if (!evRes.ok)  { actaError.textContent = 'Error: ' + evRes.error;  return; }
    if (!mRes.ok)   { actaError.textContent = 'Error: ' + mRes.error;   return; }
    closeActa(); await refresh();
  });

  // ---- ROSTER MODAL ----
  const openRosterModal = async (teamId, teamName, teamCity) => {
    rosterModal.classList.remove('hidden');
    rosterModalTitle.textContent = 'Cargando...';
    rosterModalSub.textContent   = '—';
    rosterContent.innerHTML = `<div class="empty-state"><div class="empty-icon"><svg style="animation: spin 1s linear infinite;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div><p>Cargando jugadores de ${teamName}...</p></div>`;

    const players = await DB.getPlayersByTeam(teamId);
    
    // Una vez cargados, poner el título real
    rosterModalTitle.textContent = teamName;
    rosterModalSub.textContent   = `📍 ${teamCity}`;

    if (!players.length) {
      rosterContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <p>Este equipo aún no tiene jugadores registrados.</p>
        </div>`;
      return;
    }

    const posIcons = { Portero: '🧤', Defensa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', Mediocampista: '⚙️', Delantero: '⚡' };

    const rows = players.map(p => {
      const icon    = posIcons[p.posicion] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
      const dob     = p.fecha_nac ? formatDate(p.fecha_nac) : '—';
      const age     = p.fecha_nac ? calcAge(p.fecha_nac) : '';
      const ageStr  = age ? ` (${age} años)` : '';
      return `
        <tr>
          <td class="text-center font-bold font-primary">${p.dorsal}</td>
          <td>${escHtml(p.nombre)}</td>
          <td>${icon} ${escHtml(p.posicion)}</td>
          <td class="text-muted-sm">${escHtml(p.documento)}</td>
          <td class="text-muted-sm">${dob}${ageStr}</td>
        </tr>`;
    }).join('');

    rosterContent.innerHTML = `
      <p class="text-muted-sm mb-12">${players.length} jugador${players.length !== 1 ? 'es' : ''} registrado${players.length !== 1 ? 's' : ''}</p>
      <div class="overflow-x-auto">
        <table class="standings-table min-w-480">
          <thead>
            <tr>
              <th title="Dorsal">#</th>
              <th>Nombre</th>
              <th>Posición</th>
              <th>Documento</th>
              <th>Nacimiento</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const calcAge = (dateStr) => {
    const today = new Date();
    const birth = new Date(dateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const closeRoster = () => rosterModal.classList.add('hidden');
  closeRosterModal.addEventListener('click', closeRoster);
  btnCloseRoster.addEventListener('click',   closeRoster);
  rosterModal.addEventListener('click', e => { if (e.target === rosterModal) closeRoster(); });

  // (resultado ahora se guarda desde el acta de partido - btnSaveActa)


  // ---- STANDINGS ----
  let _lastStandingsRows = []; // guardamos para el export
  const renderStandings = async () => {
    standingsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg style="animation: spin 1s linear infinite;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
        <p>Calculando tabla...</p>
      </div>`;

    const rows = await DB.getStandings();
    _lastStandingsRows = rows; // <-- guardar para export

    if (!rows.length) {
      standingsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg></div>
          <p>No hay equipos registrados</p>
        </div>`;
      return;
    }

    const groups = {};
    rows.forEach(r => {
      const g = r.team.grupo || 'Único';
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });

    let html = '';
    const groupNames = Object.keys(groups).sort();
    
    groupNames.forEach(gName => {
      const gRows = groups[gName];
      const tableRows = gRows.map((r, i) => {
        const dg       = r.gf - r.gc;
        const dgStr    = dg > 0 ? `+${dg}` : `${dg}`;
        const rankClass= i < 3 ? `rank-${i + 1}` : '';
        const initials = r.team.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const avatar   = r.team.escudo
          ? `<img src="${r.team.escudo}" alt="escudo" class="img-fit-inherit" />`
          : initials;
        return `
          <tr class="${rankClass}">
            <td class="pos-num">${i + 1}</td>
            <td>
              <div class="team-name-cell">
                <div class="team-avatar-sm">${avatar}</div>
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

      html += `
        ${groupNames.length > 1 ? `<h3 style="margin: 20px 0 10px 0; color: #fff; font-size: 1.2rem;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg> Grupo: ${escHtml(gName)}</h3>` : ''}
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
        </div>`;
    });

    standingsContainer.innerHTML = html + `
      <p class="text-muted-sm mt-10 text-right">
        Criterios: Puntos · Diferencia de goles · Goles a favor
      </p>`;
  };

  // ---- SANCIONES ----
  const sancionesContainer = document.getElementById('sancionesContainer');
  const renderSanciones = async () => {
    sancionesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg style="animation: spin 1s linear infinite;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
        <p>Cargando sanciones pendientes...</p>
      </div>`;
    const [fines, teams] = await Promise.all([DB.getAllPendingFines(), DB.getTeams()]);

    if (!fines || !fines.length) {
      sancionesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
          <p>No hay multas de tarjetas pendientes por pagar</p>
        </div>`;
      return;
    }

    const rows = fines.map(f => {
      const isRed = f.tipo === 'roja';
      const color = isRed ? '#ef4444' : '#eab308';
      const label = isRed ? 'Roja' : 'Amarilla';
      const dateStr = f.partidos?.fecha ? formatDate(f.partidos.fecha) : '—';
      const teamObj = teams.find(t => t.id === f.equipo_id);
      return `
        <tr>
          <td><div class="sanciones-row-flex"><div class="sanciones-badge-sm" style="background:${color};"></div>${label}</div></td>
          <td><b class="sanciones-name">${escHtml(f.jugadores?.nombre)}</b> <span class="sanciones-dorsal">(#${f.jugadores?.dorsal})</span></td>
          <td>${escHtml(teamObj?.nombre || '—')}</td>
          <td>${dateStr}</td>
          <td>
            <button class="btn-primary-sm btn-mark-paid btn-paid-status" data-id="${f.id}">
              Marcar como Pagada
            </button>
          </td>
        </tr>`;
    }).join('');

    sancionesContainer.innerHTML = `
      <div class="standings-wrap">
        <table class="standings-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Jugador</th>
              <th>Equipo</th>
              <th>Fecha del Partido</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    sancionesContainer.querySelectorAll('.btn-mark-paid').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Procesando...';
        const res = await DB.markFineAsPaid(btn.dataset.id);
        if (res.ok) {
          showToast('Sanción marcada como pagada.', 'success');
          await renderSanciones();
        } else {
          showToast('Error: ' + res.error, 'error');
          btn.disabled = false;
        }
      });
    });
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
