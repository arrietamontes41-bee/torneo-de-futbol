/**
 * Vista pública: fixture y tabla de posiciones (solo lectura, sin sesión).
 * Requiere políticas RLS en Supabase que permitan SELECT anónimo en `equipos` y `partidos`.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('publicStatus');
  const fixtureEl = document.getElementById('publicFixture');
  const standingsEl = document.getElementById('publicStandings');

  const esc = (str) =>
    String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${parts[2]} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
  };

  function setStatus(msg, isInfo) {
    if (!statusEl) return;
    statusEl.className = 'public-status-msg' + (isInfo ? ' is-info' : '');
    statusEl.textContent = msg;
    statusEl.hidden = false;
  }

  function clearStatus() {
    if (statusEl) statusEl.hidden = true;
  }

  // Obtener id del torneo de la URL si existe (?id=... o ?t=...), o usar el guardado en localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let selectedTorneoId = urlParams.get('id') || urlParams.get('t') || localStorage.getItem('public_selected_torneo_id') || '';
  const publicTournamentSelect = document.getElementById('publicTournamentSelect');

  async function loadData() {
    fixtureEl.innerHTML = '<p>Cargando partidos...</p>';
    standingsEl.innerHTML = '<p>Calculando posiciones...</p>';

    // Cargar branding del torneo
    try {
      const tournament = await DB.getTournament(selectedTorneoId);
      if (tournament) {
        const publicDescEl = document.getElementById('publicTournamentDesc');
        if (publicDescEl) {
          publicDescEl.textContent = tournament.descripcion || 'Vista pública para compartir: partidos y posiciones.';
        }
      }
    } catch (err) {
      console.error('Error al cargar branding público:', err);
    }

    const [teams, matches] = await Promise.all([DB.getTeams(selectedTorneoId), DB.getMatches(selectedTorneoId)]);

    if ((!teams || teams.length === 0) && (!matches || matches.length === 0)) {
      setStatus(
        'No hay datos para mostrar en este torneo.',
        false
      );
    } else {
      clearStatus();
    }

    const rows = await DB.getStandings(selectedTorneoId);

    if (matches && matches.length) {
      const sorted = [...matches].sort((a, b) => {
        if (a.estado !== b.estado) return a.estado === 'finalizado' ? 1 : -1;
        return new Date(`${a.fecha}T${a.hora || '00:00'}`) - new Date(`${b.fecha}T${b.hora || '00:00'}`);
      });

      fixtureEl.innerHTML =
        '<div class="matches-list-scroll"><div class="matches-list">' +
        sorted
          .map((m) => {
            const home = m.equipo_local;
            const away = m.equipo_visit;
            if (!home || !away) return '';
            const done = m.estado === 'finalizado';
            const score = done
              ? `<div class="match-score">${m.goles_local} – ${m.goles_visit}</div>`
              : '<div class="match-score pending">VS</div>';
            const fase =
              m.fase && m.fase !== 'Clasificación General'
                ? ` · ${esc(m.fase)}`
                : '';
            const homeShield = home.escudo 
              ? `<img src="${esc(home.escudo)}" class="team-shield-mini" alt="">`
              : `<div class="team-initials-mini">${esc(home.nombre.substring(0,2).toUpperCase())}</div>`;
            const awayShield = away.escudo 
              ? `<img src="${esc(away.escudo)}" class="team-shield-mini" alt="">`
              : `<div class="team-initials-mini">${esc(away.nombre.substring(0,2).toUpperCase())}</div>`;

            return `
          <div class="match-card ${done ? 'completed' : ''}">
            <div class="match-teams">
              <div class="match-team">
                ${homeShield}
                <div class="match-team-name">${esc(home.nombre)}</div>
                <div class="match-team-label">Local</div>
              </div>
              ${score}
              <div class="match-team away">
                <div class="match-team-name">${esc(away.nombre)}</div>
                ${awayShield}
                <div class="match-team-label">Visitante</div>
              </div>
            </div>
            <div class="match-meta">
              <span class="match-status-badge ${done ? 'status-completed' : 'status-pending'}">${done ? 'Finalizado' : 'Pendiente'}</span>
              <span>${formatDate(m.fecha)} · ${esc((m.hora || '').slice(0, 5))}${fase}</span>
            </div>
          </div>`;
          })
          .join('') +
        '</div></div>';
    } else {
      fixtureEl.innerHTML =
        '<div class="empty-state"><p>No hay partidos publicados aún.</p></div>';
    }

    if (!rows || !rows.length) {
      standingsEl.innerHTML =
        '<div class="empty-state"><p>No hay datos de tabla de posiciones (sin equipos o sin partidos finalizados en clasificación general).</p></div>';
    } else {
      const groups = {};
      rows.forEach((r) => {
        const g = r.team.grupo || 'Único';
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
      });

      let html = '';
      const groupNames = Object.keys(groups).sort();
      groupNames.forEach((gName) => {
        const gRows = groups[gName];
        const tableRows = gRows
          .map((r, i) => {
            const dg = r.gf - r.gc;
            const dgStr = dg > 0 ? `+${dg}` : `${dg}`;
            const initials = r.team.nombre
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const avatar = r.team.escudo
              ? `<img src="${esc(r.team.escudo)}" alt="" class="team-shield-mini" />`
              : `<div class="team-initials-mini">${initials}</div>`;
            return `
          <tr>
            <td class="pos-num">${i + 1}</td>
            <td>
              <div class="team-name-cell">
                ${avatar}
                <span>${esc(r.team.nombre)}</span>
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
          })
          .join('');

        html += `
        ${groupNames.length > 1 ? `<h3 class="public-group-title">Grupo: ${esc(gName)}</h3>` : ''}
        <div class="standings-wrap table-scroll-touch">
          <table class="standings-table">
            <thead>
              <tr>
                <th>#</th><th>Equipo</th>
                <th title="Partidos jugados">PJ</th>
                <th>G</th><th>E</th><th>P</th>
                <th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>`;
      });

      standingsEl.innerHTML =
        html +
        '<p class="text-muted-sm mt-10" style="color:var(--gray-400);font-size:0.82rem;">Criterios: puntos · diferencia de goles · goles a favor. Solo lectura.</p>';
    }

    // Cargar Goleadores
    const scorersEl = document.getElementById('publicScorers');
    if (scorersEl) {
      try {
        const scorers = await DB.getTopScorers(20, selectedTorneoId);
        if (scorers && scorers.length > 0) {
          scorersEl.innerHTML = scorers.map((s, i) => `
            <div class="star-card">
              <div class="star-card-label" style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 8px;">#${i + 1}</div>
              <div class="star-player-row" style="display: flex; align-items: center; gap: 12px;">
                <div class="star-photo">
                  ${s.foto ? `<img src="${esc(s.foto)}" alt="${esc(s.nombre)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />` 
                           : `<div style="width:48px;height:48px;border-radius:50%;background:var(--gray-200);display:flex;align-items:center;justify-content:center;color:var(--gray-500);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`}
                </div>
                <div class="star-info" style="flex: 1;">
                  <div class="star-name" style="font-weight: 600; font-size: 1.05rem;">${esc(s.nombre)}</div>
                  <div class="star-team" style="font-size: 0.85rem; color: var(--gray-500);">${esc(s.equipo)}</div>
                </div>
                <div class="star-badge" style="background: var(--color-primary-light); color: var(--color-primary); padding: 4px 10px; border-radius: 20px; text-align: center;">
                  <span class="star-badge-num" style="font-weight: 800; font-size: 1.1rem; display: block;">${s.goles}</span>
                  <span class="star-badge-lbl" style="font-size: 0.7rem; text-transform: uppercase;">goles</span>
                </div>
              </div>
            </div>
          `).join('');
        } else {
          scorersEl.innerHTML = '<div class="empty-state"><p>No hay goles registrados en este torneo.</p></div>';
        }
      } catch (err) {
        scorersEl.innerHTML = '<div class="empty-state"><p>No se pudieron cargar los goleadores.</p></div>';
      }
    }

    // Cargar Valla Menos Vencida
    const keepersEl = document.getElementById('publicGoalkeepers');
    if (keepersEl) {
      try {
        const keepers = await DB.getBestGoalkeepers(20, selectedTorneoId);
        if (keepers && keepers.length > 0) {
          keepersEl.innerHTML = keepers.map((k, i) => `
            <div class="star-card">
              <div class="star-card-label" style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 8px;">#${i + 1}</div>
              <div class="star-player-row" style="display: flex; align-items: center; gap: 12px;">
                <div class="star-photo">
                  ${k.foto ? `<img src="${esc(k.foto)}" alt="${esc(k.nombre)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />` 
                           : `<div style="width:48px;height:48px;border-radius:50%;background:var(--gray-200);display:flex;align-items:center;justify-content:center;color:var(--gray-500);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg></div>`}
                </div>
                <div class="star-info" style="flex: 1;">
                  <div class="star-name" style="font-weight: 600; font-size: 1.05rem;">${esc(k.nombre)}</div>
                  <div class="star-team" style="font-size: 0.85rem; color: var(--gray-500);">${esc(k.equipo)}</div>
                </div>
                <div class="star-badge star-badge-alt" style="background: rgba(220,38,38,0.1); color: #dc2626; padding: 4px 10px; border-radius: 20px; text-align: center;">
                  <span class="star-badge-num" style="font-weight: 800; font-size: 1.1rem; display: block;">${k.gc}</span>
                  <span class="star-badge-lbl" style="font-size: 0.7rem; text-transform: uppercase;">en contra</span>
                </div>
              </div>
            </div>
          `).join('');
        } else {
          keepersEl.innerHTML = '<div class="empty-state"><p>No hay datos de porteros registrados.</p></div>';
        }
      } catch (err) {
        keepersEl.innerHTML = '<div class="empty-state"><p>No se pudieron cargar los porteros.</p></div>';
      }
    }
  }

  // ---- Manejo de Tabs ----
  const tabs = document.querySelectorAll('.public-tab');
  const sections = document.querySelectorAll('.public-section');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const secId = 'sec-' + tab.dataset.sec;
      const targetSec = document.getElementById(secId);
      if (targetSec) targetSec.classList.add('active');
    });
  });

  // ---- Inicialización ----
  try {
    DB.clearReadCache();
    DB.init();

    // Cargar torneos en el selector
    const tournaments = await DB.getAllTournaments();
    if (publicTournamentSelect) {
      publicTournamentSelect.innerHTML = '';
      if (tournaments.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = 'Sin torneos';
        publicTournamentSelect.appendChild(opt);
        selectedTorneoId = '';
        localStorage.removeItem('public_selected_torneo_id');
      } else {
        const exists = tournaments.some(t => t.id === selectedTorneoId);
        if (!selectedTorneoId || !exists) {
          selectedTorneoId = tournaments[0].id;
          localStorage.setItem('public_selected_torneo_id', selectedTorneoId);
        }
        
        tournaments.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.nombre;
          if (t.id === selectedTorneoId) opt.selected = true;
          publicTournamentSelect.appendChild(opt);
        });

        publicTournamentSelect.addEventListener('change', async (e) => {
          selectedTorneoId = e.target.value;
          localStorage.setItem('public_selected_torneo_id', selectedTorneoId);
          
          // Actualizar la URL de forma transparente para poder compartirla directamente
          const newUrl = `${window.location.pathname}?id=${selectedTorneoId}`;
          window.history.replaceState({ id: selectedTorneoId }, '', newUrl);
          
          await loadData();
        });
      }
    }

    await loadData();
  } catch (e) {
    console.error(e);
    setStatus('Error al cargar el torneo. Revisa la consola o la configuración de Supabase.', false);
  }
});
