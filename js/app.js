/* ==========================================================================
   Vila's Motor · Prototipo — INTERFAZ (vistas, navegación y formularios)
   SPA en JavaScript puro: rutas con #hash y vistas renderizadas con plantillas.
   ========================================================================== */
(function () {
  const $ = (s, root) => (root || document).querySelector(s);
  const $$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  const fmt = Store.fmt;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fecha = f => {
    if (!f) return "—";
    const [d, t] = f.split("T"); const [y, m, dd] = d.split("-");
    return `${dd}-${m}-${y}${t ? " " + t : ""}`;
  };
  const U = u => (u === "km" ? "km" : "h");
  const num = (v, u) => `<span class="num">${fmt(v)}</span>${u ? `<span class="unit">${u}</span>` : ""}`;
  const pintarIconos = root => $$("[data-icon]", root).forEach(el => { if (!el.firstChild) el.innerHTML = icon(el.dataset.icon); });

  /* Ícono por tipo de equipo */
  const TIPOS = { "Grúa horquilla": "forklift", "Generador": "zap", "Excavadora": "excavator", "Retroexcavadora": "excavator",
    "Manipulador": "forklift", "Luminaria": "bulb", "Camión": "truck", "Camioneta": "pickup" };
  const iconoTipo = (t, s) => icon(TIPOS[t] || "cog", s);

  const status = (color, texto, extra) => `<span class="status ${color} ${extra || ""}"><i class="led"></i>${esc(texto)}</span>`;
  const segmentos = (valor, total) => {
    const on = total ? Math.round(valor / total * 20) : 0;
    return `<div class="segments">${Array.from({ length: 20 }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</div>`;
  };
  const iniciales = n => n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  /* ---------------- Toast y modal ---------------- */
  function toast(msg, tipo) {
    const t = document.createElement("div");
    t.className = "toast " + (tipo || "ok");
    t.innerHTML = icon(tipo === "err" ? "alert" : "checkCircle", 18) + `<span>${esc(msg)}</span>`;
    const cont = $("#toast");
    cont.appendChild(t);
    while (cont.children.length > 3) cont.firstChild.remove();
    setTimeout(() => t.remove(), 4000);
  }
  function modal(titulo, cuerpo, botones, onMount) {
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(titulo)}</h2><button class="close-x" data-close aria-label="Cerrar">${icon("x", 22)}</button></div>
      <div class="modal-body">${cuerpo}<div class="form-error" id="modal-error"></div></div>
      <div class="modal-foot">${botones}</div></div></div>`;
    const bg = $(".modal-bg", root);
    bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-close]")) cerrarModal(); });
    if (onMount) onMount($(".modal", root));
    const first = $("input:not([type=hidden]):not(:disabled), select, textarea", root);
    if (first) first.focus();
  }
  function cerrarModal() { $("#modal-root").innerHTML = ""; }
  function errorModal(msg) { const e = $("#modal-error"); if (e) e.textContent = msg; }
  function intentar(fn) {
    try { return fn(); }
    catch (err) { if ($("#modal-error")) errorModal(err.message); else toast(err.message, "err"); return undefined; }
  }
  const callout = (tipo, ic, html) => `<div class="callout ${tipo}">${icon(ic, 18)}<div>${html}</div></div>`;

  /* ---------------- Navegación ---------------- */
  const NAV = [
    { grupo: "Operación" },
    { ruta: "dashboard",    texto: "Panel de flota",  icono: "dashboard", permiso: "ver" },
    { ruta: "equipos",      texto: "Equipos",         icono: "truck",     permiso: "ver" },
    { ruta: "telemetria",   texto: "Telemetría y horómetros", icono: "gauge", permiso: "ver" },
    { ruta: "alertas",      texto: "Alertas",         icono: "bell",      permiso: "ver", badge: () => Store.alertas().filter(a => !a.gestion).length },
    { ruta: "mantenciones", texto: "Mantenciones",    icono: "wrench",    permiso: "ver" },
    { grupo: "Recursos" },
    { ruta: "dispositivos", texto: "Dispositivos IoT", icono: "antenna",  permiso: "verDispositivos" },
    { ruta: "insumos",      texto: "Insumos bodega",  icono: "package",   permiso: "verInsumos" },
    { grupo: "Gestión" },
    { ruta: "reportes",     texto: "Reportes",        icono: "file",      permiso: "reportes" },
    { ruta: "auditoria",    texto: "Auditoría",       icono: "shield",    permiso: "auditoria" }
  ];
  function pintarNav(rutaActual) {
    let html = "", grupo = null;
    NAV.forEach(n => {
      if (n.grupo) { grupo = n.grupo; return; }
      if (!Store.can(n.permiso)) return;
      if (grupo) { html += `<div class="nav-label">${grupo}</div>`; grupo = null; }
      const b = n.badge ? n.badge() : 0;
      html += `<a href="#/${n.ruta}" class="${rutaActual === n.ruta ? "active" : ""}">${icon(n.icono, 19)}<span>${n.texto}</span>${b ? `<span class="badge">${b}</span>` : ""}</a>`;
    });
    $("#nav").innerHTML = html;
  }

  const VISTAS = { dashboard: vDashboard, equipos: vEquipos, equipo: vEquipo, telemetria: vTelemetria, alertas: vAlertas, mantenciones: vMantenciones,
    dispositivos: vDispositivos, insumos: vInsumos, reportes: vReportes, auditoria: vAuditoria };
  const PERMISO_VISTA = { equipo: "ver" };
  const NOMBRE_RUTA = { dashboard: "Panel de flota", equipos: "Equipos", equipo: "Ficha de equipo", telemetria: "Telemetría y horómetros", alertas: "Alertas", mantenciones: "Mantenciones",
    dispositivos: "Dispositivos IoT", insumos: "Insumos", reportes: "Reportes", auditoria: "Auditoría" };

  function router() {
    if (!Store.user()) return mostrarLogin();
    const [ruta, param, origen] = (location.hash.replace(/^#\/?/, "") || "dashboard").split("/");
    const nav = NAV.find(n => n.ruta === ruta);
    const permiso = nav ? nav.permiso : PERMISO_VISTA[ruta];
    if (!VISTAS[ruta] || !Store.can(permiso)) { location.hash = "#/dashboard"; return; }
    pintarNav(ruta === "equipo" ? (origen === "telemetria" ? "telemetria" : "equipos") : ruta);
    $("#crumbs").innerHTML = `Vila's Motor &nbsp;/&nbsp; ${esc(Store.base())} &nbsp;/&nbsp; <b>${NOMBRE_RUTA[ruta]}</b>`;
    $("#content").innerHTML = VISTAS[ruta](param, origen);
    window.scrollTo(0, 0);
  }
  function refrescar() {
    const y = window.scrollY; router(); window.scrollTo(0, y);
    $$(".content > *").forEach(el => el.style.animation = "none");
  }

  /* ---------------- Login ---------------- */
  function mostrarLogin() {
    $("#app-view").classList.add("hidden");
    $("#login-view").classList.remove("hidden");
    $("#ro-equipos").textContent = String(Store.equipos().length).padStart(3, "0");
    $("#ro-destinos").textContent = String(Store.destinos().length).padStart(2, "0");
    $("#ro-iot").textContent = String(Store.dispositivos().filter(d => d.estado !== "baja").length).padStart(2, "0");
  }
  function mostrarApp() {
    const u = Store.user();
    $("#login-view").classList.add("hidden");
    $("#app-view").classList.remove("hidden");
    $("#user-name").textContent = u.nombre;
    $("#user-rol").textContent = ROLES[u.rol].nombre;
    $("#user-initials").textContent = iniciales(u.nombre);
    router();
  }
  function reloj() {
    const d = new Date();
    const el = $("#clock");
    if (el) el.textContent = d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() + " · " + d.toLocaleTimeString("es-CL", { hour12: false });
  }
  setInterval(reloj, 1000); reloj();

  $("#login-form").addEventListener("submit", e => {
    e.preventDefault();
    const u = Store.login($("#login-email").value, $("#login-pass").value);
    if (!u) { $("#login-error").textContent = "Correo o contraseña incorrectos."; return; }
    $("#login-error").textContent = "";
    $("#login-pass").value = "";
    location.hash = "#/dashboard";
    mostrarApp();
    toast(`Sesión iniciada como ${ROLES[u.rol].nombre}`);
  });
  $("#btn-logout").addEventListener("click", () => { Store.logout(); location.hash = ""; mostrarLogin(); });
  $("#btn-reset").addEventListener("click", () => {
    if (!confirmar("¿Restablecer todos los datos al estado inicial de data.js? Se perderán los cambios.")) return;
    const id = Store.user().id; Store.reset();
    const u = Store.usuarios().find(x => x.id === id); Store.login(u.email, u.password);
    toast("Datos restablecidos"); router();
  });
  function confirmar(msg) { return window.confirm(msg); }

  /* ======================================================================
     VISTAS
     ====================================================================== */
  function cabecera(num, titulo, desc, acciones) {
    return `<div class="page-head"><div><div class="eyebrow red">${num}</div><h1>${titulo}</h1>${desc ? `<p>${desc}</p>` : ""}</div>
      ${acciones ? `<div class="head-actions">${acciones}</div>` : ""}</div>`;
  }

  /* ---------------- Panel de flota ---------------- */
  function vDashboard() {
    const eqs = Store.equipos();
    const est = eqs.map(e => Store.estadoEquipo(e));
    const n = c => est.filter(x => x.color === c).length;
    const alertas = Store.alertas();
    const disp = Store.dispositivos().filter(d => d.estado !== "baja");
    const online = disp.filter(d => d.estado === "online").length;
    const enCola = disp.reduce((s, d) => s + d.cola.length, 0);
    const total = eqs.length;

    const kpi = (cls, ic, label, valor, sub) => `<div class="kpi ${cls}"><div class="k-label">${icon(ic, 14)}${label}</div>
      <div class="k-value">${String(valor).padStart(2, "0")}</div><div class="k-sub">${sub}</div>${segmentos(valor, total)}</div>`;

    const COL = { verde: "var(--green)", amarillo: "var(--amber)", rojo: "var(--red)" };
    const porCat = Store.categorias().map(c => {
      const lista = eqs.filter(e => e.categoria === c.codigo).map(e => Store.estadoEquipo(e).color);
      const tot = lista.length || 1;
      const seg = col => `<span style="width:${lista.filter(x => x === col).length / tot * 100}%;background:${COL[col]}"></span>`;
      return `<div class="cat-row"><div class="cat-top"><b><span class="tag">${c.codigo}</span>&nbsp; ${esc(c.nombre)}</b><span class="mono small muted">${String(lista.length).padStart(2, "0")} EQ</span></div>
        <div class="stackbar">${seg("verde")}${seg("amarillo")}${seg("rojo")}</div></div>`;
    }).join("");

    return `
      ${cabecera("01 — Panel de flota", "Estado de la flota", "Mantención preventiva según horómetro o kilometraje de cada equipo.",
        Store.can("registrarLectura") ? `<button class="btn btn-primary" data-action="nueva-lectura">${icon("gauge")}Registrar horómetro</button>` : "")}
      <div class="kpis">
        ${kpi("total", "truck", "Total flota", total, "equipos activos")}
        ${kpi("verde", "checkCircle", "Operativos", n("verde"), "dentro del intervalo")}
        ${kpi("amarillo", "clock", "Próximos", n("amarillo"), "en rango de aviso")}
        ${kpi("rojo", "alert", "Vencidos / críticos", n("rojo"), "requieren acción")}
      </div>
      <div class="grid-main">
        <div class="panel corner">
          <div class="panel-head"><h2>${icon("bell", 20)}Próximos vencimientos</h2><a href="#/alertas" class="btn btn-sm btn-ghost">Ver todas ${icon("arrowRight", 15)}</a></div>
          ${tablaAlertas(alertas.slice(0, 6), true)}
        </div>
        <div class="stack">
          <div class="panel panel-pad"><h2 class="panel-title">${icon("dashboard", 20)}Estado por categoría</h2>${porCat}
            <div class="legend"><span><i style="background:var(--green)"></i>Operativo</span><span><i style="background:var(--amber)"></i>Próximo</span><span><i style="background:var(--red)"></i>Vencido</span></div></div>
          <div class="panel panel-pad"><h2 class="panel-title">${icon("antenna", 20)}Telemetría IoT</h2>
            <div class="metrics">
              <div><span>En línea</span><b style="color:var(--green)">${String(online).padStart(2, "0")}</b></div>
              <div><span>Sin señal</span><b style="color:var(--red)">${String(disp.filter(d => d.estado === "offline").length).padStart(2, "0")}</b></div>
              <div><span>En cola</span><b>${String(enCola).padStart(2, "0")}</b></div></div>
            <a href="#/telemetria" class="btn btn-sm btn-ghost" style="margin-top:14px">Horómetros en faena ${icon("arrowRight", 15)}</a>
            ${Store.can("verDispositivos") ? `<a href="#/dispositivos" class="btn btn-sm btn-ghost" style="margin-top:14px">Gestionar dispositivos ${icon("arrowRight", 15)}</a>` : ""}</div>
        </div>
      </div>`;
  }

  function celdaEquipo(e) {
    return `<div class="cell-eq"><span class="eq-ico">${iconoTipo(e.tipo, 20)}</span><div><span class="code">${esc(e.codigo)}</span> <b style="display:inline">${esc(e.nombre)}</b>
      <small style="display:block">${esc(e.cliente)} · ${esc(e.destino)}</small></div></div>`;
  }

  function tablaAlertas(lista, compacta) {
    if (!lista.length) return `<div class="empty">${icon("checkCircle", 32)}Sin alertas en esta vista.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Lectura</th><th>Próxima</th><th>Restante</th><th>Estado</th><th></th></tr></thead><tbody>
      ${lista.map(a => {
        const e = a.equipo, u = U(e.unidad);
        const est = a.tipo === "inconsistente" ? status("rojo", "Lectura inconsistente", "pulse") : status(a.nivel, a.estado.texto, a.nivel === "rojo" ? "pulse" : "");
        const gestion = a.gestion ? `<div><span class="chip-gestion">${icon("check", 12)}En gestión</span></div>` : "";
        let acc = `<a class="btn btn-sm" href="#/equipo/${e.id}" title="Ver ficha">${icon("eye", 15)}Ver</a>`;
        if (!compacta) {
          if (a.tipo === "inconsistente" && Store.can("registrarLectura")) acc += `<button class="btn btn-sm btn-dark" data-action="resolver-incidencia" data-id="${a.incidencia.id}">${icon("alert", 15)}Revisar</button>`;
          if (a.tipo === "mantencion" && Store.can("gestionarAlertas")) acc += a.gestion
            ? `<button class="btn btn-sm" data-action="quitar-gestion" data-id="${e.id}">${icon("refresh", 15)}Reabrir</button>`
            : `<button class="btn btn-sm" data-action="en-gestion" data-id="${e.id}">${icon("check", 15)}En gestión</button>`;
          if (a.tipo === "mantencion" && Store.can("registrarMantencion")) acc += `<button class="btn btn-sm btn-primary" data-action="nueva-mantencion" data-id="${e.id}">${icon("wrench", 15)}Mantención</button>`;
        }
        const rest = a.tipo === "inconsistente"
          ? `<span class="small">IoT informó <span class="num"><b>${fmt(a.incidencia.valor)}</b></span> · último ${fmt(a.incidencia.anterior)}</span>`
          : `<span class="restante ${a.nivel}">${a.estado.restante <= 0 ? "+" + fmt(-a.estado.restante) : fmt(a.estado.restante)}</span><span class="unit">${u}${a.estado.restante <= 0 ? " exc." : ""}</span>`;
        return `<tr class="row-${a.nivel}"><td>${celdaEquipo(e)}</td><td>${num(e.horometro, u)}</td><td>${num(a.estado.proxima, u)}</td><td>${rest}</td><td>${est}${gestion}</td>
          <td class="actions">${acc}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  /* ---------------- Equipos (CRUD) ---------------- */
  const filtrosEq = { q: "", cat: "", dest: "", est: "" };
  /* Orden de la tabla de equipos: por defecto de inferior a superior según código */
  const ordenEq = { col: "codigo", asc: true };
  const ORDEN_ESTADO = { verde: 0, amarillo: 1, rojo: 2 };
  const claveCodigo = c => { const m = /^([A-Z]+)(\d+)$/i.exec(c) || [c, c, 0]; return [m[1].toUpperCase(), Number(m[2])]; };
  const COMPARAR_EQ = {
    codigo: (a, b) => { const x = claveCodigo(a.codigo), y = claveCodigo(b.codigo); return x[0].localeCompare(y[0]) || x[1] - y[1]; },
    categoria: (a, b) => a.categoria.localeCompare(b.categoria),
    destino: (a, b) => a.destino.localeCompare(b.destino),
    lectura: (a, b) => a.horometro - b.horometro,
    proxima: (a, b) => Store.estadoEquipo(a).restante - Store.estadoEquipo(b).restante,
    estado: (a, b) => ORDEN_ESTADO[Store.estadoEquipo(a).color] - ORDEN_ESTADO[Store.estadoEquipo(b).color]
  };
  function thOrden(col, texto) {
    const activo = ordenEq.col === col;
    return `<th class="th-sort ${activo ? "active" : ""}" data-action="ordenar-eq" data-id="${col}" title="Ordenar">${texto}<span class="sort-arrow">${activo ? (ordenEq.asc ? "▲" : "▼") : "↕"}</span></th>`;
  }
  function vEquipos() {
    const lista = Store.equipos().filter(e => {
      const est = Store.estadoEquipo(e).color;
      const q = filtrosEq.q.toLowerCase();
      return (!q || (e.codigo + " " + e.nombre + " " + e.cliente + " " + e.marca + " " + e.modelo).toLowerCase().includes(q))
        && (!filtrosEq.cat || e.categoria === filtrosEq.cat) && (!filtrosEq.dest || e.destino === filtrosEq.dest) && (!filtrosEq.est || est === filtrosEq.est);
    }).sort((a, b) => { const r = COMPARAR_EQ[ordenEq.col](a, b) || COMPARAR_EQ.codigo(a, b); return ordenEq.asc ? r : -r; });
    const opt = (arr, val) => arr.map(o => `<option value="${esc(o.v)}" ${o.v === val ? "selected" : ""}>${esc(o.t)}</option>`).join("");
    return `
      ${cabecera("02 — Flota", "Equipos", `${Store.equipos().length} equipos activos de la base ${esc(Store.base())}, distribuidos en ${new Set(Store.equipos().map(e => e.destino)).size} destinos.`,
        Store.can("crudEquipos") ? `<button class="btn btn-primary" data-action="nuevo-equipo">${icon("plus")}Nuevo equipo</button>` : "")}
      <div class="panel">
        <div class="panel-head"><div class="filters">
          <div class="input-icon"><span class="i">${icon("search", 16)}</span><input id="f-q" placeholder="Código, nombre, cliente…" value="${esc(filtrosEq.q)}"></div>
          <select id="f-cat">${opt([{ v: "", t: "Todas las categorías" }].concat(Store.categorias().map(c => ({ v: c.codigo, t: c.codigo + " · " + c.nombre }))), filtrosEq.cat)}</select>
          <select id="f-dest">${opt([{ v: "", t: "Todos los destinos" }].concat(Store.destinos().map(d => ({ v: d.nombre, t: d.nombre + " · " + d.tipo }))), filtrosEq.dest)}</select>
          <select id="f-est">${opt([{ v: "", t: "Todos los estados" }, { v: "verde", t: "Operativo" }, { v: "amarillo", t: "Próximo" }, { v: "rojo", t: "Vencido / crítico" }], filtrosEq.est)}</select>
        </div><span class="mono small muted">${String(lista.length).padStart(2, "0")} RESULTADOS</span></div>
        <div class="table-wrap"><table><thead><tr>${thOrden("codigo", "Equipo")}${thOrden("categoria", "Cat.")}${thOrden("destino", "Destino")}${thOrden("lectura", "Lectura actual")}${thOrden("proxima", "Próxima")}${thOrden("estado", "Estado")}<th></th></tr></thead><tbody>
        ${lista.length ? lista.map(e => {
          const s = Store.estadoEquipo(e), u = U(e.unidad);
          return `<tr class="row-${s.color}"><td><div class="cell-eq"><span class="eq-ico">${iconoTipo(e.tipo, 20)}</span><div><span class="code">${esc(e.codigo)}</span> <b style="display:inline">${esc(e.nombre)}</b>
              <small style="display:block">${esc(e.marca)} ${esc(e.modelo)}${e.patente && e.patente !== "—" ? " · " + esc(e.patente) : ""}</small></div></div></td>
            <td><span class="tag">${esc(e.categoria)}</span></td>
            <td>${esc(e.destino)}<div class="small muted">${esc(e.cliente)}</div></td>
            <td>${num(e.horometro, u)}</td><td>${num(s.proxima, u)}</td><td>${status(s.color, s.texto)}</td>
            <td class="actions"><a class="btn btn-sm" href="#/equipo/${e.id}" title="Ver ficha">${icon("eye", 15)}</a>
              ${Store.can("crudEquipos") ? `<button class="btn btn-sm" data-action="editar-equipo" data-id="${e.id}" title="Editar">${icon("edit", 15)}</button>
              <button class="btn btn-sm btn-danger" data-action="eliminar-equipo" data-id="${e.id}" title="Dar de baja">${icon("trash", 15)}</button>` : ""}</td></tr>`;
        }).join("") : `<tr><td colspan="7"><div class="empty">${icon("search", 28)}No hay equipos que coincidan con los filtros.</div></td></tr>`}
        </tbody></table></div>
      </div>`;
  }

  function formEquipo(e) {
    e = e || { codigo: "", nombre: "", tipo: "Grúa horquilla", categoria: "VR", marca: "", modelo: "", patente: "", destino: "Base Iquique", cliente: "", horometro: 0, unidad: "h", intervalo: 250, ultimaMantencion: 0 };
    const sel = (arr, v) => arr.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("");
    return `<div class="form-grid">
      <div><label>Código *</label><input name="codigo" value="${esc(e.codigo)}" placeholder="Ej: VG15"></div>
      <div><label>Categoría *</label><select name="categoria">${Store.categorias().map(c => `<option value="${c.codigo}" ${c.codigo === e.categoria ? "selected" : ""}>${c.codigo} · ${esc(c.nombre)}</option>`).join("")}</select></div>
      <div class="full"><label>Nombre *</label><input name="nombre" value="${esc(e.nombre)}" placeholder="Ej: Generador JCB G45QX"></div>
      <div><label>Tipo</label><select name="tipo">${sel(Object.keys(TIPOS), e.tipo)}</select></div>
      <div><label>Marca</label><input name="marca" value="${esc(e.marca)}"></div>
      <div><label>Modelo</label><input name="modelo" value="${esc(e.modelo)}"></div>
      <div><label>Patente / serie</label><input name="patente" value="${esc(e.patente)}"></div>
      <div><label>Destino</label><select name="destino">${Store.destinos().map(d => `<option value="${esc(d.nombre)}" ${d.nombre === e.destino ? "selected" : ""}>${esc(d.nombre)} · ${esc(d.tipo)}</option>`).join("")}</select></div>
      <div><label>Cliente actual</label><input name="cliente" value="${esc(e.cliente)}"></div>
      <div><label>Unidad de medida</label><select name="unidad"><option value="h" ${e.unidad === "h" ? "selected" : ""}>Horas (horómetro)</option><option value="km" ${e.unidad === "km" ? "selected" : ""}>Kilómetros (odómetro)</option></select></div>
      <div><label>Intervalo de mantención *</label><input name="intervalo" type="number" min="1" value="${e.intervalo}"></div>
      <div><label>Lectura actual</label><input name="horometro" type="number" min="0" value="${e.horometro}" ${e.id ? "disabled" : ""}></div>
      <div><label>Lectura en última mantención</label><input name="ultimaMantencion" type="number" min="0" value="${e.ultimaMantencion}" ${e.id ? "disabled" : ""}></div>
    </div>${e.id ? callout("info", "lock", "La lectura y la última mantención solo cambian con lecturas y mantenciones registradas, para mantener la trazabilidad.") : ""}`;
  }
  function leerForm(root) {
    const d = {};
    $$("[name]", root).forEach(i => { if (!i.disabled) d[i.name] = i.type === "number" ? Number(i.value) : i.value.trim(); });
    return d;
  }

  /* ---------------- Ficha de equipo ---------------- */
  function odometro(valor) {
    const digitos = String(Math.max(0, Math.round(valor))).padStart(valor >= 100000 ? 6 : 5, "0").split("");
    let lead = true;
    return digitos.map((d, i) => {
      if (d !== "0" || i === digitos.length - 1) lead = false;
      return `<span class="d ${lead ? "dim" : ""} ${i === digitos.length - 1 ? "last" : ""}">${d}</span>`;
    }).join("");
  }
  function vEquipo(id, origen) {
    const e = Store.equipo(id);
    if (!e) return `<div class="panel empty">Equipo no encontrado. <a href="#/equipos">Volver</a></div>`;
    const s = Store.estadoEquipo(e), u = U(e.unidad);
    const disp = Store.dispositivos().find(d => d.equipoId === e.id && d.estado !== "baja");
    const mants = Store.mantenciones(e.id), lects = Store.lecturas(e.id);
    const tele = Store.telemetria().find(x => x.equipo.id === e.id);
    const barColor = { verde: "var(--green)", amarillo: "var(--amber)", rojo: "var(--red)" }[s.color];
    const acciones = `${Store.can("registrarLectura") ? `<button class="btn" data-action="nueva-lectura" data-id="${e.id}">${icon("gauge")}Registrar lectura</button>` : ""}
      ${Store.can("registrarMantencion") ? `<button class="btn btn-primary" data-action="nueva-mantencion" data-id="${e.id}">${icon("wrench")}Registrar mantención</button>` : ""}
      ${Store.can("reportes") ? `<a class="btn" href="#/reportes/${e.id}">${icon("file")}Reporte</a>` : ""}
      ${Store.telemetria().some(x => x.equipo.id === e.id) ? botonSync() : ""}`;
    return `
      <div class="page-head"><div>${origen === "telemetria" ? `<a href="#/telemetria" class="eyebrow red" style="text-decoration:none">${icon("arrowLeft", 14)} Volver a telemetría</a>` : `<a href="#/equipos" class="eyebrow red" style="text-decoration:none">${icon("arrowLeft", 14)} Volver a equipos</a>`}<h1>Ficha de equipo</h1></div><div class="head-actions">${acciones}</div></div>
      <div class="ficha">
        <div class="panel panel-pad corner">
          <div class="ficha-top"><div class="ficha-ico">${iconoTipo(e.tipo, 40)}</div>
            <div><span class="code">${esc(e.codigo)}</span>&nbsp; ${status(s.color, s.texto, s.color === "rojo" ? "pulse" : "")}
              <h2>${esc(e.nombre)}</h2><div class="muted">${esc(e.marca)} ${esc(e.modelo)} · ${esc(Store.categoria(e.categoria).nombre)}</div></div></div>
          <div class="spec">
            <div><span>Destino</span><b>${esc(e.destino)}</b></div>
            <div><span>Tipo de destino</span><b>${esc(Store.destino(e.destino).tipo)}</b></div>
            <div><span>Cliente actual</span><b>${esc(e.cliente)}</b></div>
            <div><span>Patente / serie</span><b class="mono">${esc(e.patente || "—")}</b></div>
            <div><span>Intervalo</span><b>cada ${fmt(e.intervalo)} ${u}</b></div>
            <div><span>Aviso anticipado</span><b>${fmt(e.aviso)} ${u} antes</b></div>
            <div><span>Ubicación GPS</span><b class="mono">${e.lat != null ? e.lat.toFixed(2) + ", " + e.lng.toFixed(2) : "—"}</b></div>
            <div><span>Dispositivo IoT</span><b>${disp ? `<span class="mono">${esc(disp.deviceId)}</span>` : "Sin dispositivo"}</b>
              ${disp ? `<div style="margin-top:3px">${status(disp.estado === "online" ? "verde" : "rojo", disp.estado === "online" ? "En línea" : "Sin señal")}</div>` : ""}</div>
          </div>
        </div>
        <div class="panel panel-pad meter">
          <div class="eyebrow">${icon("gauge", 14)} ${e.unidad === "km" ? "Odómetro" : "Horómetro"} actual</div>
          <div class="odo">${odometro(e.horometro)}<span class="u">${u}</span></div>
          ${tele ? `<div class="sub" style="margin-bottom:4px">Telemetría: <b class="mono" style="color:#fff">${fmtDec(tele.t.horas)} ${u}</b> · ${tele.online ? (tele.t.enUso ? "motor encendido" : "detenida") : "sin señal"}</div>` : ""}
          <div class="sub">Última lectura ${lects[0] ? fecha(lects[0].fecha) + " · " + (lects[0].origen === "ESP32" ? "automática (ESP32)" : "manual") : "—"}</div>
          <div style="display:flex;justify-content:space-between;margin-top:18px" class="mono small"><span style="color:#9a968f">CICLO ACTUAL</span><span>${fmt(e.horometro - e.ultimaMantencion)} / ${fmt(e.intervalo)} ${u}</span></div>
          <div class="bar ticks"><span style="width:${s.progreso}%;background:${barColor}"></span></div>
          <div class="meter-grid">
            <div><span>Última mant.</span><b>${fmt(e.ultimaMantencion)}</b></div>
            <div><span>Próxima</span><b>${fmt(s.proxima)}</b></div>
            <div><span>Restante</span><b class="${s.restante <= 0 ? "rojo" : ""}">${s.restante <= 0 ? "+" + fmt(-s.restante) + " exc." : fmt(s.restante)}</b></div>
          </div>
        </div>
      </div>
      ${panelMapa(e, tele)}
      <div class="grid-eq" style="margin-top:20px">
        <div class="panel"><div class="panel-head"><h2>${icon("history", 20)}Historial de mantenciones</h2><span class="mono small muted">${String(mants.length).padStart(2, "0")} REGISTROS</span></div>
          ${tablaMantenciones(mants, false)}</div>
        <div class="panel"><div class="panel-head"><h2>${icon("gauge", 20)}Lecturas</h2><span class="mono small muted">MANUAL + IoT</span></div>
          <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Valor</th><th>Origen</th><th>Registró</th></tr></thead><tbody>
          ${lects.length ? lects.map(l => `<tr><td class="mono small">${fecha(l.fecha)}</td><td>${num(l.valor, u)}${l.esCorreccion ? `<div class="small" style="color:var(--amber-text)">Corrección (antes ${fmt(l.valorAnterior)}): ${esc(l.motivo)}</div>` : ""}</td>
            <td>${l.origen === "ESP32" ? `<span class="src esp">${icon("antenna", 12)}ESP32</span>` : `<span class="src manual">${icon("user", 12)}Manual</span>`}</td><td>${esc(l.usuario)}</td></tr>`).join("")
            : `<tr><td colspan="4"><div class="empty">Sin lecturas registradas.</div></td></tr>`}
          </tbody></table></div></div>
      </div>`;
  }

  function tablaMantenciones(lista, conEquipo) {
    if (!lista.length) return `<div class="empty">${icon("wrench", 28)}Sin mantenciones registradas.</div>`;
    return `<div class="table-wrap"><table><thead><tr>${conEquipo ? "<th>Equipo</th>" : ""}<th>Fecha</th><th>OT</th><th>Tipo</th><th>Lectura</th><th>Insumos</th></tr></thead><tbody>
      ${lista.map(m => {
        const e = Store.equipo(m.equipoId);
        return `<tr>${conEquipo ? `<td><a href="#/equipo/${e.id}" class="cell-eq" style="min-width:0;color:inherit"><span class="code">${esc(e.codigo)}</span><span>${esc(e.nombre)}</span></a></td>` : ""}
          <td class="mono small">${fecha(m.fecha)}</td><td class="mono small">${esc(m.ot)}</td><td><b>${esc(m.tipo)}</b></td><td>${num(m.valor, U(e.unidad))}</td>
          <td class="small">${m.insumos.length ? m.insumos.map(i => `<span class="num">${esc(i.cantidad)}</span> ${esc(i.unidad)} · ${esc(i.nombre)}`).join("<br>") : '<span class="muted">—</span>'}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  /* ---------------- Mapa de última ubicación ---------------- */
  function panelMapa(e, tele) {
    if (e.lat == null) return "";
    const d = .03, bbox = [e.lng - d, e.lat - d, e.lng + d, e.lat + d].join(",");
    const fuente = !tele ? "Coordenadas del destino"
      : tele.online ? "GPS del " + tele.disp.deviceId
      : tele.disp ? "Último GPS conocido (" + tele.disp.deviceId + " sin señal)" : "Coordenadas del destino (sin dispositivo)";
    const registrada = e.ultimaUbicacion || (tele && tele.disp && tele.disp.ultimaConexion);
    return `<div class="panel" style="margin-top:20px">
      <div class="panel-head"><h2>${icon("pin", 20)}Última ubicación</h2><span class="mono small muted">${esc(e.destino).toUpperCase()} · ${esc(Store.destino(e.destino).tipo).toUpperCase()}</span></div>
      <div class="mapa-grid">
        <div class="mapa"><div class="mapa-off">${icon("pin", 28)}<span>El mapa necesita conexión a internet.</span></div>
          <iframe title="Mapa de ${esc(e.codigo)}" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${e.lat},${e.lng}"></iframe></div>
        <div class="mapa-info">
          <div><span>Coordenadas</span><b class="mono">${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}</b></div>
          <div><span>Registrada</span><b class="mono">${registrada ? fecha(registrada) : "—"}</b></div>
          <div><span>Fuente</span><b>${esc(fuente)}</b></div>
          <a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${e.lat},${e.lng}">${icon("arrowRight", 15)}Abrir en Google Maps</a>
        </div>
      </div></div>`;
  }

  /* ---------------- Telemetría y horómetros (faenas mineras) ---------------- */
  const fmtDec = v => Number(v).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const mmss = ms => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
  function botonSync() {
    const s = Store.estadoSync();
    return `<button class="btn btn-primary" data-action="sync-telemetria" data-sync-btn ${s.cooldown ? "disabled" : ""}>${icon("refresh")}<span data-sync-label>${s.cooldown ? "Disponible en " + mmss(s.cooldown) : "Sincronizar horómetros"}</span></button>`;
  }
  function vTelemetria() {
    const lista = Store.telemetria();
    const s = Store.estadoSync();
    const enUso = lista.filter(x => x.online && x.t.enUso).length;
    const sinSenal = lista.filter(x => !x.online).length;
    const kpi = (cls, ic, label, valor, sub) => `<div class="kpi ${cls}"><div class="k-label">${icon(ic, 14)}${label}</div>
      <div class="k-value">${String(valor).padStart(2, "0")}</div><div class="k-sub">${sub}</div>${segmentos(valor, lista.length)}</div>`;
    return `
      ${cabecera("03 — Faenas mineras", "Telemetría y horómetros", "Equipos en destinos mineros, en uso o detenidos. Los horómetros se actualizan solos cada 5 minutos desde cada ESP32; la sincronización manual queda disponible de nuevo tras 2 minutos.", botonSync())}
      <div class="kpis">
        ${kpi("total", "truck", "En faenas mineras", lista.length, "equipos")}
        ${kpi("verde", "play", "En uso", enUso, "motor encendido")}
        ${kpi("amarillo", "power", "Detenidos", lista.length - enUso - sinSenal, "con señal, sin uso")}
        ${kpi("rojo", "wifiOff", "Sin señal", sinSenal, "muestra el último valor")}
      </div>
      <div class="panel corner">
        <div class="panel-head"><h2>${icon("gauge", 20)}Horómetros en faena</h2>
          <span class="mono small muted">ÚLTIMA SYNC ${s.ultima ? new Date(s.ultima).toLocaleTimeString("es-CL", { hour12: false }) : "—"} · PRÓXIMA AUTOMÁTICA EN <b data-sync-auto>${mmss(s.proximaAuto)}</b></span></div>
        <div class="table-wrap"><table><thead><tr><th>Equipo</th><th>Destino</th><th>Horómetro</th><th>Uso</th><th>Dispositivo</th><th>Última ubicación</th><th></th></tr></thead><tbody>
        ${lista.length ? lista.map(({ equipo: e, t, disp, online }) => {
          const u = U(e.unidad);
          const uso = !online ? status("rojo", "Sin señal") : t.enUso ? status("verde", "En uso", "pulse") : status("gris", "Detenida");
          return `<tr><td>${celdaEquipo(e)}</td>
            <td>${esc(e.destino)}<div class="small muted">${esc(e.cliente)}</div></td>
            <td><span class="num"><b>${fmtDec(t.horas)}</b></span><span class="unit">${u}</span>${online && t.enUso && t.delta ? `<div class="small" style="color:var(--green)">+${fmtDec(t.delta)} ${u} desde la sync anterior</div>` : ""}</td>
            <td>${uso}</td>
            <td>${disp ? `<span class="mono small">${esc(disp.deviceId)}</span><div class="small muted">${disp.ultimaConexion ? fecha(disp.ultimaConexion) : "—"}</div>` : '<span class="muted">Sin dispositivo</span>'}</td>
            <td class="mono small">${e.lat != null ? e.lat.toFixed(3) + ", " + e.lng.toFixed(3) : "—"}</td>
            <td class="actions"><a class="btn btn-sm" href="#/equipo/${e.id}/telemetria">${icon("eye", 15)}Abrir</a></td></tr>`;
        }).join("") : `<tr><td colspan="7"><div class="empty">${icon("truck", 28)}No hay equipos en destinos mineros.</div></td></tr>`}
        </tbody></table></div>
      </div>`;
  }
  function sincronizar(manual) {
    const r = intentar(() => Store.sincronizarTelemetria(manual));
    if (!r) return;
    if (manual) toast(`Horómetros sincronizados · ${r.actualizados} equipo(s) en uso actualizados`);
    const ruta = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (ruta === "telemetria" || ruta === "equipo") refrescar();
  }
  /* Reloj de telemetría: lanza la sincronización automática y actualiza los contadores */
  setInterval(() => {
    if (!Store.user()) return;
    const s = Store.estadoSync();
    if (s.tocaAuto) return sincronizar(false);
    $$("[data-sync-auto]").forEach(el => el.textContent = mmss(s.proximaAuto));
    $$("[data-sync-btn]").forEach(b => {
      b.disabled = s.cooldown > 0;
      const l = $("[data-sync-label]", b);
      if (l) l.textContent = s.cooldown ? "Disponible en " + mmss(s.cooldown) : "Sincronizar horómetros";
    });
  }, 1000);

  /* ---------------- Alertas ---------------- */
  let filtroAlerta = "todas";
  function vAlertas() {
    const todas = Store.alertas();
    const f = {
      todas, rojo: todas.filter(a => a.nivel === "rojo"), amarillo: todas.filter(a => a.nivel === "amarillo"),
      gestion: todas.filter(a => a.gestion), inconsistente: todas.filter(a => a.tipo === "inconsistente")
    };
    const chip = (k, t) => `<button class="chip ${filtroAlerta === k ? "active" : ""}" data-action="filtro-alerta" data-id="${k}">${t}<span class="n">${f[k].length}</span></button>`;
    return `
      ${cabecera("04 — Alertas", "Alertas del sistema", "Se generan solas al comparar cada lectura con el umbral del equipo: 50 h maquinaria · 300 km camionetas · 1.000 km transporte.")}
      <div class="panel corner">
        <div class="panel-head"><div class="chips">${chip("todas", "Todas")}${chip("rojo", "Vencidas")}${chip("amarillo", "Próximas")}${chip("gestion", "En gestión")}${chip("inconsistente", "Inconsistentes")}</div></div>
        ${tablaAlertas(f[filtroAlerta], false)}
      </div>`;
  }

  /* ---------------- Mantenciones ---------------- */
  const filtrosMant = { eq: "", tipo: "", desde: "", hasta: "" };
  function vMantenciones() {
    const lista = Store.mantenciones().filter(m => {
      const e = Store.equipo(m.equipoId);
      return (!filtrosMant.eq || String(e.id) === filtrosMant.eq) && (!filtrosMant.tipo || m.tipo.toLowerCase().includes(filtrosMant.tipo.toLowerCase()))
        && (!filtrosMant.desde || m.fecha >= filtrosMant.desde) && (!filtrosMant.hasta || m.fecha <= filtrosMant.hasta);
    });
    return `
      ${cabecera("05 — Historial", "Mantenciones", "Registro centralizado de todas las intervenciones de la flota.",
        Store.can("registrarMantencion") ? `<button class="btn btn-primary" data-action="nueva-mantencion">${icon("plus")}Registrar mantención</button>` : "")}
      <div class="panel"><div class="panel-head"><div class="filters">
        <select id="fm-eq"><option value="">Todos los equipos</option>${Store.equipos().map(e => `<option value="${e.id}" ${String(e.id) === filtrosMant.eq ? "selected" : ""}>${esc(e.codigo)} · ${esc(e.nombre)}</option>`).join("")}</select>
        <div class="input-icon"><span class="i">${icon("search", 16)}</span><input id="fm-tipo" placeholder="Tipo (ej: 500 h)" value="${esc(filtrosMant.tipo)}" style="width:190px"></div>
        <input id="fm-desde" type="date" value="${filtrosMant.desde}" style="width:auto;height:40px" title="Desde">
        <input id="fm-hasta" type="date" value="${filtrosMant.hasta}" style="width:auto;height:40px" title="Hasta">
      </div><span class="mono small muted">${String(lista.length).padStart(2, "0")} REGISTROS</span></div>
      ${tablaMantenciones(lista, true)}</div>`;
  }

  /* ---------------- Dispositivos IoT ---------------- */
  let ultimoPayload = null;
  function jsonColor(o) {
    return esc(JSON.stringify(o, null, 2))
      .replace(/&quot;(\w+)&quot;:/g, '<span class="k">"$1"</span>:')
      .replace(/: &quot;([^&]*)&quot;/g, ': <span class="s">"$1"</span>')
      .replace(/: (-?[\d.]+)/g, ': <span class="n">$1</span>');
  }
  function vDispositivos() {
    const gest = Store.can("gestionarDispositivos");
    const disp = Store.dispositivos();
    const st = d => ({ online: status("verde", "En línea", "pulse"), offline: status("rojo", "Sin señal"), "sin vincular": status("gris", "Sin vincular"), baja: status("gris", "De baja") })[d.estado];
    return `
      ${cabecera("06 — IoT", "Dispositivos IoT", "Cada ESP32 mide las horas de motor encendido y las envía por HTTP. Sin señal, guarda las lecturas en cola y las despacha al reconectar.",
        gest ? `<button class="btn btn-primary" data-action="nuevo-dispositivo">${icon("plus")}Registrar dispositivo</button>` : "")}
      <div class="panel"><div class="table-wrap"><table><thead><tr><th>Dispositivo</th><th>Equipo vinculado</th><th>Estado</th><th>Última conexión</th><th>Cola</th>${gest ? "<th>Simulación / acciones</th>" : ""}</tr></thead><tbody>
      ${disp.map(d => {
        const e = d.equipoId ? Store.equipo(d.equipoId) : null;
        const activo = d.estado !== "baja";
        return `<tr style="${activo ? "" : "opacity:.5"}"><td><div class="cell-eq" style="min-width:170px"><span class="eq-ico">${icon("cpu", 20)}</span><div><b class="mono">${esc(d.deviceId)}</b><small>${esc(d.tipo)}</small></div></div></td>
          <td>${e ? `<a href="#/equipo/${e.id}" style="color:inherit"><span class="code">${esc(e.codigo)}</span> ${esc(e.nombre)}</a><div class="small muted">${num(e.horometro, U(e.unidad))}</div>` : '<span class="muted">—</span>'}</td>
          <td>${st(d)}</td><td class="mono small">${fecha(d.ultimaConexion)}</td>
          <td>${d.cola.length ? `<span class="status amarillo">${icon("database", 14)}${d.cola.length} pend.</span>` : '<span class="mono muted">0</span>'}</td>
          ${gest ? `<td class="actions" style="text-align:left">${activo ? `
            ${d.equipoId ? `<button class="btn btn-sm btn-primary" data-action="simular" data-id="${d.id}">${icon("play", 14)}Lectura</button>
              <button class="btn btn-sm" data-action="simular-reinicio" data-id="${d.id}" title="Simular reinicio del horómetro (ej: de 2.000 a 3 h)" aria-label="Simular reinicio">${icon("alert", 14)}</button>
              ${d.estado === "online" ? `<button class="btn btn-sm" data-action="desconectar" data-id="${d.id}">${icon("wifiOff", 14)}Sin señal</button>`
                : `<button class="btn btn-sm btn-dark" data-action="reconectar" data-id="${d.id}">${icon("wifi", 14)}Reconectar</button>`}` : ""}
            <button class="btn btn-sm" data-action="vincular" data-id="${d.id}" title="Vincular a un equipo">${icon("link", 14)}</button>
            <button class="btn btn-sm btn-danger" data-action="baja-dispositivo" data-id="${d.id}" title="Dar de baja">${icon("power", 14)}</button>` : ""}</td>` : ""}</tr>`;
      }).join("")}</tbody></table></div></div>
      <div class="panel panel-pad" style="margin-top:20px">
        <div class="console-head"><h2 class="panel-title" style="margin:0">${icon("send", 20)}Último paquete recibido</h2><span class="mono small muted">POST /api/telemetria · JSON</span></div>
        <pre class="console">${ultimoPayload ? jsonColor(ultimoPayload) : "// Usa «Lectura» en un dispositivo para ver el JSON que envía el ESP32"}</pre></div>`;
  }

  /* ---------------- Insumos ---------------- */
  function vInsumos() {
    const lista = Store.insumos();
    const max = Math.max.apply(null, lista.map(i => i.stock));
    return `
      ${cabecera("07 — Bodega", "Stock de insumos", "Consulta de solo lectura al sistema de bodega (simulación de Softland). Planificación no modifica el stock.")}
      <div class="panel"><div class="table-wrap"><table><thead><tr><th>Código</th><th>Insumo</th><th style="width:30%">Stock</th><th>Estado</th></tr></thead><tbody>
      ${lista.map(i => {
        const c = i.stock === 0 ? "rojo" : i.stock <= 2 ? "amarillo" : "verde";
        return `<tr class="row-${c === "verde" ? "" : c}"><td class="mono small">${esc(i.codigo)}</td><td><b>${esc(i.nombre)}</b></td>
          <td><div style="display:flex;align-items:center;gap:10px">${num(i.stock, i.unidad)}<div class="bar" style="flex:1"><span style="width:${i.stock / max * 100}%;background:var(--ink)"></span></div></div></td>
          <td>${status(c, c === "rojo" ? "Sin stock" : c === "amarillo" ? "Stock bajo" : "Disponible")}</td></tr>`;
      }).join("")}
      </tbody></table></div></div>`;
  }

  /* ---------------- Reportes ---------------- */
  function vReportes(id) {
    const e = id ? Store.equipo(id) : null;
    const selector = `<div class="panel panel-pad no-print" style="margin-bottom:20px;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
      <div style="flex:1;min-width:240px"><label style="margin-top:0">Equipo</label><select id="rep-eq"><option value="">Selecciona un equipo…</option>
        ${Store.equipos().map(x => `<option value="${x.id}" ${e && x.id === e.id ? "selected" : ""}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join("")}</select></div>
      ${e ? `<button class="btn btn-primary" data-action="imprimir">${icon("download")}Exportar PDF</button>` : ""}</div>`;
    const head = `<div class="no-print">${cabecera("08 — Documentos", "Reportes por equipo", "Respaldo documentado del historial. «Exportar PDF» abre la impresión: elige «Guardar como PDF».")}</div>`;
    if (!e) return head + selector;
    const s = Store.estadoEquipo(e), u = U(e.unidad);
    const mants = Store.mantenciones(e.id);
    return `${head}${selector}
      <div class="sheet">
        <div class="sheet-head"><div style="display:flex;gap:12px;align-items:center"><div class="logo-mark sm">VM</div><div><div class="brand-name">Vila's Motor</div><div class="mono small muted">REPORTE DE MANTENCIONES POR EQUIPO</div></div></div>
          <div class="mono small" style="text-align:right">GENERADO ${new Date().toLocaleString("es-CL")}<br>POR ${esc(Store.user().nombre).toUpperCase()}</div></div>
        <span class="code">${esc(e.codigo)}</span><h2 style="margin-top:8px">${esc(e.nombre)}</h2>
        <div class="spec">
          <div><span>Marca / modelo</span><b>${esc(e.marca)} ${esc(e.modelo)}</b></div>
          <div><span>Destino</span><b>${esc(e.destino)}</b></div><div><span>Cliente</span><b>${esc(e.cliente)}</b></div>
          <div><span>Patente / serie</span><b class="mono">${esc(e.patente || "—")}</b></div>
          <div><span>Lectura actual</span><b class="mono">${fmt(e.horometro)} ${u}</b></div>
          <div><span>Próxima mantención</span><b class="mono">${fmt(s.proxima)} ${u}</b></div><div><span>Intervalo</span><b>cada ${fmt(e.intervalo)} ${u}</b></div>
          <div><span>Estado</span>${status(s.color, s.texto)}</div>
        </div>
        <h3>Historial de mantenciones (${mants.length})</h3>
        ${tablaMantenciones(mants, false)}
      </div>`;
  }

  /* ---------------- Auditoría ---------------- */
  let filtroAud = "";
  function vAuditoria() {
    const lista = Store.auditoria().filter(a => !filtroAud || (a.usuario + a.accion + a.detalle).toLowerCase().includes(filtroAud.toLowerCase()));
    return `
      ${cabecera("09 — Trazabilidad", "Auditoría", "Quién hizo cada cambio y cuándo. Las correcciones guardan el valor anterior.")}
      <div class="panel"><div class="panel-head"><div class="filters"><div class="input-icon"><span class="i">${icon("search", 16)}</span><input id="f-aud" placeholder="Usuario, acción o equipo…" value="${esc(filtroAud)}"></div></div>
        <span class="mono small muted">${String(lista.length).padStart(2, "0")} EVENTOS</span></div>
      <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>
      ${lista.map(a => `<tr><td class="mono small" style="white-space:nowrap">${fecha(a.fecha)}</td><td style="white-space:nowrap">${esc(a.usuario)}</td><td><b>${esc(a.accion)}</b></td><td>${esc(a.detalle)}</td></tr>`).join("")}
      </tbody></table></div></div>`;
  }

  /* ======================================================================
     FORMULARIOS (modales)
     ====================================================================== */
  function modalLectura(equipoId) {
    const opciones = Store.equipos().map(e => `<option value="${e.id}" ${e.id === Number(equipoId) ? "selected" : ""}>${esc(e.codigo)} · ${esc(e.nombre)} (${fmt(e.horometro)} ${U(e.unidad)})</option>`).join("");
    modal("Registrar lectura",
      `<label>Equipo</label><select id="ml-eq">${opciones}</select>
       <label>Nueva lectura (horómetro / km)</label><input id="ml-valor" type="number" min="0" placeholder="Ej: 3420">
       <div id="ml-info" class="mono small muted" style="margin-top:8px"></div>
       <div id="ml-motivo-wrap" class="hidden">${callout("warn", "alert", "El valor es <b>menor</b> al último registrado. Solo se acepta como <b>corrección</b> con motivo, y queda en la auditoría.")}
         <label>Motivo de la corrección *</label><textarea id="ml-motivo" placeholder="Ej: horómetro reemplazado por falla, dato mal ingresado…"></textarea></div>`,
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="ml-guardar">${icon("check")}Guardar lectura</button>`,
      () => {
        const info = () => { const e = Store.equipo($("#ml-eq").value); $("#ml-info").textContent = `ÚLTIMA: ${fmt(e.horometro)} ${U(e.unidad)} · PRÓXIMA MANTENCIÓN: ${fmt(Store.estadoEquipo(e).proxima)} ${U(e.unidad)}`; };
        info(); $("#ml-eq").addEventListener("change", info);
        $("#ml-valor").addEventListener("input", () => {
          const e = Store.equipo($("#ml-eq").value);
          $("#ml-motivo-wrap").classList.toggle("hidden", !($("#ml-valor").value !== "" && Number($("#ml-valor").value) < e.horometro));
        });
        $("#ml-guardar").addEventListener("click", () => intentar(() => {
          if ($("#ml-valor").value === "") throw new Error("Ingresa el valor de la lectura.");
          const r = Store.registrarLectura($("#ml-eq").value, $("#ml-valor").value, { origen: "manual", motivo: $("#ml-motivo").value.trim() });
          if (r.requiereMotivo) { $("#ml-motivo-wrap").classList.remove("hidden"); throw new Error("Indica el motivo de la corrección."); }
          cerrarModal();
          toast(r.estado.color === "verde" ? "Lectura registrada" : `Lectura registrada · ${r.estado.texto}`, r.estado.color === "verde" ? "ok" : "err");
          refrescar();
        }));
      });
  }

  function modalMantencion(equipoId) {
    const eqs = Store.equipos();
    const d0 = new Date(); const hoy = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, "0")}-${String(d0.getDate()).padStart(2, "0")}`;
    const filas = [];
    modal("Registrar mantención",
      `<div class="form-grid">
        <div class="full"><label>Equipo *</label><select id="mm-eq">${eqs.map(e => `<option value="${e.id}" ${e.id === Number(equipoId) ? "selected" : ""}>${esc(e.codigo)} · ${esc(e.nombre)}</option>`).join("")}</select></div>
        <div><label>Fecha *</label><input id="mm-fecha" type="date" value="${hoy}"></div>
        <div><label>N° OT</label><input id="mm-ot" placeholder="Opcional"></div>
        <div><label>Tipo de mantención *</label><select id="mm-tipo"></select></div>
        <div><label>Lectura al momento *</label><input id="mm-valor" type="number" min="0"></div>
        <div class="full"><label>Responsable / taller</label><input id="mm-resp" placeholder="Ej: Taller Iquique"></div>
      </div>
      <label>Insumos utilizados · stock de bodega (solo lectura)</label>
      <div style="display:flex;gap:8px"><select id="mm-ins">${Store.insumos().map(i => `<option value="${i.codigo}">${esc(i.nombre)} — stock ${i.stock} ${i.unidad}</option>`).join("")}</select>
        <input id="mm-cant" type="number" min="1" value="1" style="width:84px"><button class="btn btn-dark" id="mm-add" type="button">${icon("plus", 15)}</button></div>
      <div id="mm-lista" style="margin-top:10px"></div>`,
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="mm-guardar">${icon("check")}Guardar mantención</button>`,
      () => {
        const actualizarEq = () => {
          const e = Store.equipo($("#mm-eq").value), u = U(e.unidad);
          const pautas = e.unidad === "km" ? [e.intervalo] : [250, 500, 1000, 2000];
          $("#mm-tipo").innerHTML = pautas.map(p => `<option>Preventiva ${fmt(p)} ${u}</option>`).join("") + `<option>Correctiva</option>`;
          $("#mm-valor").value = e.horometro;
        };
        const pintar = () => {
          $("#mm-lista").innerHTML = filas.length ? `<table><tbody>${filas.map((f, i) => {
            const ins = Store.insumos().find(x => x.codigo === f.codigo);
            return `<tr><td>${esc(f.nombre)}</td><td>${num(f.cantidad, f.unidad)}</td><td>${f.cantidad > ins.stock ? status("rojo", `Sin stock (${ins.stock})`) : status("verde", "Disponible")}</td>
              <td class="actions"><button class="btn btn-sm btn-danger" data-quitar="${i}" type="button" title="Quitar">${icon("x", 14)}</button></td></tr>`;
          }).join("")}</tbody></table>` : `<div class="mono small muted">SIN INSUMOS AGREGADOS</div>`;
        };
        actualizarEq(); pintar();
        $("#mm-eq").addEventListener("change", actualizarEq);
        $("#mm-add").addEventListener("click", () => {
          const ins = Store.insumos().find(x => x.codigo === $("#mm-ins").value);
          const cant = Number($("#mm-cant").value);
          if (!(cant > 0)) return errorModal("La cantidad debe ser mayor a 0.");
          errorModal("");
          filas.push({ codigo: ins.codigo, nombre: ins.nombre, cantidad: cant, unidad: ins.unidad });
          pintar();
        });
        $("#mm-lista").addEventListener("click", ev => { const b = ev.target.closest("[data-quitar]"); if (b) { filas.splice(Number(b.dataset.quitar), 1); pintar(); } });
        $("#mm-guardar").addEventListener("click", () => intentar(() => {
          const m = Store.registrarMantencion({ equipoId: $("#mm-eq").value, fecha: $("#mm-fecha").value, ot: $("#mm-ot").value.trim(), tipo: $("#mm-tipo").value,
            valor: $("#mm-valor").value === "" ? NaN : Number($("#mm-valor").value), responsable: $("#mm-resp").value.trim(), insumos: filas });
          cerrarModal(); toast(`Mantención registrada (${m.ot}). El ciclo del equipo se reinicia.`); refrescar();
        }));
      });
  }

  function modalEquipo(id) {
    const e = id ? Store.equipo(id) : null;
    modal(e ? `Editar ${e.codigo}` : "Nuevo equipo", formEquipo(e),
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="me-guardar">${icon("check")}${e ? "Guardar cambios" : "Crear equipo"}</button>`,
      root => {
        $("#me-guardar").addEventListener("click", () => intentar(() => {
          const d = leerForm(root);
          if (e) { Store.editarEquipo(e.id, d); toast("Equipo actualizado"); }
          else { const n = Store.crearEquipo(d); toast(`Equipo ${n.codigo} creado`); }
          cerrarModal(); refrescar();
        }));
      });
  }

  function modalGestion(equipoId) {
    const e = Store.equipo(equipoId);
    modal(`Alerta en gestión · ${e.codigo}`,
      `<p class="muted">Indica que ya se coordinó con bodega o taller. La alerta sigue visible hasta registrar la mantención.</p>
       <label>Nota (opcional)</label><textarea id="mg-nota" placeholder="Ej: insumos confirmados, taller agendado para el jueves"></textarea>`,
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="mg-ok">${icon("check")}Marcar en gestión</button>`,
      () => $("#mg-ok").addEventListener("click", () => intentar(() => { Store.marcarEnGestion(e.id, $("#mg-nota").value.trim()); cerrarModal(); toast("Alerta marcada en gestión"); refrescar(); })));
  }

  function modalVincular(id) {
    const d = Store.dispositivo(id);
    const ocupados = Store.dispositivos().filter(x => x.equipoId && x.id !== d.id && x.estado !== "baja").map(x => x.equipoId);
    modal(`Vincular ${d.deviceId}`,
      `<label>Equipo</label><select id="mv-eq"><option value="">— Sin equipo —</option>
        ${Store.equipos().map(e => `<option value="${e.id}" ${e.id === d.equipoId ? "selected" : ""} ${ocupados.includes(e.id) ? "disabled" : ""}>${esc(e.codigo)} · ${esc(e.nombre)}${ocupados.includes(e.id) ? " (ya tiene dispositivo)" : ""}</option>`).join("")}</select>`,
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="mv-ok">${icon("link")}Guardar</button>`,
      () => $("#mv-ok").addEventListener("click", () => intentar(() => { Store.vincularDispositivo(d.id, $("#mv-eq").value); cerrarModal(); toast("Vinculación actualizada"); refrescar(); })));
  }

  function modalNuevoDispositivo() {
    const n = Store.dispositivos().length + 1;
    modal("Registrar dispositivo",
      `<label>ID del dispositivo *</label><input id="nd-id" value="ESP32-${String(n).padStart(3, "0")}">
       <label>Tipo</label><select id="nd-tipo"><option>ESP32 + módulo 4G</option><option>ESP32 WiFi (prototipo)</option><option>PLC industrial</option></select>`,
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="nd-ok">${icon("plus")}Registrar</button>`,
      () => $("#nd-ok").addEventListener("click", () => intentar(() => { Store.registrarDispositivo($("#nd-id").value.trim(), $("#nd-tipo").value); cerrarModal(); toast("Dispositivo registrado"); refrescar(); })));
  }

  function modalIncidencia(id) {
    modal("Lectura inconsistente",
      callout("err", "alert", "El dispositivo informó menos horas que la última lectura. Puede ser un reinicio o falla del horómetro: coordina el cambio con el cliente. El horómetro del sistema <b>no</b> se modificó.") +
      `<label>Nota de revisión</label><textarea id="mi-nota" placeholder="Ej: horómetro reemplazado; se registrará corrección manual"></textarea>`,
      `<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" id="mi-ok">${icon("check")}Marcar como revisada</button>`,
      () => $("#mi-ok").addEventListener("click", () => intentar(() => { Store.resolverIncidencia(id, $("#mi-nota").value.trim()); cerrarModal(); toast("Incidencia revisada"); refrescar(); })));
  }

  /* ---------------- Eventos globales (delegación) ---------------- */
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-action]"); if (!b) return;
    const id = b.dataset.id;
    const acciones = {
      "nueva-lectura": () => modalLectura(id),
      "nueva-mantencion": () => modalMantencion(id),
      "nuevo-equipo": () => modalEquipo(),
      "editar-equipo": () => modalEquipo(id),
      "eliminar-equipo": () => {
        const e = Store.equipo(id);
        if (confirmar(`¿Dar de baja el equipo ${e.codigo}? Se conservará su historial.`)) intentar(() => { Store.eliminarEquipo(id); toast(`Equipo ${e.codigo} dado de baja`); refrescar(); });
      },
      "en-gestion": () => modalGestion(id),
      "quitar-gestion": () => intentar(() => { Store.quitarGestion(id); toast("Alerta reabierta"); refrescar(); }),
      "filtro-alerta": () => { filtroAlerta = id; refrescar(); },
      "ordenar-eq": () => { ordenEq.asc = ordenEq.col === id ? !ordenEq.asc : true; ordenEq.col = id; refrescar(); },
      "sync-telemetria": () => sincronizar(true),
      "resolver-incidencia": () => modalIncidencia(Number(id)),
      "simular": () => intentar(() => {
        const r = Store.simularLectura(id); ultimoPayload = r.payload;
        if (r.encolada) toast(`Sin señal: lectura ${fmt(r.payload.horas)} guardada en la cola`, "err");
        else toast(r.estado && r.estado.color !== "verde" ? `Lectura recibida · ${r.estado.texto}` : "Lectura recibida y registrada", r.estado && r.estado.color !== "verde" ? "err" : "ok");
        refrescar();
      }),
      "simular-reinicio": () => intentar(() => {
        const r = Store.simularLectura(id, true); ultimoPayload = r.payload;
        toast(r.encolada ? "Lectura encolada (sin señal)" : "Lectura inconsistente detectada: se generó una alerta", "err"); refrescar();
      }),
      "desconectar": () => intentar(() => { Store.cambiarConexion(id, false); toast("Sin señal: las lecturas se guardarán en cola", "err"); refrescar(); }),
      "reconectar": () => intentar(() => { const r = Store.cambiarConexion(id, true); toast(`Reconectado: ${r.total} lectura(s) enviadas desde la cola`); refrescar(); }),
      "vincular": () => modalVincular(id),
      "baja-dispositivo": () => { if (confirmar("¿Dar de baja este dispositivo?")) intentar(() => { Store.darDeBaja(id); toast("Dispositivo dado de baja"); refrescar(); }); },
      "nuevo-dispositivo": () => modalNuevoDispositivo(),
      "imprimir": () => window.print()
    };
    if (acciones[b.dataset.action]) acciones[b.dataset.action]();
  });

  document.addEventListener("input", ev => {
    const t = ev.target;
    const mapa = { "f-q": () => filtrosEq.q = t.value, "f-aud": () => filtroAud = t.value, "fm-tipo": () => filtrosMant.tipo = t.value };
    if (mapa[t.id]) { mapa[t.id](); const pos = t.selectionStart; refrescar(); const n = $("#" + t.id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  document.addEventListener("change", ev => {
    const t = ev.target;
    const mapa = { "f-cat": () => filtrosEq.cat = t.value, "f-dest": () => filtrosEq.dest = t.value, "f-est": () => filtrosEq.est = t.value,
      "fm-eq": () => filtrosMant.eq = t.value, "fm-desde": () => filtrosMant.desde = t.value, "fm-hasta": () => filtrosMant.hasta = t.value,
      "rep-eq": () => { location.hash = t.value ? "#/reportes/" + t.value : "#/reportes"; } };
    if (mapa[t.id]) { mapa[t.id](); if (t.id !== "rep-eq") refrescar(); }
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") cerrarModal(); });
  window.addEventListener("hashchange", router);

  /* ---------------- Inicio ---------------- */
  pintarIconos(document);
  if (Store.restoreSession()) mostrarApp(); else mostrarLogin();
})();
