/**
 * db.js — Capa de datos con Supabase (PostgreSQL en la nube)
 * Torneo de Fútbol Montería, Córdoba
 *
 * Reemplaza completamente localStorage por una base de datos real.
 * Todas las funciones son async/await.
 */

// Cliente Supabase (cargado desde CDN en los HTML)
let _supabase = null;

// ================================================================
// HASH DE CONTRASEÑA (SHA-256 via Web Crypto API)
// Funciona en HTTPS y localhost. En file:// usa fallback.
// ================================================================
const hashPassword = async (plain) => {
  // crypto.subtle solo funciona en contextos seguros (HTTPS / localhost)
  if (window.isSecureContext && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback para desarrollo local (file://) — NO usar en producción
  // Genera un hash simple pero consistente
  let hash = 0;
  for (let i = 0; i < plain.length; i++) {
    const chr = plain.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'local_' + Math.abs(hash).toString(16).padStart(8, '0');
};

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

  // ---- Cache de Memoria ----
  let _cacheTeams = null;
  let _cacheMatches = null;
  let _cacheTime = 0;
  const CACHE_TTL = 60000; // 60 segundos

  const clearCache = () => {
    _cacheTeams = null;
    _cacheMatches = null;
    _cacheTime = 0;
  };

  const isCacheFresh = () => (Date.now() - _cacheTime) < CACHE_TTL;

  // ================================================================
  // SESIÓN (guardada en sessionStorage para seguridad)
  // ================================================================
  const getSession  = ()     => { try { return JSON.parse(sessionStorage.getItem('fmtria_session')); } catch { return null; } };
  const setSession  = (user) => sessionStorage.setItem('fmtria_session', JSON.stringify(user));
  const clearSession = ()    => sessionStorage.removeItem('fmtria_session');

  // ---- Sanitización (Prevención de Inyección) ----
  const sanitize = (val) => {
    if (typeof val !== 'string') return val;
    // Elimina patrones comunes de inyección SQL/Scripts que disparan alertas de scanners
    return val.replace(/['";\-\-\/\*<>]/g, '').trim();
  };

  // ----------------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------------
  const login = async (email, password) => {
    try {
      const hashed = await hashPassword(password);
      const emailLean = sanitize(email).toLowerCase();

      const { data, error } = await sb()
        .from('usuarios')
        .select('*')
        .eq('email', emailLean)
        .eq('password', hashed)
        .single();

      if (error || !data) return { ok: false, error: 'Correo o contraseña incorrectos.' };
      // No guardar la contraseña en sesión
      const { password: _pwd, ...safeUser } = data;
      setSession(safeUser);
      return { ok: true, user: safeUser };
    } catch (e) {
      return { ok: false, error: 'Error de conexión. Revisa tu internet.' };
    }
  };

  const resetPasswordAndGetTemp = async (email) => {
    try {
      const emailLower = email.toLowerCase().trim();
      const { data, error } = await sb().from('usuarios').select('id, nombre').eq('email', emailLower).single();
      if (error || !data) return { ok: false, error: 'Correo no encontrado.' };

      // Generar PIN de 6 dígitos (ej: 482915)
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const hashed = await hashPassword(pin);

      // Guardar el PIN como contraseña temporal en la base de datos
      const { error: updateErr } = await sb().from('usuarios').update({ password: hashed }).eq('id', data.id);
      if (updateErr) return { ok: false, error: 'Error al actualizar.' };

      return { ok: true, tempPass: pin, userName: data.nombre, userId: data.id };
    } catch(e) {
      return { ok: false, error: 'Error de conexión.' };
    }
  };

  const updatePassword = async (userId, newPassword) => {
    try {
      const hashed = await hashPassword(newPassword);
      const { error } = await sb().from('usuarios').update({ password: hashed }).eq('id', userId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch(e) {
      return { ok: false, error: 'Error de conexión.' };
    }
  };

  // ================================================================
  // EQUIPOS
  // ================================================================
  const getTeams = async () => {
    if (_cacheTeams && isCacheFresh()) return _cacheTeams;

    const { data, error } = await sb().from('equipos').select('*').order('created_at');
    if (error) { console.error(error); return []; }
    
    _cacheTeams = data || [];
    if (_cacheTeams.length > 0) _cacheTime = Date.now();
    return _cacheTeams;
  };

  const getTeamById = async (id) => {
    const { data } = await sb().from('equipos').select('*').eq('id', id).single();
    return data || null;
  };

  const addTeam = async ({ name, email, password, city, escudo }) => {
    try {
      clearCache();
      // 1. Verificar que no exista el nombre
      const { data: existing } = await sb().from('equipos').select('id').ilike('nombre', name.trim()).single();
      if (existing) return { ok: false, error: 'Ya existe un equipo con ese nombre.' };

      // 2. Verificar que el email no esté en uso
      const { data: existingUser } = await sb().from('usuarios').select('id').eq('email', email.toLowerCase()).single();
      if (existingUser) return { ok: false, error: 'Ya existe una cuenta con ese correo.' };

      // 3. Crear usuario (contraseña hasheada)
      const hashed = await hashPassword(password);
      const { data: user, error: userErr } = await sb().from('usuarios').insert([{
        email: email.toLowerCase().trim(),
        password: hashed,
        nombre: name.trim(),
        rol: 'equipo'
      }]).select().single();

      if (userErr) return { ok: false, error: 'Error al crear el usuario: ' + userErr.message };

      // 4. Crear equipo vinculado al usuario
      const { data: team, error: teamErr } = await sb().from('equipos').insert([{
        nombre: name.trim(),
        email: email.toLowerCase().trim(),
        municipio: city || 'Montería',
        usuario_id: user.id,
        escudo: escudo || null
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
      clearCache();
      // 1. Obtener el usuario_id antes de que el equipo sea borrado
      const { data: team, error: fetchErr } = await sb()
        .from('equipos')
        .select('usuario_id')
        .eq('id', id)
        .single();

      if (fetchErr) {
        console.error('Error al obtener info del equipo:', fetchErr);
        return { ok: false, error: 'No se pudo encontrar el equipo.' };
      }

      // 2. Borrar el equipo
      // Nota: El esquema tiene ON DELETE CASCADE, por lo que borrar el equipo 
      // automáticamente borra sus jugadores, partidos y eventos relacionados.
      const { error: deleteTeamErr } = await sb()
        .from('equipos')
        .delete()
        .eq('id', id);

      if (deleteTeamErr) {
        console.error('Error al borrar equipo:', deleteTeamErr);
        return { ok: false, error: 'La base de datos rechazó el borrado del equipo.' };
      }

      // 3. Borrar el usuario vinculado (si existe y es de rol 'equipo')
      if (team && team.usuario_id) {
        const { error: deleteUserErr } = await sb()
          .from('usuarios')
          .delete()
          .eq('id', team.usuario_id)
          .eq('rol', 'equipo');

        if (deleteUserErr) {
          // Si el borrado de equipo funcionó pero el del usuario no (posiblemente por RLS),
          // avisamos en consola pero retornamos éxito parcial para no confundir al admin,
          // ya que el equipo "visual" ya desapareció.
          console.warn('El equipo fue borrado, pero su usuario asociado permaneció:', deleteUserErr.message);
        }
      }

      return { ok: true };
    } catch (e) {
      console.error('Excepción en deleteTeam:', e);
      return { ok: false, error: 'Ocurrió un error inesperado al intentar borrar.' };
    }
  };

  const updateTeamShield = async (teamId, escudo) => {
    const { error } = await sb().from('equipos').update({ escudo }).eq('id', teamId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const updateTeamGroup = async (teamId, grupo) => {
    const { error } = await sb().from('equipos').update({ grupo }).eq('id', teamId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  // ================================================================
  // PARTIDOS
  // ================================================================
  const getMatches = async () => {
    if (_cacheMatches && isCacheFresh()) return _cacheMatches;

    const { data, error } = await sb()
      .from('partidos')
      .select(`
        *,
        equipo_local:equipo_local_id ( id, nombre, municipio ),
        equipo_visit:equipo_visit_id ( id, nombre, municipio )
      `)
      .order('fecha').order('hora');
    if (error) { console.error(error); return []; }
    
    _cacheMatches = data || [];
    if (_cacheMatches.length > 0) _cacheTime = Date.now();
    return _cacheMatches;
  };

  const getMatchById = async (id) => {
    const { data } = await sb()
      .from('partidos')
      .select(`*, equipo_local:equipo_local_id(*), equipo_visit:equipo_visit_id(*)`)
      .eq('id', id)
      .single();
    return data || null;
  };

  const addMatch = async ({ homeTeamId, awayTeamId, date, time, fase }) => {
    clearCache();
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };

    const matchFase = fase || 'Fase de Grupos';

    // Validar si ESA PAREJA de equipos ya juega ese día
    const { data: exists } = await sb()
      .from('partidos')
      .select('id')
      .eq('fecha', date)
      .or(`and(equipo_local_id.eq.${homeTeamId},equipo_visit_id.eq.${awayTeamId}),and(equipo_local_id.eq.${awayTeamId},equipo_visit_id.eq.${homeTeamId})`);

    if (exists && exists.length > 0) {
      return { ok: false, error: `Este enfrentamiento ya está programado para esta fecha (${date}).` };
    }

    const { data, error } = await sb().from('partidos').insert([{
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time,
      estado: 'pendiente',
      fase: matchFase
    }]).select().single();
    if (error) return { ok: false, error: error.message };
    
    // Notificar a ambos equipos
    await createNotification(homeTeamId, `Tienes un nuevo partido programado para el ${date} a las ${time} (${matchFase}).`);
    await createNotification(awayTeamId, `Tienes un nuevo partido programado para el ${date} a las ${time} (${matchFase}).`);

    return { ok: true, match: data };
  };

  const updateMatch = async (id, { homeTeamId, awayTeamId, date, time, fase }) => {
    clearCache();
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };

    const matchFase = fase || 'Fase de Grupos';

    // Validar si ESA PAREJA de equipos ya juega ese día (ignorando este partido)
    const { data: exists } = await sb()
      .from('partidos')
      .select('id')
      .eq('fecha', date)
      .neq('id', id)
      .or(`and(equipo_local_id.eq.${homeTeamId},equipo_visit_id.eq.${awayTeamId}),and(equipo_local_id.eq.${awayTeamId},equipo_visit_id.eq.${homeTeamId})`);

    if (exists && exists.length > 0) {
      return { ok: false, error: `Este enfrentamiento ya está registrado para esta fecha en otro partido.` };
    }

    const { data, error } = await sb().from('partidos').update({
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time,
      fase: matchFase
    }).eq('id', id).select().single();
    if (error) return { ok: false, error: error.message };
    
    // Notificar a ambos equipos
    await createNotification(homeTeamId, `Tu partido del ${date} a las ${time} ha sido actualizado.`);
    await createNotification(awayTeamId, `Tu partido del ${date} a las ${time} ha sido actualizado.`);

    return { ok: true, match: data };
  };

  const setMatchResult = async (id, homeGoals, awayGoals) => {
    clearCache();
    const { data: mData } = await sb().from('partidos').select('equipo_local_id, equipo_visit_id, fecha').eq('id', id).single();
    const { data, error } = await sb().from('partidos').update({
      goles_local: parseInt(homeGoals),
      goles_visit: parseInt(awayGoals),
      estado: 'finalizado'
    }).eq('id', id).select().single();
    if (error) return { ok: false, error: error.message };

    if (mData) {
      await createNotification(mData.equipo_local_id, `El resultado de tu partido del ${mData.fecha} ha sido publicado (${homeGoals} - ${awayGoals}).`);
      await createNotification(mData.equipo_visit_id, `El resultado de tu partido del ${mData.fecha} ha sido publicado (${homeGoals} - ${awayGoals}).`);
    }

    return { ok: true, match: data };
  };

  const deleteMatch = async (id) => {
    clearCache();
    const { error } = await sb().from('partidos').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  // ================================================================
  // TABLA DE POSICIONES (calculada desde las BD)
  // ================================================================
  const getStandings = async () => {
    const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
    // Solo contar partidos finalizados y de "Fase de Grupos" (o que no tengan fase) para la tabla general
    const finished = matches.filter(m => m.estado === 'finalizado' && (m.fase === 'Fase de Grupos' || m.fase === 'Clasificación General' || !m.fase));

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

  /**
   * Devuelve el top de goleadores del torneo.
   * @param {number} limit - Cuántos jugadores devolver (default 5)
   */
  const getTopScorers = async (limit = 5) => {
    try {
      const { data, error } = await sb()
        .from('eventos_partido')
        .select('jugador_id, cantidad, jugadores(nombre, posicion, foto, dorsal, equipos(nombre, escudo))')
        .eq('tipo', 'gol');
      if (error || !data) return [];

      // Agrupar por jugador y sumar goles
      const map = {};
      data.forEach(e => {
        const id = e.jugador_id;
        if (!map[id]) {
          map[id] = {
            id,
            nombre:  e.jugadores?.nombre  || '—',
            posicion:e.jugadores?.posicion || '—',
            foto:    e.jugadores?.foto     || null,
            dorsal:  e.jugadores?.dorsal   || '—',
            equipo:  e.jugadores?.equipos?.nombre || '—',
            escudo:  e.jugadores?.equipos?.escudo || null,
            goles: 0
          };
        }
        map[id].goles += Number(e.cantidad || 0);
      });

      return Object.values(map)
        .sort((a, b) => b.goles - a.goles)
        .slice(0, limit);
    } catch (e) { console.error(e); return []; }
  };

  /**
   * Devuelve los porteros con menos goles recibidos en el torneo
   * (calculado por goles en contra del equipo en partidos finalizados).
   * @param {number} limit - Cuántos porteros devolver (default 5)
   */
  const getBestGoalkeepers = async (limit = 5) => {
    try {
      const [allPlayers, allTeams, allMatches] = await Promise.all([
        sb().from('jugadores').select('*, equipos(nombre, escudo)').eq('posicion', 'Portero'),
        getTeams(),
        getMatches()
      ]);

      const porteros = allPlayers.data || [];
      const finished = allMatches.filter(m => m.estado === 'finalizado');

      // Calcular goles recibidos por equipo
      const gcByTeam = {};
      allTeams.forEach(t => { gcByTeam[t.id] = 0; });
      finished.forEach(m => {
        if (gcByTeam[m.equipo_local_id] !== undefined) gcByTeam[m.equipo_local_id] += Number(m.goles_visit || 0);
        if (gcByTeam[m.equipo_visit_id] !== undefined) gcByTeam[m.equipo_visit_id] += Number(m.goles_local || 0);
      });

      // Asignar goles recibidos a cada portero por su equipo
      return porteros
        .map(p => ({
          id:      p.id,
          nombre:  p.nombre,
          foto:    p.foto || null,
          dorsal:  p.dorsal,
          equipo:  p.equipos?.nombre || '—',
          escudo:  p.equipos?.escudo || null,
          gc:      gcByTeam[p.equipo_id] ?? 0
        }))
        .sort((a, b) => a.gc - b.gc)
        .slice(0, limit);
    } catch (e) { console.error(e); return []; }
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

  /**
   * Verifica si un documento ya está registrado en cualquier equipo del torneo.
   * @param {string} documento - El número de cédula a verificar
   * @returns {{ exists: boolean, equipo?: string }} - Si existe y a qué equipo pertenece
   */
  const checkDocumentoGlobal = async (documento) => {
    const { data, error } = await sb()
      .from('jugadores')
      .select('id, nombre, equipo_id, equipos(nombre)')
      .eq('documento', documento.trim())
      .limit(1);
    if (error) { console.error(error); return { exists: false }; }
    if (!data || data.length === 0) return { exists: false };
    return { exists: true, equipo: data[0]?.equipos?.nombre || 'otro equipo' };
  };

  // ================================================================
  // EVENTOS DE PARTIDO (goles y tarjetas por jugador)
  // ================================================================
  const getMatchEvents = async (matchId) => {
    const { data, error } = await sb()
      .from('eventos_partido')
      .select('*')
      .eq('partido_id', matchId);
    if (error) { console.error(error); return []; }
    return data || [];
  };

  const saveMatchEvents = async (matchId, events) => {
    await sb().from('eventos_partido').delete().eq('partido_id', matchId);
    const rows = (events || []).filter(e => e.cantidad > 0);
    if (!rows.length) return { ok: true };
    const { error } = await sb().from('eventos_partido').insert(
      rows.map(e => ({
        partido_id: matchId,
        jugador_id: e.jugador_id,
        equipo_id:  e.equipo_id,
        tipo:       e.tipo,
        cantidad:   e.cantidad
      }))
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const getPendingFines = async (teamId) => {
    const { data, error } = await sb()
      .from('eventos_partido')
      .select('id, tipo, jugadores(nombre, dorsal), partidos(fecha)')
      .eq('equipo_id', teamId)
      .in('tipo', ['amarilla', 'roja'])
      .eq('pagada', false);
    if (error) { console.error(error); return []; }
    return data || [];
  };

  const getAllPendingFines = async () => {
    const { data, error } = await sb()
      .from('eventos_partido')
      .select('id, tipo, equipo_id, jugadores(nombre, dorsal), partidos(fecha)')
      .in('tipo', ['amarilla', 'roja'])
      .eq('pagada', false);
    if (error) { console.error(error); return []; }
    return data || [];
  };

  const markFineAsPaid = async (id) => {
    const { data: fine } = await sb().from('eventos_partido').select('equipo_id, tipo').eq('id', id).single();
    const { error } = await sb().from('eventos_partido').update({ pagada: true }).eq('id', id);
    if (error) return { ok: false, error: error.message };
    if (fine) {
      await createNotification(fine.equipo_id, `Una sanción por tarjeta ${fine.tipo} ha sido marcada como PAGADA.`);
    }
    return { ok: true };
  };

  // ================================================================
  // NOTIFICACIONES
  // ================================================================
  const createNotification = async (teamId, message) => {
    if (!teamId) return;
    const { error } = await sb().from('notificaciones').insert([{ equipo_id: teamId, mensaje: message }]);
    if (error) console.error('Error insertando notificacion:', error);
  };

  const getNotifications = async (teamId) => {
    const { data, error } = await sb().from('notificaciones')
      .select('*').eq('equipo_id', teamId).order('created_at', { ascending: false }).limit(20);
    if (error) return [];
    return data || [];
  };

  const markNotificationAsRead = async (notifId) => {
    await sb().from('notificaciones').update({ leida: true }).eq('id', notifId);
  };

  // Init inmediato
  init();

  return {
    // Sesión
    getSession, setSession, clearSession, login, resetPasswordAndGetTemp, updatePassword,
    // Equipos
    getTeams, getTeamById, addTeam, deleteTeam, updateTeamShield, updateTeamGroup,
    // Jugadores
    getPlayersByTeam, addPlayers, deletePlayer, checkDocumentoGlobal,
    // Partidos
    getMatches, getMatchById, addMatch, updateMatch, setMatchResult, deleteMatch,
    // Eventos y Sanciones
    getMatchEvents, saveMatchEvents, getPendingFines, getAllPendingFines, markFineAsPaid,
    // Notificaciones
    createNotification, getNotifications, markNotificationAsRead,
    // Computed
    getStandings, getStats, getTopScorers, getBestGoalkeepers,
    // Utils
    sanitize,
  };
})();
