/**
 * db.js — Capa de persistencia
 * Gestión de equipos, jugadores, partidos y estadísticas con Supabase.
 */

// Configuración global (debe estar en config.js)
const sb = () => DB.client;

const DB = {
  client: null,
  session: null,

  init() {
    // Configuramos Supabase para usar sessionStorage (sesión por pestaña)
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        storage: window.sessionStorage,
        autoRefreshToken: true,
        persistSession: true
      }
    });
    this.loadSession();
  },

  // ── Helpers de Seguridad ─────────────────────────────────────
  async hashPassword(password) {
    if (!password) return '';
    try {
      if (!crypto.subtle) {
        console.warn('Crypto Subtle no disponible. Usando fallback (solo para pruebas locales inseguras).');
        return password; // Fallback inseguro si no hay HTTPS (solo para desarrollo)
      }
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.error('Error en hashPassword:', err);
      return password; 
    }
  },

  // ── Sesión Local ─────────────────────────────────────────────
  saveSession(user) {
    this.session = user;
    sessionStorage.setItem('torneo_session', JSON.stringify(user));
  },
  loadSession() {
    const s = sessionStorage.getItem('torneo_session');
    if (s) this.session = JSON.parse(s);
  },
  getSession() {
    return this.session;
  },
  clearSession() {
    this.session = null;
    sessionStorage.removeItem('torneo_session');
  },

  sanitize(str) {
    if (typeof str !== 'string') return str;
    return str.trim().replace(/[<>]/g, '');
  },

  // ── Autenticación ────────────────────────────────────────────
  async login(email, password) {
    if (!this.client) {
      console.error('DB Client no inicializado.');
      return { ok: false, error: 'Error de configuración de base de datos.' };
    }
    
    try {
      console.log('Intento de login con Supabase Auth:', email);

      // 1. Intentar iniciar sesión con el sistema nativo de Supabase
      const { data, error: authError } = await this.client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (authError) {
        console.error('Error de Auth:', authError.message);
        return { ok: false, error: 'Credenciales incorrectas o error de acceso.' };
      }

      // 2. Obtener el perfil del usuario de la tabla pública
      const { data: profile, error: dbError } = await this.client
        .from('usuarios')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (dbError || !profile) {
        console.error('Error al cargar perfil:', dbError);
        // Fallback: crear sesión con los datos de auth si el perfil falla
        const fallbackUser = {
          id: data.user.id,
          email: data.user.email,
          nombre: data.user.user_metadata?.nombre || 'Usuario',
          rol: data.user.user_metadata?.rol || 'team'
        };
        this.saveSession(fallbackUser);
        return { ok: true, user: fallbackUser };
      }

      this.saveSession(profile);
      return { ok: true, user: profile };
    } catch (err) {
      console.error('Error Fatal Login:', err);
      return { ok: false, error: 'Error inesperado en el sistema.' };
    }
  },

  async updatePassword(userId, newPassword) {
    const hashed = await this.hashPassword(newPassword);
    const { error } = await this.client
      .from('usuarios')
      .update({ password: hashed })
      .eq('id', userId);
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async resetPasswordAndGetTemp(email) {
    const tempPass = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed   = await this.hashPassword(tempPass);
    const { data: user } = await this.client.from('usuarios').select('id, nombre').eq('email', email.trim().toLowerCase()).single();
    if (!user) return { ok: false };
    const { error } = await this.client.from('usuarios').update({ password: hashed }).eq('id', user.id);
    return error ? { ok: false } : { ok: true, tempPass, userName: user.nombre };
  },

  // ── Equipos ──────────────────────────────────────────────────
  async getTeams() {
    const { data, error } = await this.client.from('equipos').select('*').order('nombre');
    return error ? [] : data;
  },

  async addTeam(data) {
    const { name, email, password, city, escudo } = data;

    if (!this.client) {
      return { ok: false, error: 'La base de datos no está lista. Intenta recargar la página.' };
    }

    try {
      console.log('Iniciando registro de equipo:', name);

      // 1. Crear usuario en Auth
      const { data: authData, error: authError } = await this.client.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            nombre: name,
            rol: 'team',
            municipio: city || 'Montería'
          }
        }
      });

      if (authError) {
        console.error('Error Supabase Auth:', authError);
        return { ok: false, error: 'Error de autenticación: ' + authError.message };
      }

      if (!authData.user) {
        return { ok: false, error: 'No se pudo crear el usuario. Revisa si el correo ya existe.' };
      }

      const userId = authData.user.id;

      // 2. Insertar equipo en la tabla pública
      const { error: teamError } = await this.client.from('equipos').insert([{
        nombre: name,
        email: email,
        escudo: escudo || null,
        municipio: city || 'Montería',
        usuario_id: userId
      }]);

      if (teamError) {
        console.error('Error al insertar equipo:', teamError);
        return { ok: false, error: 'Cuenta creada, pero hubo un error al guardar los datos del equipo: ' + teamError.message };
      }

      console.log('Registro completado con éxito');
      return { ok: true };
    } catch (err) {
      console.error('Error crítico en addTeam:', err);
      return { ok: false, error: 'Ocurrió un error inesperado. Revisa tu conexión.' };
    }
  },

  async deleteTeam(teamId) {
    const { data: team } = await this.client.from('equipos').select('usuario_id').eq('id', teamId).single();
    const { error } = await this.client.from('equipos').delete().eq('id', teamId);
    if (error) return { ok: false, error: error.message };
    // Eliminamos solo el perfil público (Supabase Auth requiere admin para borrar de auth.users)
    if (team?.usuario_id) await this.client.from('usuarios').delete().eq('id', team.usuario_id);
    return { ok: true };
  },

  async updateTeamShield(teamId, base64) {
    const { error } = await this.client.from('equipos').update({ escudo: base64 }).eq('id', teamId);
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async updateTeamGroup(teamId, groupName) {
    const { error } = await this.client.from('equipos').update({ grupo: groupName }).eq('id', teamId);
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  // ── Jugadores ────────────────────────────────────────────────
  async getPlayersByTeam(teamId) {
    const { data, error } = await this.client.from('jugadores').select('*').eq('equipo_id', teamId).order('nombre');
    return error ? [] : data;
  },

  async addPlayers(teamId, playersArray) {
    const toInsert = playersArray.map(p => ({ ...p, equipo_id: teamId }));
    const { data, error } = await this.client.from('jugadores').insert(toInsert).select();
    return error ? { ok: false, error: error.message } : { ok: true, data };
  },

  async deletePlayer(id) {
    const { error } = await this.client.from('jugadores').delete().eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async checkDocumentoGlobal(doc) {
    const { data, error } = await this.client.from('jugadores').select('nombre, equipos(nombre)').eq('documento', doc);
    if (error || !data || data.length === 0) return { exists: false };
    return { exists: true, equipo: data[0].equipos.nombre };
  },

  // ── Partidos ─────────────────────────────────────────────────
  async getMatches() {
    const { data, error } = await this.client.from('partidos').select('*, equipo_local:equipos!equipo_local_id(nombre, escudo), equipo_visit:equipos!equipo_visit_id(nombre, escudo)').order('fecha', { ascending: true });
    return error ? [] : data;
  },

  async addMatch({ homeTeamId, awayTeamId, date, time, fase }) {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const { data, error } = await this.client.from('partidos').insert([{
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time || '18:00',
      fase: fase || 'Clasificación General'
    }]).select();

    if (error) return { ok: false, error: error.message };
    return { ok: true, match: data ? data[0] : null };
  },

  async updateMatch(id, { homeTeamId, awayTeamId, date, time, fase }) {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const { data, error } = await this.client.from('partidos').update({
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time,
      fase: fase || 'Clasificación General'
    }).eq('id', id).select();

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: 'El partido ya no existe o fue eliminado.' };
    return { ok: true, match: data[0] };
  },

  async setMatchResult(id, homeGoals, awayGoals) {
    const { data, error } = await this.client.from('partidos').update({
      goles_local: homeGoals,
      goles_visit: awayGoals,
      estado: 'finalizado'
    }).eq('id', id).select();

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) return { ok: false, error: 'El partido ya no existe para guardar el resultado.' };
    return { ok: true, match: data[0] };
  },

  async deleteMatch(id) {
    const { error } = await this.client.from('partidos').delete().eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  // ── Standings ────────────────────────────────────────────────
  async getStandings() {
    const [teams, matches] = await Promise.all([this.getTeams(), this.getMatches()]);
    // Solo contar partidos finalizados de la fase de Clasificación General o nula
    const finished = matches.filter(m => m.estado === 'finalizado' && (m.fase === 'Clasificación General' || !m.fase));

    const table = teams.reduce((acc, t) => {
      acc[t.id] = { team: t, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
      return acc;
    }, {});

    finished.forEach(m => {
      const h = table[m.equipo_local_id];
      const a = table[m.equipo_visit_id];
      if (!h || !a) return;
      const hg = m.goles_local || 0;
      const ag = m.goles_visit || 0;
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
  },

  // ── Estadísticas ─────────────────────────────────────────────
  async getStats() {
    try {
      const [teams, matches] = await Promise.all([this.getTeams(), this.getMatches()]);
      return {
        teams: Array.isArray(teams) ? teams.length : 0,
        scheduled: Array.isArray(matches) ? matches.filter(m => m.estado === 'pendiente').length : 0,
        completed: Array.isArray(matches) ? matches.filter(m => m.estado === 'finalizado').length : 0
      };
    } catch (e) {
      console.error('Error en getStats:', e);
      return { teams: 0, scheduled: 0, completed: 0 };
    }
  },

  async getTopScorers(limit = 5) {
    const { data, error } = await this.client.from('eventos_partido')
      .select('jugador_id, cantidad, jugadores(nombre, foto, equipos(nombre))')
      .eq('tipo', 'gol');

    if (error || !data) return [];
    
    const map = {};
    data.forEach(e => {
      const p = e.jugadores;
      if (!p) return;
      if (!map[e.jugador_id]) {
        map[e.jugador_id] = { nombre: p.nombre, foto: p.foto, equipo: p.equipos?.nombre, goles: 0 };
      }
      map[e.jugador_id].goles += (e.cantidad || 1);
    });

    return Object.values(map).sort((a,b) => b.goles - a.goles).slice(0, limit);
  },

  async getBestGoalkeepers(limit = 5) {
    // Lógica simplificada: equipos con menos goles en contra
    const standings = await this.getStandings();
    return standings.sort((a,b) => a.gc - b.gc).slice(0, limit).map(s => ({
      nombre: 'Portero de ' + s.team.nombre,
      equipo: s.team.nombre,
      gc: s.gc
    }));
  },

  // ── Notificaciones ───────────────────────────────────────────
  async getNotifications(teamId) {
    const { data } = await this.client.from('notificaciones').select('*').eq('equipo_id', teamId).order('creado_en', { ascending: false });
    return data || [];
  },
  async markNotificationAsRead(id) {
    await this.client.from('notificaciones').update({ leida: true }).eq('id', id);
  },
  async getPendingFines(teamId) {
    // Tarjetas pendientes de pago para un equipo específico
    const { data } = await this.client
      .from('eventos_partido')
      .select('*, jugadores(nombre, dorsal), partidos(fecha)')
      .eq('equipo_id', teamId)
      .in('tipo', ['amarilla', 'roja'])
      .eq('pagada', false);
    return data || [];
  },

  async getAllPendingFines() {
    // Todas las tarjetas pendientes de pago (para el dashboard de admin)
    try {
      const { data, error } = await this.client
        .from('eventos_partido')
        .select('*, jugadores(nombre, dorsal), partidos(fecha)')
        .in('tipo', ['amarilla', 'roja'])
        .eq('pagada', false);
      if (error) {
        // Si la columna 'pagada' no existe, devolver vacío silenciosamente
        console.warn('getAllPendingFines error (puede que la columna pagada no exista):', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      return [];
    }
  }
};

DB.init();
