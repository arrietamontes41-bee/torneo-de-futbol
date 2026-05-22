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
  }

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
