/**
 * db.js — Capa de datos con Supabase (PostgreSQL en la nube)
 * Torneo de Fútbol Montería, Córdoba
 *
 * Reemplaza completamente localStorage por una base de datos real.
 * Todas las funciones son async/await.
 */

// Cliente Supabase (cargado desde CDN en los HTML)
let _supabase = null;

const DB = (() => {

  // ---- Inicialización ----
  const init = () => {
    if (_supabase) return _supabase;
    if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'TU_SUPABASE_URL_AQUI') {
      console.error('⚠️  Configura SUPABASE_URL y SUPABASE_ANON en js/config.js');
      return null;
    }
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return _supabase;
  };

  const sb = () => {
    const client = init();
    if (!client) throw new Error('Supabase no está configurado. Revisa js/config.js');
    return client;
  };

  // ================================================================
  // SESIÓN (guardada en sessionStorage para seguridad)
  // ================================================================
  const getSession  = ()     => { try { return JSON.parse(sessionStorage.getItem('fmtria_session')); } catch { return null; } };
  const setSession  = (user) => sessionStorage.setItem('fmtria_session', JSON.stringify(user));
  const clearSession = ()    => sessionStorage.removeItem('fmtria_session');

  // ----------------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------------
  const login = async (email, password) => {
    try {
      const { data, error } = await sb()
        .from('usuarios')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('password', password)
        .single();

      if (error || !data) return { ok: false, error: 'Correo o contraseña incorrectos.' };
      setSession(data);
      return { ok: true, user: data };
    } catch (e) {
      return { ok: false, error: 'Error de conexión. Revisa tu internet.' };
    }
  };

  // ================================================================
  // EQUIPOS
  // ================================================================
  const getTeams = async () => {
    const { data, error } = await sb().from('equipos').select('*').order('created_at');
    if (error) { console.error(error); return []; }
    return data;
  };

  const getTeamById = async (id) => {
    const { data } = await sb().from('equipos').select('*').eq('id', id).single();
    return data || null;
  };

  const addTeam = async ({ name, email, password, city }) => {
    try {
      // 1. Verificar que no exista el nombre
      const { data: existing } = await sb().from('equipos').select('id').ilike('nombre', name.trim()).single();
      if (existing) return { ok: false, error: 'Ya existe un equipo con ese nombre.' };

      // 2. Verificar que el email no esté en uso
      const { data: existingUser } = await sb().from('usuarios').select('id').eq('email', email.toLowerCase()).single();
      if (existingUser) return { ok: false, error: 'Ya existe una cuenta con ese correo.' };

      // 3. Crear usuario
      const { data: user, error: userErr } = await sb().from('usuarios').insert([{
        email: email.toLowerCase().trim(),
        password,
        nombre: name.trim(),
        rol: 'equipo'
      }]).select().single();

      if (userErr) return { ok: false, error: 'Error al crear el usuario: ' + userErr.message };

      // 4. Crear equipo vinculado al usuario
      const { data: team, error: teamErr } = await sb().from('equipos').insert([{
        nombre: name.trim(),
        email: email.toLowerCase().trim(),
        municipio: city || 'Montería',
        usuario_id: user.id
      }]).select().single();

      if (teamErr) {
        // Rollback usuario
        await sb().from('usuarios').delete().eq('id', user.id);
        return { ok: false, error: 'Error al crear el equipo: ' + teamErr.message };
      }

      return { ok: true, team };
    } catch (e) {
      return { ok: false, error: 'Error de conexión. Revisa tu internet.' };
    }
  };

  const deleteTeam = async (id) => {
    try {
      // Obtener usuario_id del equipo
      const { data: team } = await sb().from('equipos').select('usuario_id').eq('id', id).single();

      // Borrar partidos relacionados
      await sb().from('partidos').delete().or(`equipo_local_id.eq.${id},equipo_visit_id.eq.${id}`);

      // Borrar equipo
      await sb().from('equipos').delete().eq('id', id);

      // Borrar usuario vinculado (si no es admin)
      if (team?.usuario_id) {
        await sb().from('usuarios').delete().eq('id', team.usuario_id).eq('rol', 'equipo');
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Error al eliminar el equipo.' };
    }
  };

  // ================================================================
  // PARTIDOS
  // ================================================================
  const getMatches = async () => {
    const { data, error } = await sb()
      .from('partidos')
      .select(`
        *,
        equipo_local:equipo_local_id ( id, nombre, municipio ),
        equipo_visit:equipo_visit_id ( id, nombre, municipio )
      `)
      .order('fecha').order('hora');
    if (error) { console.error(error); return []; }
    return data;
  };

  const getMatchById = async (id) => {
    const { data } = await sb()
      .from('partidos')
      .select(`*, equipo_local:equipo_local_id(*), equipo_visit:equipo_visit_id(*)`)
      .eq('id', id)
      .single();
    return data || null;
  };

  const addMatch = async ({ homeTeamId, awayTeamId, date, time }) => {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const { data, error } = await sb().from('partidos').insert([{
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time,
      estado: 'pendiente'
    }]).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, match: data };
  };

  const updateMatch = async (id, { homeTeamId, awayTeamId, date, time }) => {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const { data, error } = await sb().from('partidos').update({
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time
    }).eq('id', id).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, match: data };
  };

  const setMatchResult = async (id, homeGoals, awayGoals) => {
    const { data, error } = await sb().from('partidos').update({
      goles_local: parseInt(homeGoals),
      goles_visit: parseInt(awayGoals),
      estado: 'finalizado'
    }).eq('id', id).select().single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, match: data };
  };

  const deleteMatch = async (id) => {
    const { error } = await sb().from('partidos').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  // ================================================================
  // TABLA DE POSICIONES (calculada desde las BD)
  // ================================================================
  const getStandings = async () => {
    const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
    const finished = matches.filter(m => m.estado === 'finalizado');

    const table = teams.reduce((acc, t) => {
      acc[t.id] = { team: t, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
      return acc;
    }, {});

    finished.forEach(m => {
      const h = table[m.equipo_local_id];
      const a = table[m.equipo_visit_id];
      if (!h || !a) return;
      const hg = m.goles_local, ag = m.goles_visit;
      h.pj++; a.pj++;
      h.gf += hg; h.gc += ag;
      a.gf += ag; a.gc += hg;
      if (hg > ag)      { h.pg++; h.pts += 3; a.pp++; }
      else if (ag > hg) { a.pg++; a.pts += 3; h.pp++; }
      else              { h.pe++; a.pe++; h.pts++; a.pts++; }
    });

    return Object.values(table).sort((a, b) =>
      b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf
    );
  };

  // ================================================================
  // ESTADÍSTICAS GENERALES
  // ================================================================
  const getStats = async () => {
    const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
    return {
      teams:     teams.length,
      scheduled: matches.filter(m => m.estado === 'pendiente').length,
      completed: matches.filter(m => m.estado === 'finalizado').length,
    };
  };

  // ================================================================
  // JUGADORES
  // ================================================================
  const getPlayersByTeam = async (teamId) => {
    const { data, error } = await sb()
      .from('jugadores')
      .select('*')
      .eq('equipo_id', teamId)
      .order('dorsal');
    if (error) { console.error(error); return []; }
    return data;
  };

  const addPlayers = async (teamId, players) => {
    if (!players || players.length === 0) return { ok: true };
    const rows = players.map(p => ({
      equipo_id:  teamId,
      nombre:     p.nombre.trim(),
      documento:  p.documento.trim(),
      posicion:   p.posicion,
      dorsal:     parseInt(p.dorsal),
      fecha_nac:  p.fecha_nac || null,
      foto:       p.foto || null
    }));
    const { error } = await sb().from('jugadores').insert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const deletePlayer = async (id) => {
    const { error } = await sb().from('jugadores').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  // Init inmediato
  init();

  return {
    // Sesión
    getSession, setSession, clearSession, login,
    // Equipos
    getTeams, getTeamById, addTeam, deleteTeam,
    // Jugadores
    getPlayersByTeam, addPlayers, deletePlayer,
    // Partidos
    getMatches, getMatchById, addMatch, updateMatch, setMatchResult, deleteMatch,
    // Computed
    getStandings, getStats,
  };
})();
