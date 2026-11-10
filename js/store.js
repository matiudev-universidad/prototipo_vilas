/* ==========================================================================
   Vila's Motor · Prototipo — CAPA DE DATOS Y REGLAS DE NEGOCIO
   Simula el backend: guarda en localStorage, aplica validaciones, calcula
   estados (semáforo), genera alertas y deja registro de auditoría.
   ========================================================================== */

const STORAGE_KEY = "vilasmotor_prototipo_v5"; // v5: flota real de Iquique (los datos v4 de ejemplo se descartan)

/* ---------------- Roles y permisos (RBAC) ---------------- */
const ROLES = {
  admin:       { nombre: "Administrador del sistema",  permisos: ["ver", "registrarLectura", "corregirLectura", "registrarMantencion", "verInsumos", "crudEquipos", "gestionarAlertas", "reportes", "auditoria", "verDispositivos", "gestionarDispositivos"] },
  encargada:   { nombre: "Encargada de Planificación", permisos: ["ver", "registrarLectura", "corregirLectura", "registrarMantencion", "verInsumos", "crudEquipos", "gestionarAlertas", "reportes", "verDispositivos"] },
  asistente:   { nombre: "Asistente de Planificación", permisos: ["ver", "registrarLectura", "corregirLectura", "registrarMantencion", "verInsumos"] },
  ti:          { nombre: "TI · Soporte de sistemas",   permisos: ["ver", "verDispositivos", "gestionarDispositivos", "auditoria"] },
  practicante: { nombre: "Practicante (solo lectura)", permisos: ["ver"] }
};

