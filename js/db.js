/**
 * db.js — Capa de persistencia
 * Gestión de equipos, jugadores, partidos y estadísticas con Supabase.
 */

// Configuración global (debe estar en config.js)
const sb = () => DB.client;

const DB = {
  client: null,
  session: null,
  _teamsPromise: null,
  _matchesPromise: null,

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

  /** Limpia caché en memoria de listas (útil p. ej. vista pública tras otra pestaña). */
  clearReadCache() {
    this._teamsPromise = null;
    this._matchesPromise = null;
    this._teamsPromises = {};
    this._matchesPromises = {};
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

  async updatePassword(newPassword) {
    const { data, error } = await this.client.auth.updateUser({ password: newPassword });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  async sendPasswordResetEmail(email) {
    const { data, error } = await this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: window.location.origin + window.location.pathname
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  // ── Equipos ──────────────────────────────────────────────────
  async getTeams(torneoId = null) {
    const cacheKey = torneoId || 'all';
    if (!this._teamsPromises) this._teamsPromises = {};
    if (this._teamsPromises[cacheKey]) return this._teamsPromises[cacheKey];
    
    this._teamsPromises[cacheKey] = (async () => {
      let query = this.client.from('equipos').select('*');
      if (torneoId) {
        query = query.eq('torneo_id', torneoId);
      }
      const { data, error } = await query.order('nombre');
      this._teamsPromises[cacheKey] = null;
      return error ? [] : data;
    })();
    
    return this._teamsPromises[cacheKey];
  },

  async addTeam(data) {
    const { name, email, password, city, escudo, torneoId } = data;

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
        // Manejo amigable para usuarios ya registrados
        if (authError.message.includes('already registered')) {
          return { ok: false, error: 'Este correo ya tiene una cuenta activa. Por favor, intenta iniciar sesión o usa un correo diferente.' };
        }
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
        usuario_id: userId,
        torneo_id: torneoId || null
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

  async addAdmin({ name, email, password, tournamentName, tournamentDesc, tournamentCity }) {
    if (!this.client) {
      return { ok: false, error: 'La base de datos no está lista. Intenta recargar la página.' };
    }
    try {
      console.log('Iniciando registro de administrador:', email);

      // 1. Crear usuario en Auth con rol 'admin'
      const { data: authData, error: authError } = await this.client.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            nombre: name,
            rol: 'admin'
          }
        }
      });

      if (authError) {
        console.error('Error Supabase Auth (admin):', authError);
        if (authError.message.includes('already registered')) {
          return { ok: false, error: 'Este correo ya tiene una cuenta activa. Usa un correo diferente.' };
        }
        return { ok: false, error: 'Error de autenticación: ' + authError.message };
      }

      if (!authData.user) {
        return { ok: false, error: 'No se pudo crear el usuario administrador.' };
      }

      const userId = authData.user.id;

      // 2. Actualizar perfil en la tabla pública 'usuarios' (ya creado por el trigger o garantizado aquí)
      const { error: profileError } = await this.client
        .from('usuarios')
        .upsert({
          id: userId,
          email: email.trim().toLowerCase(),
          nombre: name,
          rol: 'admin'
        });

      if (profileError) {
        console.error('Error al insertar perfil admin:', profileError);
        return { ok: false, error: 'Cuenta creada, pero no se pudo asignar el rol de admin: ' + profileError.message };
      }

      // 3. Crear el torneo inicial del administrador
      if (tournamentName) {
        try {
          await this.client
            .from('torneo')
            .insert([{
              nombre: tournamentName,
              descripcion: tournamentDesc || '',
              municipio: tournamentCity || 'Montería',
              admin_id: userId
            }]);
        } catch (torneoErr) {
          console.error('Error al configurar torneo en registro:', torneoErr);
        }
      }

      console.log('Administrador registrado con éxito');
      return { ok: true };
    } catch (err) {
      console.error('Error crítico en addAdmin:', err);
      return { ok: false, error: 'Ocurrió un error inesperado. Revisa tu conexión.' };
    }
  },

  async getTournament(id = null) {
    if (!this.client) return null;
    try {
      let query = this.client.from('torneo').select('*');
      if (id) {
        query = query.eq('id', id);
      } else {
        query = query.order('created_at', { ascending: false }).limit(1);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Error en getTournament:', error.message);
        return null;
      }
      return data && data.length > 0 ? data[0] : null;
    } catch (e) {
      return null;
    }
  },

  async getAllTournaments() {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('torneo')
        .select('*')
        .order('created_at', { ascending: false });
      return error ? [] : data;
    } catch (e) {
      return [];
    }
  },

  async getTournamentsByAdmin(adminId) {
    if (!this.client || !adminId) {
      console.warn('[getTournamentsByAdmin] No client or no adminId:', { client: !!this.client, adminId });
      return [];
    }
    try {
      console.log('[getTournamentsByAdmin] Consultando torneos para admin_id:', adminId);
      const { data, error } = await this.client
        .from('torneo')
        .select('*')
        .eq('admin_id', adminId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[getTournamentsByAdmin] Error de Supabase:', error.message, error.code, error.hint);
        // Si es error de RLS o permisos, intentar sin filtro
        if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
          console.warn('[getTournamentsByAdmin] Posible problema de RLS. Intentando consulta sin filtro...');
          const { data: allData, error: allError } = await this.client
            .from('torneo')
            .select('*')
            .order('created_at', { ascending: false });
          if (!allError && allData) {
            console.log('[getTournamentsByAdmin] Fallback sin filtro retornó:', allData.length, 'torneos');
            return allData.filter(t => t.admin_id === adminId);
          }
        }
        return [];
      }
      console.log('[getTournamentsByAdmin] Torneos encontrados:', data?.length, data);
      return data || [];
    } catch (e) {
      console.error('[getTournamentsByAdmin] Excepción:', e);
      return [];
    }
  },

  async createTournament({ nombre, descripcion, municipio }) {
    if (!this.client) {
      return { ok: false, error: 'La base de datos no está lista. Intenta recargar la página.' };
    }
    try {
      const session = this.getSession();
      const adminId = session ? session.id : null;

      // Garantizar que el usuario exista en la tabla pública para evitar violación de llave foránea
      if (adminId && session.email) {
        await this.client.from('usuarios').upsert({
          id: adminId,
          email: session.email,
          nombre: session.nombre || 'Administrador',
          rol: session.rol || 'admin'
        });
      }

      const { data, error } = await this.client
        .from('torneo')
        .insert([{ nombre, descripcion, municipio, admin_id: adminId }])
        .select();
      if (error) return { ok: false, error: error.message };
      return { ok: true, tournament: data ? data[0] : null };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async saveTournament({ id, nombre, descripcion, municipio }) {
    if (!this.client) {
      return { ok: false, error: 'La base de datos no está lista. Intenta recargar la página.' };
    }
    try {
      if (id) {
        const { error } = await this.client
          .from('torneo')
          .update({ nombre, descripcion, municipio })
          .eq('id', id);
        if (error) return { ok: false, error: error.message };
      } else {
        const { data: existing } = await this.client.from('torneo').select('id').limit(1);
        if (existing && existing.length > 0) {
          const { error } = await this.client
            .from('torneo')
            .update({ nombre, descripcion, municipio })
            .eq('id', existing[0].id);
          if (error) return { ok: false, error: error.message };
        } else {
          const session = this.getSession();
          const adminId = session ? session.id : null;
          const { error } = await this.client
            .from('torneo')
            .insert([{ nombre, descripcion, municipio, admin_id: adminId }]);
          if (error) return { ok: false, error: error.message };
        }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async deleteTeam(teamId) {
    // 1. Obtener el ID del usuario vinculado antes de borrar el equipo
    const { data: team } = await this.client.from('equipos').select('usuario_id').eq('id', teamId).single();
    
    // 2. Borrar el equipo (esto disparará ON DELETE CASCADE en cascada para sus datos)
    const { error } = await this.client.from('equipos').delete().eq('id', teamId);
    if (error) return { ok: false, error: error.message };

    // 3. Borrar el usuario de Auth y de la tabla pública usando la función especial
    if (team?.usuario_id) {
      console.log('Limpiando cuenta de autenticación para:', team.usuario_id);
      await this.client.rpc('delete_user_auth', { target_user_id: team.usuario_id });
    }
    
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

  async updatePlayerPhoto(playerId, base64) {
    const { error } = await this.client.from('jugadores').update({ foto: base64 }).eq('id', playerId);
    return error ? { ok: false, error: error.message } : { ok: true };
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
  async getMatches(torneoId = null) {
    const cacheKey = torneoId || 'all';
    if (!this._matchesPromises) this._matchesPromises = {};
    if (this._matchesPromises[cacheKey]) return this._matchesPromises[cacheKey];

    this._matchesPromises[cacheKey] = (async () => {
      let query = this.client.from('partidos').select('*, equipo_local:equipos!equipo_local_id(nombre, escudo), equipo_visit:equipos!equipo_visit_id(nombre, escudo)');
      if (torneoId) {
        query = query.eq('torneo_id', torneoId);
      }
      const { data, error } = await query.order('fecha', { ascending: true });
      this._matchesPromises[cacheKey] = null;
      return error ? [] : data;
    })();

    return this._matchesPromises[cacheKey];
  },

  async addMatch({ homeTeamId, awayTeamId, date, time, fase, torneoId }) {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const { data, error } = await this.client.from('partidos').insert([{
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time || '18:00',
      fase: fase || 'Clasificación General',
      torneo_id: torneoId || null
    }]).select();

    if (error) return { ok: false, error: error.message };
    return { ok: true, match: data ? data[0] : null };
  },

  async updateMatch(id, { homeTeamId, awayTeamId, date, time, fase, torneoId }) {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const updateData = {
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time,
      fase: fase || 'Clasificación General'
    };
    if (torneoId) updateData.torneo_id = torneoId;
    const { data, error } = await this.client.from('partidos').update(updateData).eq('id', id).select();

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

  async getMatchEvents(matchId) {
    const { data, error } = await this.client
      .from('eventos_partido')
      .select('*')
      .eq('partido_id', matchId);
    return error ? [] : (data || []);
  },

  async saveMatchEvents(matchId, events) {
    try {
      // 1. Borrar eventos previos del partido para evitar duplicados al re-guardar
      await this.client.from('eventos_partido').delete().eq('partido_id', matchId);
      
      if (!events || events.length === 0) return { ok: true };

      // 2. Insertar nuevos eventos
      const toInsert = events.map(e => ({ ...e, partido_id: matchId }));
      const { error } = await this.client.from('eventos_partido').insert(toInsert);
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async markFineAsPaid(fineId) {
    const { error } = await this.client
      .from('eventos_partido')
      .update({ pagada: true })
      .eq('id', fineId);
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  // ── Standings ────────────────────────────────────────────────
  async getStandings(torneoId = null) {
    const [teams, matches] = await Promise.all([this.getTeams(torneoId), this.getMatches(torneoId)]);
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
  async getStats(torneoId = null) {
    try {
      const [teams, matches] = await Promise.all([this.getTeams(torneoId), this.getMatches(torneoId)]);
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

  async getTopScorers(limit = 5, torneoId = null) {
    const { data, error } = await this.client.from('eventos_partido')
      .select('jugador_id, cantidad, jugadores(nombre, foto, equipos(nombre, torneo_id))')
      .eq('tipo', 'gol');

    if (error || !data) return [];
    
    const map = {};
    data.forEach(e => {
      const p = e.jugadores;
      if (!p) return;
      if (torneoId && p.equipos?.torneo_id !== torneoId) return;
      if (!map[e.jugador_id]) {
        map[e.jugador_id] = { nombre: p.nombre, foto: p.foto, equipo: p.equipos?.nombre, goles: 0 };
      }
      map[e.jugador_id].goles += (e.cantidad || 1);
    });

    return Object.values(map).sort((a,b) => b.goles - a.goles).slice(0, limit);
  },

  async getBestGoalkeepers(limit = 5, torneoId = null) {
    // Lógica simplificada: equipos con menos goles en contra
    const standings = await this.getStandings(torneoId);
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

  async getAllPendingFines(torneoId = null) {
    // Todas las tarjetas pendientes de pago (para el dashboard de admin)
    try {
      const { data, error } = await this.client
        .from('eventos_partido')
        .select('*, jugadores(nombre, dorsal, equipos(torneo_id)), partidos(fecha)')
        .in('tipo', ['amarilla', 'roja'])
        .eq('pagada', false);
      if (error) {
        console.warn('getAllPendingFines error (puede que la columna pagada no exista):', error.message);
        return [];
      }
      if (!data) return [];
      if (torneoId) {
        return data.filter(e => e.jugadores?.equipos?.torneo_id === torneoId);
      }
      return data;
    } catch (e) {
      return [];
    }
  }
};

DB.init();
