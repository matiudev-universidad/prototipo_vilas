/* ==========================================================================
   Vila's Motor · Prototipo — CAPA DE DATOS Y REGLAS DE NEGOCIO
   Simula el backend: guarda en localStorage, aplica validaciones, calcula
   estados (semáforo), genera alertas y deja registro de auditoría.
   ========================================================================== */

const STORAGE_KEY = "vilasmotor_prototipo_v2";

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

  /* ---------- Sesión ---------- */
  let usuarioActual = null;
  function login(email, password) {
    const u = db.usuarios.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return null;
    usuarioActual = u;
    try { sessionStorage.setItem(STORAGE_KEY + "_sesion", String(u.id)); } catch (e) {}
    audit("Inicio de sesión", `${u.nombre} (${ROLES[u.rol].nombre})`);
    return u;
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
  function estadoEquipo(eq) {
    const proxima = eq.ultimaMantencion + eq.intervalo;
    const restante = proxima - eq.horometro;
    const usado = eq.horometro - eq.ultimaMantencion;
    let color = "verde", texto = "Operativo";
    if (restante <= 0) { color = "rojo"; texto = "Mantención vencida"; }
    else if (restante <= eq.aviso) { color = "amarillo"; texto = "Próxima mantención"; }
    const incid = db.incidencias.find(i => i.equipoId === eq.id && !i.resuelta);
    if (incid) { color = "rojo"; texto = "Lectura inconsistente"; }
    return { proxima, restante, color, texto, progreso: Math.min(100, Math.max(0, Math.round(usado / eq.intervalo * 100))) };
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
    const eq = Object.assign({ id: nextId(db.equipos), activo: true, unidad: cat.unidad, aviso: d.unidad === "km" ? 300 : cat.aviso, lat: dest.lat, lng: dest.lng }, d);
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
  /* origen: "manual" | "ESP32". Devuelve { ok, requiereMotivo, alerta } */
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
    if (esCorreccion && origen === "ESP32") {
      // El dispositivo informó menos horas que la última lectura: posible reinicio o falla.
      db.incidencias.push({ id: nextId(db.incidencias), equipoId: eq.id, fecha: opts.fecha || now(), valor, anterior, dispositivo: opts.dispositivo, resuelta: false });
      audit("Lectura inconsistente", `${eq.codigo}: ${opts.dispositivo} informó ${fmt(valor)} con último valor ${fmt(anterior)} (no se actualizó el horómetro)`);
      save();
      return { ok: false, inconsistente: true };
    }

    const l = { id: nextId(db.lecturas), equipoId: eq.id, valor, fecha: opts.fecha || now(), origen,
      usuario: origen === "ESP32" ? opts.dispositivo : usuarioActual.nombre, esCorreccion,
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
    const orden = { rojo: 0, amarillo: 1 };
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

  /* ---------- Dispositivos IoT (ESP32) ---------- */
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
    if (!/^ESP32-\d{3}$/.test(deviceId)) throw new Error("El ID debe tener el formato ESP32-000.");
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
    pendientes.forEach(p => { const r = registrarLectura(d.equipoId, p.valor, { origen: "ESP32", dispositivo: d.deviceId, fecha: p.fecha }); if (r.ok) enviados++; });
    audit("Sincronización de cola", `${d.deviceId}: ${pendientes.length} lectura(s) despachadas al reconectar`);
    return { enviados, total: pendientes.length };
  }
  /* Simula que el ESP32 midió horas de motor encendido y envía el JSON */
  function simularLectura(id, reinicio) {
    requiere("gestionarDispositivos");
    const d = dispositivo(id);
    if (!d.equipoId) throw new Error("Vincula el dispositivo a un equipo antes de simular.");
    const eq = equipo(d.equipoId);
    const ultimoEnCola = d.cola.length ? d.cola[d.cola.length - 1].valor : eq.horometro;
    const incremento = eq.unidad === "km" ? 150 + Math.round(Math.random() * 350) : 4 + Math.round(Math.random() * 10);
    const valor = reinicio ? 3 : ultimoEnCola + incremento;
    const payload = { deviceId: d.deviceId, horas: valor, lat: eq.lat, lng: eq.lng, timestamp: now() };
    if (d.estado === "offline") {
      d.cola.push({ valor, fecha: payload.timestamp });
      save();
      return { encolada: true, payload };
    }
    d.ultimaConexion = payload.timestamp;
    const r = registrarLectura(eq.id, valor, { origen: "ESP32", dispositivo: d.deviceId, fecha: payload.timestamp });
    return Object.assign({ payload }, r);
  }

  /* ---------- Telemetría y horómetros (equipos en faenas mineras) ----------
     Cada sincronización consulta a los ESP32: si el motor está encendido el horómetro
     avanza según el tiempo transcurrido y la ubicación GPS se actualiza.            */
  const AUTO_MS = 5 * 60 * 1000;      // actualización automática cada 5 minutos
  const COOLDOWN_MS = 2 * 60 * 1000;  // espera entre sincronizaciones manuales
  function telemetriaDe(eq) {
    let t = db.telemetria.find(x => x.equipoId === eq.id);
    if (!t) { t = { equipoId: eq.id, enUso: false, horas: eq.horometro }; db.telemetria.push(t); }
    return t;
  }
  function telemetria() {
    return equipos().filter(e => destino(e.destino).tipo === "Minería").map(eq => {
      const t = telemetriaDe(eq);
      const disp = db.dispositivos.find(d => d.equipoId === eq.id && d.estado !== "baja") || null;
      return { equipo: eq, t, disp, online: !!disp && disp.estado === "online" };
    });
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
      if (Math.floor(t.horas) > eq.horometro) registrarLectura(eq.id, Math.floor(t.horas), { origen: "ESP32", dispositivo: disp.deviceId });
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
    reset, save, user, can, login, logout, restoreSession,
    usuarios: () => db.usuarios, categorias: () => db.categorias, destinos: () => db.destinos, destino, base: () => db.base, categoria,
    equipos, equipo, crearEquipo, editarEquipo, eliminarEquipo, estadoEquipo,
    lecturas, registrarLectura, resolverIncidencia,
    mantenciones, registrarMantencion,
    alertas, marcarEnGestion, quitarGestion,
    dispositivos, dispositivo, vincularDispositivo, registrarDispositivo, darDeBaja, cambiarConexion, simularLectura,
    telemetria, sincronizarTelemetria, estadoSync,
    insumos, auditoria: () => db.auditoria, fmt
  };
})();