const Store = (function () {
  let db = null;

  /* ---------- Persistencia ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      db = raw ? JSON.parse(raw) : clone(SEED);
    } catch (e) { db = clone(SEED); }
    db.incidencias = db.incidencias || [];
    db.telemetria = db.telemetria || [];
    db.bloqueos = db.bloqueos || {};
    db.telemetriaSync = db.telemetriaSync || { ultima: null, ultimaManual: null };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento: queda en memoria */ }
  }
  function reset() {
    db = clone(SEED); db.incidencias = [];
    db.telemetriaSync = { ultima: null, ultimaManual: null };
    save();
  }
  function nextId(list) { return list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1; }
  function now() {
    const d = new Date(); const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* ---------- Contraseñas (hash con sal) ---------- */
  const PASS_MIN = 12;
  const MAX_INTENTOS = 5;               // intentos fallidos antes del bloqueo
  const BLOQUEO_MS = 5 * 60 * 1000;     // bloqueo temporal de 5 minutos
  const ITERACIONES = 100000;
  const hexABytes = h => new Uint8Array(h.match(/../g).map(b => parseInt(b, 16)));
  const bytesAHex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");
  async function pbkdf2(password, salHex, iteraciones) {
    if (!(window.crypto && crypto.subtle)) throw new Error("Este navegador no permite verificar contraseñas de forma segura. Usa Chrome o Edge actualizados.");
    const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexABytes(salHex), iterations: iteraciones, hash: "SHA-256" }, clave, 256);
    return bytesAHex(bits);
  }
  async function hashPassword(password) {
    const sal = bytesAHex(crypto.getRandomValues(new Uint8Array(16)));
    return `pbkdf2$${ITERACIONES}$${sal}$${await pbkdf2(password, sal, ITERACIONES)}`;
  }
  async function verificarPassword(password, passwordHash) {
    const [alg, iter, sal, hash] = String(passwordHash || "").split("$");
    if (alg !== "pbkdf2") return false;
    const calc = await pbkdf2(password, sal, Number(iter));
    let dif = calc.length ^ hash.length; // comparación de tiempo constante
    for (let i = 0; i < calc.length; i++) dif |= calc.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
    return dif === 0;
  }
  /* Política: mínimo 12 caracteres y al menos un carácter especial */
  function validarPassword(p) {
    if (!p || p.length < PASS_MIN) throw new Error(`La contraseña debe tener al menos ${PASS_MIN} caracteres.`);
    if (!/[^A-Za-z0-9]/.test(p)) throw new Error("La contraseña debe incluir al menos un carácter especial (ej: # $ % & * !).");
  }

  /* ---------- Sesión ---------- */
  let usuarioActual = null;
  /* Devuelve { ok, usuario } o { ok: false, error, bloqueado } */
  async function login(email, password) {
    const clave = String(email || "").trim().toLowerCase();
    const b = db.bloqueos[clave];
    if (b && b.hasta > Date.now()) {
      const min = Math.ceil((b.hasta - Date.now()) / 60000);
      return { ok: false, bloqueado: true, error: `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${min} min.` };
    }
    const u = db.usuarios.find(x => x.email.toLowerCase() === clave);
    if (!u || !(await verificarPassword(password, u.password_hash))) {
      // registro nuevo, o reiniciado si ya venció un bloqueo anterior
      const reg = !b || (b.hasta && b.hasta <= Date.now()) ? { fallos: 0, hasta: 0 } : b;
      reg.fallos++;
      if (reg.fallos >= MAX_INTENTOS) {
        reg.fallos = 0; reg.hasta = Date.now() + BLOQUEO_MS;
        db.bloqueos[clave] = reg;
        audit("Bloqueo de cuenta", `${clave}: ${MAX_INTENTOS} intentos fallidos, bloqueada por ${BLOQUEO_MS / 60000} min`);
        return { ok: false, bloqueado: true, error: `Demasiados intentos fallidos. La cuenta quedó bloqueada por ${BLOQUEO_MS / 60000} minutos.` };
      }
      db.bloqueos[clave] = reg; save();
      const quedan = MAX_INTENTOS - reg.fallos;
      return { ok: false, error: `Correo o contraseña incorrectos. Te ${quedan === 1 ? "queda 1 intento" : "quedan " + quedan + " intentos"} antes del bloqueo temporal.` };
    }
    delete db.bloqueos[clave];
    iniciarSesion(u);
    audit("Inicio de sesión", `${u.nombre} (${ROLES[u.rol].nombre})`);
    return { ok: true, usuario: u };
  }
  function iniciarSesion(u) {
    usuarioActual = u;
    try { sessionStorage.setItem(STORAGE_KEY + "_sesion", String(u.id)); } catch (e) {}
  }
  /* Mantiene la sesión del usuario ya autenticado (ej: tras restablecer datos) */
  function mantenerSesion(id) { const u = db.usuarios.find(x => x.id === id); if (u) iniciarSesion(u); return u; }
  async function cambiarPassword(actual, nueva, repetir) {
    const u = usuarioActual;
    if (!u) throw new Error("No hay sesión activa.");
    if (!(await verificarPassword(actual, u.password_hash))) throw new Error("La contraseña actual no es correcta.");
    validarPassword(nueva);
    if (nueva !== repetir) throw new Error("Las contraseñas nuevas no coinciden.");
    if (nueva === actual) throw new Error("La nueva contraseña debe ser distinta de la actual.");
    u.password_hash = await hashPassword(nueva);
    audit("Cambio de contraseña", u.nombre);
  }
  function restoreSession() {
    try {
      const id = Number(sessionStorage.getItem(STORAGE_KEY + "_sesion"));
      usuarioActual = db.usuarios.find(u => u.id === id) || null;
    } catch (e) { usuarioActual = null; }
    return usuarioActual;
  }
  function logout() {
    usuarioActual = null;
    try { sessionStorage.removeItem(STORAGE_KEY + "_sesion"); } catch (e) {}
  }
  function user() { return usuarioActual; }
  function can(permiso) { return !!usuarioActual && ROLES[usuarioActual.rol].permisos.includes(permiso); }
  function requiere(permiso) { if (!can(permiso)) throw new Error("Tu rol no tiene permiso para esta acción."); }

  /* ---------- Auditoría ---------- */
  function audit(accion, detalle, extra) {
    db.auditoria.unshift(Object.assign({ fecha: now(), usuario: usuarioActual ? usuarioActual.nombre : "Sistema", accion, detalle }, extra || {}));
    save();
  }

  /* ---------- Cálculo de estado (semáforo) ---------- */
  /* El intervalo se respeta como en el historial: las mantenciones corresponden a hitos
     fijos (250, 500, 750… h). Una mantención hecha con atraso (o hasta "aviso" antes) cuenta
     para su hito, y la siguiente queda programada en el hito que sigue, no en lectura + intervalo.
     Ej. VR005 (ex V168): mantención de 3.000 h hecha a las 3.157 h → programada a las 3.250 h. */
  function hitoMantencion(eq) {
    return Math.floor((eq.ultimaMantencion + (eq.aviso || 0)) / eq.intervalo) * eq.intervalo;
  }
  /* Semáforo de 4 niveles: verde (operativo) · amarillo (próximo, dentro del aviso)
     · naranja (crítico, queda la mitad del aviso o menos) · rojo (vencido / inconsistente) */
  function estadoEquipo(eq) {
    const hito = hitoMantencion(eq);
    const proxima = hito + eq.intervalo;
    const restante = proxima - eq.horometro;
    const usado = eq.horometro - hito;
    let color = "verde", texto = "Operativo";
    if (restante <= 0) { color = "rojo"; texto = "Mantención vencida"; }
    else if (restante <= eq.aviso / 2) { color = "naranja"; texto = "Mantención crítica"; }
    else if (restante <= eq.aviso) { color = "amarillo"; texto = "Próxima mantención"; }
    const incid = db.incidencias.find(i => i.equipoId === eq.id && !i.resuelta);
    if (incid) { color = "rojo"; texto = "Lectura inconsistente"; }
    return { hito, proxima, restante, usado, color, texto, progreso: Math.min(100, Math.max(0, Math.round(usado / eq.intervalo * 100))) };
  }
  /* Tipo de pauta que corresponde a un hito (ej: 3.000 h → Preventiva 1000 h, 3.250 h → Preventiva 250 h) */
  const PAUTAS_H = [2000, 1000, 500, 250];
  function pautaDeHito(eq, hito) {
    if (eq.unidad === "km") return eq.intervalo;
    return PAUTAS_H.find(p => p >= eq.intervalo && hito % p === 0) || eq.intervalo;
  }
  /* Aviso anticipado: 50 h maquinaria · 300 km camionetas · 1.000 km transporte (camiones, camas bajas, ramplas) */
  const TIPOS_TRANSPORTE = ["Camión", "Camión pluma", "Camión tolva", "Camión aljibe", "Camión combustible", "Camión lubricador", "Tracto camión", "Cama baja", "Rampla"];
  function avisoPara(unidad, tipo, cat) {
    if (unidad !== "km") return cat.aviso;
    return TIPOS_TRANSPORTE.includes(tipo) ? 1000 : 300;
  }
  function categoria(cod) { return db.categorias.find(c => c.codigo === cod); }
  function destino(nombre) { return db.destinos.find(d => d.nombre === nombre) || { nombre: nombre || "—", tipo: "—", lat: null, lng: null }; }

  /* ---------- Equipos (CRUD) ---------- */
  function equipos() { return db.equipos.filter(e => e.activo); }
  function equipo(id) { return db.equipos.find(e => e.id === Number(id)); }
  function validarEquipo(d, id) {
    if (!d.codigo || !/^(VA|VG|VR|V)\d{1,4}$/i.test(d.codigo)) throw new Error("El código debe empezar con VA, VG, VR o V seguido de números (ej: VG15).");
    if (db.equipos.some(e => e.activo && e.codigo.toUpperCase() === d.codigo.toUpperCase() && e.id !== id)) throw new Error("Ya existe un equipo activo con ese código.");
    if (!d.nombre) throw new Error("El nombre es obligatorio.");
    if (!(d.intervalo > 0)) throw new Error("El intervalo de mantención debe ser mayor a 0.");
    if (d.horometro < 0 || d.ultimaMantencion < 0) throw new Error("Los valores no pueden ser negativos.");
    if (d.ultimaMantencion > d.horometro) throw new Error("La última mantención no puede ser mayor al horómetro actual.");
  }
  function crearEquipo(d) {
    requiere("crudEquipos");
    d.codigo = d.codigo.toUpperCase();
    validarEquipo(d, null);
    const cat = categoria(d.categoria);
    const dest = destino(d.destino);
    const eq = Object.assign({ id: nextId(db.equipos), activo: true, unidad: cat.unidad, aviso: avisoPara(d.unidad || cat.unidad, d.tipo, cat), lat: dest.lat, lng: dest.lng }, d);
    db.equipos.push(eq);
    audit("Alta de equipo", `${eq.codigo} · ${eq.nombre}`);
    return eq;
  }
  function editarEquipo(id, d) {
    requiere("crudEquipos");
    const eq = equipo(id);
    d.codigo = d.codigo.toUpperCase();
    validarEquipo(d, eq.id);
    const cambios = Object.keys(d).filter(k => String(eq[k]) !== String(d[k])).map(k => `${k}: ${eq[k]} → ${d[k]}`);
    if (d.destino && d.destino !== eq.destino) { const dest = destino(d.destino); eq.lat = dest.lat; eq.lng = dest.lng; }
    Object.assign(eq, d);
    audit("Edición de equipo", `${eq.codigo} · ${cambios.join(", ") || "sin cambios"}`);
    return eq;
  }
  function eliminarEquipo(id) {
    requiere("crudEquipos");
    const eq = equipo(id);
    eq.activo = false; // baja lógica: el historial se conserva
    db.dispositivos.filter(d => d.equipoId === eq.id).forEach(d => { d.equipoId = null; d.estado = "sin vincular"; });
    audit("Baja de equipo", `${eq.codigo} · ${eq.nombre} (baja lógica, se conserva el historial)`);
  }

  /* ---------- Lecturas de horómetro ---------- */
  function lecturas(equipoId) {
    return db.lecturas.filter(l => l.equipoId === Number(equipoId)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  /* origen: "manual" | "ESP32" | "GPS". Devuelve { ok, requiereMotivo, alerta } */
  function registrarLectura(equipoId, valor, opts) {
    opts = opts || {};
    const eq = equipo(equipoId);
    valor = Number(valor);
    if (!eq) throw new Error("Equipo no encontrado.");
    if (!(valor >= 0) || isNaN(valor)) throw new Error("Ingresa un valor numérico válido.");
    const origen = opts.origen || "manual";
    if (origen === "manual") requiere("registrarLectura");
    const anterior = eq.horometro;
    const esCorreccion = valor < anterior;

    if (esCorreccion && origen === "manual") {
      if (!opts.motivo) return { ok: false, requiereMotivo: true, anterior };
      requiere("corregirLectura");
    }
    if (esCorreccion && origen !== "manual") {
      // El dispositivo informó menos horas que la última lectura: posible reinicio o falla.
      db.incidencias.push({ id: nextId(db.incidencias), equipoId: eq.id, fecha: opts.fecha || now(), valor, anterior, dispositivo: opts.dispositivo, resuelta: false });
      audit("Lectura inconsistente", `${eq.codigo}: ${opts.dispositivo} informó ${fmt(valor)} con último valor ${fmt(anterior)} (no se actualizó el horómetro)`);
      save();
      return { ok: false, inconsistente: true };
    }

    const l = { id: nextId(db.lecturas), equipoId: eq.id, valor, fecha: opts.fecha || now(), origen,
      usuario: origen !== "manual" ? opts.dispositivo : usuarioActual.nombre, esCorreccion,
      motivo: opts.motivo || null, valorAnterior: anterior };
    db.lecturas.push(l);
    eq.horometro = valor;
    const est = estadoEquipo(eq);
    audit(esCorreccion ? "Corrección de horómetro" : "Registro de horómetro",
      `${eq.codigo}: ${fmt(anterior)} → ${fmt(valor)} ${eq.unidad} (${origen})${esCorreccion ? " · Motivo: " + opts.motivo : ""}`,
      esCorreccion ? { valorAnterior: anterior } : null);
    save();
    return { ok: true, estado: est };
  }
  function resolverIncidencia(id, nota) {
    requiere("registrarLectura");
    const inc = db.incidencias.find(i => i.id === id);
    inc.resuelta = true;
    const eq = equipo(inc.equipoId);
    audit("Incidencia resuelta", `${eq.codigo}: ${nota || "revisada"}`);
  }

  /* ---------- Mantenciones ---------- */
  function mantenciones(equipoId) {
    return db.mantenciones.filter(m => equipoId == null || m.equipoId === Number(equipoId)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  function registrarMantencion(d) {
    requiere("registrarMantencion");
    const eq = equipo(d.equipoId);
    if (!d.fecha) throw new Error("La fecha es obligatoria.");
    if (!(d.valor >= 0)) throw new Error("Ingresa el horómetro al momento de la mantención.");
    if (d.valor < eq.ultimaMantencion) throw new Error("El horómetro no puede ser menor al de la última mantención (" + fmt(eq.ultimaMantencion) + ").");
    const m = { id: nextId(db.mantenciones), equipoId: eq.id, ot: d.ot || ("OT-" + Date.now().toString().slice(-6)), fecha: d.fecha, tipo: d.tipo,
      valor: Number(d.valor), responsable: d.responsable || usuarioActual.nombre, insumos: d.insumos || [], registradoPor: usuarioActual.nombre };
    db.mantenciones.push(m);
    eq.ultimaMantencion = m.valor;
    if (m.valor > eq.horometro) eq.horometro = m.valor;
    db.gestionAlertas = db.gestionAlertas.filter(g => g.equipoId !== eq.id); // la alerta se cierra
    audit("Registro de mantención", `${eq.codigo}: ${m.tipo} a ${fmt(m.valor)} ${eq.unidad} · OT ${m.ot} · ${m.insumos.length} insumo(s)`);
    save();
    return m;
  }

  /* ---------- Alertas ---------- */
  function alertas() {
    const lista = [];
    equipos().forEach(eq => {
      const est = estadoEquipo(eq);
      const inc = db.incidencias.find(i => i.equipoId === eq.id && !i.resuelta);
      if (inc) lista.push({ tipo: "inconsistente", nivel: "rojo", equipo: eq, estado: est, incidencia: inc, gestion: null });
      else if (est.color !== "verde") {
        lista.push({ tipo: "mantencion", nivel: est.color, equipo: eq, estado: est, gestion: db.gestionAlertas.find(g => g.equipoId === eq.id) || null });
      }
    });
    const orden = { rojo: 0, naranja: 1, amarillo: 2 };
    return lista.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.estado.restante - b.estado.restante);
  }
  function marcarEnGestion(equipoId, nota) {
    requiere("gestionarAlertas");
    const eq = equipo(equipoId);
    db.gestionAlertas = db.gestionAlertas.filter(g => g.equipoId !== eq.id);
    db.gestionAlertas.push({ equipoId: eq.id, enGestion: true, usuario: usuarioActual.nombre, fecha: now(), nota: nota || "" });
    audit("Alerta en gestión", `${eq.codigo} marcada en gestión${nota ? " · " + nota : ""}`);
  }
  function quitarGestion(equipoId) {
    requiere("gestionarAlertas");
    const eq = equipo(equipoId);
    db.gestionAlertas = db.gestionAlertas.filter(g => g.equipoId !== eq.id);
    audit("Alerta reabierta", `${eq.codigo}`);
  }

  /* ---------- Dispositivos IoT (ESP32) y rastreadores GPS ----------
     ESP32: mide horas de motor encendido. GPS: equipos sin motor ni horómetro (camas bajas,
     ramplas) que informan ubicación, encendido/movimiento y km recorridos.               */
  const esGPS = d => !!d && /^GPS-/.test(d.deviceId);
  const origenDe = d => (esGPS(d) ? "GPS" : "ESP32");
  function dispositivos() { return db.dispositivos; }
  function dispositivo(id) { return db.dispositivos.find(d => d.id === Number(id)); }
  function vincularDispositivo(id, equipoId) {
    requiere("gestionarDispositivos");
    const d = dispositivo(id);
    equipoId = equipoId ? Number(equipoId) : null;
    if (equipoId && db.dispositivos.some(x => x.equipoId === equipoId && x.id !== d.id && x.estado !== "baja"))
      throw new Error("Ese equipo ya tiene un dispositivo vinculado.");
    d.equipoId = equipoId;
    d.estado = equipoId ? (d.estado === "sin vincular" ? "online" : d.estado) : "sin vincular";
    if (equipoId && !d.ultimaConexion) d.ultimaConexion = now();
    audit("Vinculación de dispositivo", `${d.deviceId} → ${equipoId ? equipo(equipoId).codigo : "sin equipo"}`);
  }
  function registrarDispositivo(deviceId, tipo) {
    requiere("gestionarDispositivos");
    const gps = /GPS/i.test(tipo);
    if (gps && !/^GPS-\d{3}$/.test(deviceId)) throw new Error("El ID de un rastreador GPS debe tener el formato GPS-000.");
    if (!gps && !/^ESP32-\d{3}$/.test(deviceId)) throw new Error("El ID debe tener el formato ESP32-000.");
    if (db.dispositivos.some(d => d.deviceId === deviceId)) throw new Error("Ya existe un dispositivo con ese ID.");
    const d = { id: nextId(db.dispositivos), deviceId, tipo, equipoId: null, estado: "sin vincular", ultimaConexion: null, cola: [] };
    db.dispositivos.push(d);
    audit("Alta de dispositivo", `${deviceId} (${tipo})`);
  }
  function darDeBaja(id) {
    requiere("gestionarDispositivos");
    const d = dispositivo(id);
    d.estado = "baja"; d.equipoId = null; d.cola = [];
    audit("Baja de dispositivo", d.deviceId);
  }
  function cambiarConexion(id, online) {
    requiere("gestionarDispositivos");
    const d = dispositivo(id);
    if (!d.equipoId) throw new Error("El dispositivo no está vinculado a un equipo.");
    if (!online) { d.estado = "offline"; save(); return { enviados: 0 }; }
    // Store-and-forward: al reconectar despacha la cola en orden
    d.estado = "online";
    d.ultimaConexion = now();
    const pendientes = d.cola.splice(0);
    let enviados = 0;
    pendientes.forEach(p => { const r = registrarLectura(d.equipoId, p.valor, { origen: origenDe(d), dispositivo: d.deviceId, fecha: p.fecha }); if (r.ok) enviados++; });
    audit("Sincronización de cola", `${d.deviceId}: ${pendientes.length} lectura(s) despachadas al reconectar`);
    return { enviados, total: pendientes.length };
  }
  /* Simula que el ESP32 midió horas de motor encendido (o el GPS los km recorridos) y envía el JSON */
  function simularLectura(id, reinicio) {
    requiere("gestionarDispositivos");
    const d = dispositivo(id);
    if (!d.equipoId) throw new Error("Vincula el dispositivo a un equipo antes de simular.");
    const eq = equipo(d.equipoId);
    const ultimoEnCola = d.cola.length ? d.cola[d.cola.length - 1].valor : eq.horometro;
    const incremento = eq.unidad === "km" ? 150 + Math.round(Math.random() * 350) : 4 + Math.round(Math.random() * 10);
    const valor = reinicio ? 3 : ultimoEnCola + incremento;
    const payload = esGPS(d)
      ? { deviceId: d.deviceId, odometro_km: valor, encendido: true, lat: eq.lat, lng: eq.lng, timestamp: now() }
      : { deviceId: d.deviceId, horas: valor, lat: eq.lat, lng: eq.lng, timestamp: now() };
    if (d.estado === "offline") {
      d.cola.push({ valor, fecha: payload.timestamp });
      save();
      return { encolada: true, payload };
    }
    d.ultimaConexion = payload.timestamp;
    const r = registrarLectura(eq.id, valor, { origen: origenDe(d), dispositivo: d.deviceId, fecha: payload.timestamp });
    return Object.assign({ payload }, r);
  }

  /* ---------- Telemetría y horómetros (faenas mineras + equipos con GPS) ----------
     Cada sincronización consulta a los ESP32 y GPS: si el equipo está encendido / en uso
     el horómetro (o el km del GPS) avanza según el tiempo transcurrido y la ubicación se actualiza. */
  const AUTO_MS = 5 * 60 * 1000;      // actualización automática cada 5 minutos
  const COOLDOWN_MS = 2 * 60 * 1000;  // espera entre sincronizaciones manuales
  function telemetriaDe(eq) {
    let t = db.telemetria.find(x => x.equipoId === eq.id);
    if (!t) { t = { equipoId: eq.id, enUso: false, horas: eq.horometro }; db.telemetria.push(t); }
    return t;
  }
  function telemetria() {
    return equipos().map(eq => ({ eq, disp: db.dispositivos.find(d => d.equipoId === eq.id && d.estado !== "baja") || null }))
      .filter(x => destino(x.eq.destino).tipo === "Minería" || esGPS(x.disp))
      .map(({ eq, disp }) => ({ equipo: eq, t: telemetriaDe(eq), disp, online: !!disp && disp.estado === "online", gps: esGPS(disp) }));
  }
  function sincronizarTelemetria(manual) {
    const ahora = Date.now();
    if (manual && db.telemetriaSync.ultimaManual && ahora - db.telemetriaSync.ultimaManual < COOLDOWN_MS)
      throw new Error("Espera a que termine el tiempo de espera para sincronizar de nuevo.");
    let actualizados = 0;
    telemetria().forEach(({ equipo: eq, t, disp, online }) => {
      // si el horómetro del sistema cambió por otra vía (lectura manual, mantención), se alinea
      if (Math.floor(t.horas) !== eq.horometro) t.horas = eq.horometro;
      if (!online) return;
      const desde = t.ultimaSync || ahora - AUTO_MS;
      const horasTranscurridas = Math.min(ahora - desde, 60 * 60 * 1000) / 3600000;
      t.ultimaSync = ahora;
      disp.ultimaConexion = now();
      if (!t.enUso) return;
      const anterior = t.horas;
      t.horas = Math.round((t.horas + horasTranscurridas * (eq.unidad === "km" ? 30 : 1)) * 100) / 100;
      t.delta = Math.round((t.horas - anterior) * 100) / 100;
      eq.lat = Math.round((eq.lat + (Math.random() - .5) * .004) * 10000) / 10000;
      eq.lng = Math.round((eq.lng + (Math.random() - .5) * .004) * 10000) / 10000;
      eq.ultimaUbicacion = now();
      actualizados++;
      // el horómetro del sistema registra una lectura cada vez que se completa una hora/km entero
      if (Math.floor(t.horas) > eq.horometro) registrarLectura(eq.id, Math.floor(t.horas), { origen: origenDe(disp), dispositivo: disp.deviceId });
    });
    db.telemetriaSync.ultima = ahora;
    if (manual) {
      db.telemetriaSync.ultimaManual = ahora;
      audit("Sincronización de horómetros", `${actualizados} equipo(s) en faena actualizados manualmente`);
    }
    save();
    return { actualizados };
  }
  function estadoSync() {
    const ahora = Date.now(), s = db.telemetriaSync;
    return {
      ultima: s.ultima,
      proximaAuto: Math.max(0, (s.ultima || 0) + AUTO_MS - ahora),
      cooldown: s.ultimaManual ? Math.max(0, s.ultimaManual + COOLDOWN_MS - ahora) : 0,
      tocaAuto: !s.ultima || ahora - s.ultima >= AUTO_MS
    };
  }

  /* ---------- Insumos (Softland, solo lectura) ---------- */
  function insumos() { return db.insumos; }

  /* ---------- Utilidades ---------- */
  function fmt(n) { return Number(n).toLocaleString("es-CL"); }

  load();
  return {
    reset, save, user, can, login, logout, restoreSession, mantenerSesion, cambiarPassword, PASS_MIN,
    usuarios: () => db.usuarios, categorias: () => db.categorias, destinos: () => db.destinos, destino, base: () => db.base, categoria,
    TIPOS_TRANSPORTE, equipos, equipo, crearEquipo, editarEquipo, eliminarEquipo, estadoEquipo, pautaDeHito,
    lecturas, registrarLectura, resolverIncidencia,
    mantenciones, registrarMantencion,
    alertas, marcarEnGestion, quitarGestion,
    dispositivos, dispositivo, vincularDispositivo, registrarDispositivo, darDeBaja, cambiarConexion, simularLectura,
    telemetria, sincronizarTelemetria, estadoSync,
    insumos, auditoria: () => db.auditoria, fmt
  };
})();
