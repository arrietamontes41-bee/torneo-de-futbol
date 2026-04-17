/**
 * db.js — Capa de persistencia
 * Gestión de equipos, jugadores, partidos y estadísticas con Supabase.
 */

// Configuración global (debe estar en config.js)
const sb = () => DB.client;

const DB = {
  client: null,
  session: null,

  async init() {
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.loadSession();
  },

  // ── Helpers de Seguridad ─────────────────────────────────────
  async hashPassword(password) {
    if (!password) return '';
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── Sesión Local ─────────────────────────────────────────────
  saveSession(user) {
    this.session = user;
    localStorage.setItem('torneo_session', JSON.stringify(user));
  },
  loadSession() {
    const s = localStorage.getItem('torneo_session');
    if (s) this.session = JSON.parse(s);
  },
  getSession() {
    return this.session;
  },
  clearSession() {
    this.session = null;
    localStorage.removeItem('torneo_session');
  },

  // ── Autenticación ────────────────────────────────────────────
  async login(email, password) {
    const hashed = await this.hashPassword(password);
    const { data, error } = await this.client
      .from('usuarios')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('password', hashed)
      .single();

    if (error || !data) return { ok: false, error: 'Credenciales incorrectas.' };
    this.saveSession(data);
    return { ok: true, user: data };
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
    // Generar PIN de 6 dígitos
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

  async addTeam(teamData, userData) {
    // 1. Hash de la contraseña del nuevo usuario
    const hashedPass = await this.hashPassword(userData.password);
    const securedUser = { ...userData, password: hashedPass };

    // 2. Crear usuario
    const { data: user, error: userError } = await this.client.from('usuarios').insert([securedUser]).select().single();
    if (userError) return { ok: false, error: userError.message };

    // 2. Crear equipo
    const { data: team, error: teamError } = await this.client.from('equipos').insert([{
      ...teamData,
      usuario_id: user.id
    }]).select().single();

    if (teamError) {
      await this.client.from('usuarios').delete().eq('id', user.id);
      return { ok: false, error: teamError.message };
    }
    return { ok: true, team };
  },

  async deleteTeam(teamId) {
    const { data: team } = await this.client.from('equipos').select('usuario_id').eq('id', teamId).single();
    const { error } = await this.client.from('equipos').delete().eq('id', teamId);
    if (error) return { ok: false, error: error.message };
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
    const { data } = await this.client.from('jugadores').select('nombre, equipos(nombre)').eq('documento', doc).single();
    if (data) return { exists: true, equipo: data.equipos.nombre };
    return { exists: false };
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
    }]).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, match: data };
  },

  async updateMatch(id, { homeTeamId, awayTeamId, date, time, fase }) {
    if (homeTeamId === awayTeamId) return { ok: false, error: 'Los equipos deben ser distintos.' };
    const { data, error } = await this.client.from('partidos').update({
      equipo_local_id: homeTeamId,
      equipo_visit_id: awayTeamId,
      fecha: date,
      hora: time,
      fase: fase || 'Clasificación General'
    }).eq('id', id).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, match: data };
  },

  async setMatchResult(id, homeGoals, awayGoals) {
    const { data, error } = await this.client.from('partidos').update({
      goles_local: homeGoals,
      goles_visit: awayGoals,
      estado: 'finalizado'
    }).eq('id', id).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, match: data };
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
    // Ejemplo: tarjetas que requieren pago
    return [];
  }
};

DB.init();
