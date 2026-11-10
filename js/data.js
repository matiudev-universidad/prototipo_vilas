/* ==========================================================================
   Vila's Motor · Prototipo — DATOS SEMILLA
   Datos fijos (usuarios, categorías, destinos, insumos) + la flota real de js/flota.js.
   Al iniciar por primera vez se copian al almacenamiento local del navegador
   (localStorage) para que los cambios (CRUD) se mantengan entre recargas.
   El botón "Restablecer datos" vuelve a este estado inicial.
   ========================================================================== */

const SEED = {
  /* ---------------- Usuarios y roles (RBAC) ----------------
     Las contraseñas NUNCA se guardan en texto plano: password_hash tiene el formato
     pbkdf2$<iteraciones>$<sal hex>$<hash hex> (PBKDF2-SHA256, sal aleatoria por usuario). */
  usuarios: [
    { id: 5, nombre: "Rodrigo Soto",    email: "admin@vilasmotors.cl",       password_hash: "pbkdf2$100000$4dabd090ff2178bf88204df79118f715$1617b153c4cc0ee0a3df4a7f781da82aa8043b141ccd6f06bb8e08d2866ade0b", rol: "admin" },
    { id: 1, nombre: "James Ramírez",   email: "james@vilasmotors.cl",       password_hash: "pbkdf2$100000$0d2ba11881d66c37402fdfce38bb33af$0385f1199c81c22a211de2a234ce27082b4e6d02a2f85e209402441407918c69", rol: "encargada" },
    { id: 2, nombre: "Camila Rojas",    email: "asistente@vilasmotors.cl",   password_hash: "pbkdf2$100000$63f3644acfbc644242e9789099e1dda0$3fb02486228fc0f4451f03d8a9c8e2a66265723e0bbceae830bfe4dc1c2a5c5b", rol: "asistente" },
    { id: 3, nombre: "Marcelo Henríquez", email: "ti@vilasmotors.cl",        password_hash: "pbkdf2$100000$7aa587583018fea8164a1793577cf46a$28548c7f5a7225cfca96b86fdbd180b343da98af129dd6c5421edca8eb1f50f8", rol: "ti" },
    { id: 4, nombre: "Diego Muñoz",     email: "practicante@vilasmotors.cl", password_hash: "pbkdf2$100000$16bd07e9dd1e15263df29e364ec93b1a$eeaec69ce88e5ca02ad239d4cec7d10017b9a4b97febcb76b64afe7d42626d11", rol: "practicante" }
  ],

  /* ---------------- Categorías internas de la flota ---------------- */
  categorias: [
    { codigo: "VA", nombre: "Vehículos de administración", unidad: "km", aviso: 300 },
    { codigo: "VG", nombre: "Generadores",                  unidad: "h",  aviso: 50 },
    { codigo: "VR", nombre: "Maquinaria de renta",          unidad: "h",  aviso: 50 },
    { codigo: "V",  nombre: "Equipos subarrendados",        unidad: "h",  aviso: 50 }
  ],

  /* ---------------- Destinos ----------------
     Cada sucursal tiene su propio sistema: este corresponde a la base Iquique.
     El "destino" es el lugar donde la máquina quedó trabajando (faena, puerto, etc.). */
  base: "Iquique",
  destinos: [
    { nombre: "Base Iquique",    tipo: "Base",         lat: -20.24, lng: -70.13 },
    { nombre: "Collahuasi",      tipo: "Minería",      lat: -20.97, lng: -68.70 },
    { nombre: "Quebrada Blanca", tipo: "Minería",      lat: -21.00, lng: -68.80 },
    { nombre: "Cerro Colorado",  tipo: "Minería",      lat: -20.04, lng: -69.26 },
    { nombre: "Nueva Victoria",  tipo: "Minería",      lat: -20.49, lng: -69.65 },
    { nombre: "Puerto Iquique",  tipo: "Puerto",       lat: -20.20, lng: -70.16 },
    { nombre: "Zona Franca",     tipo: "Industrial",   lat: -20.20, lng: -70.14 },
    { nombre: "Alto Hospicio",   tipo: "Obra urbana",  lat: -20.27, lng: -70.10 }
  ],

  /* ---------------- Flota real de Iquique ----------------
     Equipos, historial de mantenciones, lecturas, dispositivos IoT/GPS, telemetría,
     alertas en gestión y auditoría vienen de js/flota.js, que se genera desde la planilla
     real (datos/Equipos_Iquique.xlsx) con herramientas/generar_flota.py.
     intervalo: cada cuántas horas/km corresponde mantención preventiva
     ultimaMantencion: valor del horómetro/odómetro en la última mantención
     aviso: 50 h maquinaria · 300 km camionetas · 1.000 km transporte (camiones, camas bajas) */
  equipos: FLOTA.equipos,
  mantenciones: FLOTA.mantenciones,
  lecturas: FLOTA.lecturas,
  dispositivos: FLOTA.dispositivos,
  telemetria: FLOTA.telemetria,

  /* ---------------- Stock de bodega (simulación Softland, solo lectura) ---------------- */
  insumos: [
    { codigo: "ACE-15W40",  nombre: "Aceite motor Total Rubia TIR 7400 15W40", stock: 66, unidad: "L" },
    { codigo: "FIL-971635", nombre: "Filtro aceite de motor 02/971635",         stock: 4,  unidad: "un" },
    { codigo: "FIL-971620", nombre: "Filtro combustible 02/971620",              stock: 2,  unidad: "un" },
    { codigo: "FIL-971664", nombre: "Filtro de aire exterior 02/971664",         stock: 0,  unidad: "un" },
    { codigo: "FIL-AIRINT", nombre: "Filtro de aire interior",                   stock: 3,  unidad: "un" },
    { codigo: "REF-SUPRA",  nombre: "Refrigerante Coolelf Auto Supra -37 °C",    stock: 40, unidad: "L" },
    { codigo: "HID-ISO68",  nombre: "Aceite hidráulico ISO 68",                  stock: 120, unidad: "L" },
    { codigo: "COR-G45QX",  nombre: "Correa ventilador JCB G45QX",               stock: 1,  unidad: "un" },
    { codigo: "ADH-MANT",   nombre: "Logo adhesivo mantención",                  stock: 50, unidad: "un" }
  ],

  /* ---------------- Alertas gestionadas (las activas se calculan) y auditoría ---------------- */
  gestionAlertas: FLOTA.gestionAlertas,
  auditoria: FLOTA.auditoria
};
