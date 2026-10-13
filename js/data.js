/* ==========================================================================
   Vila's Motor · Prototipo — DATOS SEMILLA
   Todos los datos del prototipo se cargan desde este archivo.
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

  /* ---------------- Equipos ----------------
     intervalo: cada cuántas horas/km corresponde mantención preventiva
     ultimaMantencion: valor del horómetro/odómetro en la última mantención
     aviso especial para camiones de transporte: 1.000 km (campo "aviso")     */
  equipos: [
    { id: 1,  codigo: "V168", nombre: "Grúa horquilla 3.5 ton", tipo: "Grúa horquilla", categoria: "V",  marca: "Hyster",   modelo: "H3.5FT",  patente: "SVTJ39", cliente: "Minera Collahuasi", destino: "Collahuasi",       horometro: 3402, unidad: "h",  intervalo: 250, ultimaMantencion: 3157, aviso: 50,  activo: true, lat: -20.97, lng: -68.70 },
    { id: 2,  codigo: "VG10", nombre: "Generador JCB G45QX",    tipo: "Generador",      categoria: "VG", marca: "JCB",      modelo: "G45QX",   patente: "—",      cliente: "SQM Nueva Victoria", destino: "Nueva Victoria",  horometro: 1984, unidad: "h",  intervalo: 500, ultimaMantencion: 1500, aviso: 50,  activo: true, lat: -20.49, lng: -69.65 },
    { id: 3,  codigo: "VG11", nombre: "Generador JCB G45QX",    tipo: "Generador",      categoria: "VG", marca: "JCB",      modelo: "G45QX",   patente: "—",      cliente: "SQM Nueva Victoria", destino: "Nueva Victoria",  horometro: 1210, unidad: "h",  intervalo: 500, ultimaMantencion: 1000, aviso: 50,  activo: true, lat: -20.49, lng: -69.65 },
    { id: 4,  codigo: "VG14", nombre: "Generador Atlas Copco QAS 100", tipo: "Generador", categoria: "VG", marca: "Atlas Copco", modelo: "QAS 100", patente: "—", cliente: "Empresa Portuaria Iquique", destino: "Puerto Iquique",  horometro: 4785, unidad: "h",  intervalo: 250, ultimaMantencion: 4500, aviso: 50,  activo: true, lat: -20.20, lng: -70.16 },
    { id: 5,  codigo: "VR21", nombre: "Excavadora CAT 320",     tipo: "Excavadora",     categoria: "VR", marca: "Caterpillar", modelo: "320 GC", patente: "—",    cliente: "Teck Quebrada Blanca", destino: "Quebrada Blanca", horometro: 6470, unidad: "h", intervalo: 500, ultimaMantencion: 6000, aviso: 50, activo: true, lat: -21.00, lng: -68.80 },
    { id: 6,  codigo: "VR22", nombre: "Retroexcavadora JCB 3CX", tipo: "Retroexcavadora", categoria: "VR", marca: "JCB",    modelo: "3CX",     patente: "KVLD52", cliente: "Municipalidad Alto Hospicio", destino: "Alto Hospicio", horometro: 2890, unidad: "h", intervalo: 500, ultimaMantencion: 2500, aviso: 50, activo: true, lat: -20.27, lng: -70.10 },
    { id: 7,  codigo: "VR30", nombre: "Manipulador telescópico JCB 535", tipo: "Manipulador", categoria: "VR", marca: "JCB", modelo: "535-95",  patente: "—",      cliente: "Minera Cerro Colorado", destino: "Cerro Colorado", horometro: 1620, unidad: "h", intervalo: 250, ultimaMantencion: 1500, aviso: 50, activo: true, lat: -20.04, lng: -69.26 },
    { id: 8,  codigo: "VR41", nombre: "Torre de iluminación LED", tipo: "Luminaria",     categoria: "VR", marca: "Generac",  modelo: "VT-Hybrid", patente: "—",   cliente: "Minera Collahuasi", destino: "Collahuasi",       horometro: 905,  unidad: "h",  intervalo: 500, ultimaMantencion: 500,  aviso: 50,  activo: true, lat: -20.97, lng: -68.70 },
    { id: 9,  codigo: "VR42", nombre: "Torre de iluminación LED", tipo: "Luminaria",     categoria: "VR", marca: "Generac",  modelo: "VT-Hybrid", patente: "—",   cliente: "—",                 destino: "Base Iquique",     horometro: 320,  unidad: "h",  intervalo: 500, ultimaMantencion: 0,    aviso: 50,  activo: true, lat: -20.24, lng: -70.13 },
    { id: 10, codigo: "VR55", nombre: "Camión tolva Volvo FMX",  tipo: "Camión",         categoria: "VR", marca: "Volvo",    modelo: "FMX 440", patente: "KV8840", cliente: "Teck Quebrada Blanca", destino: "Quebrada Blanca", horometro: 119300, unidad: "km", intervalo: 20000, ultimaMantencion: 100000, aviso: 1000, activo: true, lat: -21.00, lng: -68.80 },
    { id: 11, codigo: "VA03", nombre: "Camioneta Toyota Hilux",  tipo: "Camioneta",      categoria: "VA", marca: "Toyota",   modelo: "Hilux 2.4", patente: "RTKP21", cliente: "Uso interno",       destino: "Base Iquique",  horometro: 49820, unidad: "km", intervalo: 10000, ultimaMantencion: 40000, aviso: 300, activo: true, lat: -20.21, lng: -70.15 },
    { id: 12, codigo: "VA07", nombre: "Camioneta Mitsubishi L200", tipo: "Camioneta",    categoria: "VA", marca: "Mitsubishi", modelo: "L200",  patente: "SGHT14", cliente: "Uso interno",       destino: "Base Iquique",    horometro: 32150, unidad: "km", intervalo: 10000, ultimaMantencion: 30000, aviso: 300, activo: true, lat: -20.24, lng: -70.13 },
    { id: 13, codigo: "V172", nombre: "Grúa horquilla 2.5 ton", tipo: "Grúa horquilla", categoria: "V",  marca: "Toyota",   modelo: "8FD25",   patente: "TY4912", cliente: "ZOFRI",             destino: "Zona Franca",      horometro: 2492, unidad: "h",  intervalo: 250, ultimaMantencion: 2250, aviso: 50,  activo: true, lat: -20.20, lng: -70.14 },
    { id: 14, codigo: "V180", nombre: "Excavadora Komatsu PC200", tipo: "Excavadora",   categoria: "V",  marca: "Komatsu",  modelo: "PC200-8", patente: "KP8821", cliente: "Minera Cerro Colorado", destino: "Cerro Colorado", horometro: 4015, unidad: "h", intervalo: 500, ultimaMantencion: 3500, aviso: 50, activo: true, lat: -20.04, lng: -69.26 }
  ],

  /* ---------------- Historial de mantenciones ----------------
     Los registros de V168 provienen de su planilla real ("PLANILLA DE V168.xlsx") */
  mantenciones: [
    { id: 1,  equipoId: 1, ot: "89867",  fecha: "2023-10-16", tipo: "Preventiva 250 h",  valor: 828,  responsable: "Taller Iquique", insumos: [] },
    { id: 2,  equipoId: 1, ot: "90717",  fecha: "2023-11-29", tipo: "Preventiva 1000 h", valor: 1083, responsable: "Taller Iquique", insumos: [] },
    { id: 3,  equipoId: 1, ot: "91902",  fecha: "2024-02-05", tipo: "Preventiva 250 h",  valor: 1325, responsable: "Taller Iquique", insumos: [] },
    { id: 4,  equipoId: 1, ot: "92935",  fecha: "2024-04-04", tipo: "Preventiva 500 h",  valor: 1575, responsable: "Taller Iquique", insumos: [] },
    { id: 5,  equipoId: 1, ot: "94281",  fecha: "2024-07-05", tipo: "Preventiva 250 h",  valor: 1803, responsable: "Taller Iquique", insumos: [] },
    { id: 6,  equipoId: 1, ot: "98470",  fecha: "2025-02-26", tipo: "Preventiva 2000 h", valor: 2080, responsable: "Taller Iquique", insumos: [] },
    { id: 7,  equipoId: 1, ot: "100666", fecha: "2025-06-26", tipo: "Preventiva 250 h",  valor: 2363, responsable: "Taller Iquique", insumos: [] },
    { id: 8,  equipoId: 1, ot: "102477", fecha: "2025-10-01", tipo: "Preventiva 500 h",  valor: 2601, responsable: "Taller Iquique", insumos: [] },
    { id: 9,  equipoId: 1, ot: "105418", fecha: "2026-03-13", tipo: "Preventiva 500 h",  valor: 2896, responsable: "Taller Iquique", insumos: [] },
    { id: 10, equipoId: 1, ot: "106948", fecha: "2026-05-29", tipo: "Preventiva 1000 h", valor: 3157, responsable: "Taller Iquique", insumos: [] },
    { id: 11, equipoId: 2, ot: "104120", fecha: "2026-02-10", tipo: "Preventiva 500 h",  valor: 1000, responsable: "Servicio en terreno",
      insumos: [ { codigo: "ACE-15W40", nombre: "Aceite motor Total Rubia TIR 7400 15W40", cantidad: 11, unidad: "L" },
                 { codigo: "FIL-971635", nombre: "Filtro aceite de motor 02/971635", cantidad: 1, unidad: "un" },
                 { codigo: "FIL-971620", nombre: "Filtro combustible 02/971620", cantidad: 1, unidad: "un" } ] },
    { id: 12, equipoId: 2, ot: "106210", fecha: "2026-06-18", tipo: "Preventiva 500 h",  valor: 1500, responsable: "Servicio en terreno",
      insumos: [ { codigo: "ACE-15W40", nombre: "Aceite motor Total Rubia TIR 7400 15W40", cantidad: 11, unidad: "L" },
                 { codigo: "FIL-971635", nombre: "Filtro aceite de motor 02/971635", cantidad: 1, unidad: "un" },
                 { codigo: "FIL-971664", nombre: "Filtro de aire exterior 02/971664", cantidad: 1, unidad: "un" } ] },
    { id: 13, equipoId: 3, ot: "105990", fecha: "2026-05-02", tipo: "Preventiva 1000 h", valor: 1000, responsable: "Servicio en terreno", insumos: [] },
    { id: 14, equipoId: 4, ot: "106701", fecha: "2026-07-21", tipo: "Preventiva 250 h",  valor: 4500, responsable: "Taller Iquique", insumos: [] },
    { id: 15, equipoId: 5, ot: "106355", fecha: "2026-06-30", tipo: "Preventiva 500 h",  valor: 6000, responsable: "Taller Iquique", insumos: [] },
    { id: 16, equipoId: 6, ot: "103870", fecha: "2026-01-15", tipo: "Preventiva 500 h",  valor: 2500, responsable: "Taller Iquique", insumos: [] },
    { id: 17, equipoId: 10, ot: "105102", fecha: "2026-02-28", tipo: "Preventiva 20.000 km", valor: 100000, responsable: "Taller Iquique", insumos: [] },
    { id: 18, equipoId: 11, ot: "106002", fecha: "2026-05-08", tipo: "Preventiva 10.000 km", valor: 40000, responsable: "Taller Iquique", insumos: [] },
    { id: 19, equipoId: 13, ot: "106880", fecha: "2026-08-12", tipo: "Preventiva 250 h",  valor: 2250, responsable: "Taller Iquique", insumos: [] },
    { id: 20, equipoId: 14, ot: "104560", fecha: "2026-03-20", tipo: "Preventiva 500 h",  valor: 3500, responsable: "Taller Iquique", insumos: [] }
  ],

  /* ---------------- Lecturas de horómetro / kilometraje ---------------- */
  lecturas: [
    { id: 1, equipoId: 1, valor: 3290, fecha: "2026-09-01T09:10", origen: "manual", usuario: "Camila Rojas", esCorreccion: false },
    { id: 2, equipoId: 1, valor: 3402, fecha: "2026-10-08T18:00", origen: "ESP32",  usuario: "ESP32-001",    esCorreccion: false },
    { id: 3, equipoId: 2, valor: 1984, fecha: "2026-10-08T17:45", origen: "ESP32",  usuario: "ESP32-002",    esCorreccion: false },
    { id: 4, equipoId: 4, valor: 4785, fecha: "2026-10-07T12:30", origen: "manual", usuario: "Camila Rojas", esCorreccion: false },
    { id: 5, equipoId: 5, valor: 6470, fecha: "2026-10-08T20:00", origen: "ESP32",  usuario: "ESP32-004",    esCorreccion: false },
    { id: 6, equipoId: 10, valor: 119300, fecha: "2026-10-06T08:00", origen: "manual", usuario: "James Ramírez", esCorreccion: false },
    { id: 7, equipoId: 14, valor: 4015, fecha: "2026-10-08T16:20", origen: "ESP32", usuario: "ESP32-006",   esCorreccion: false }
  ],

  /* ---------------- Dispositivos IoT (ESP32) ---------------- */
  dispositivos: [
    { id: 1, deviceId: "ESP32-001", tipo: "ESP32 + módulo 4G", equipoId: 1,  estado: "online",  ultimaConexion: "2026-10-08T18:00", cola: [] },
    { id: 2, deviceId: "ESP32-002", tipo: "ESP32 + módulo 4G", equipoId: 2,  estado: "online",  ultimaConexion: "2026-10-08T17:45", cola: [] },
    { id: 3, deviceId: "ESP32-003", tipo: "ESP32 + módulo 4G", equipoId: 3,  estado: "offline", ultimaConexion: "2026-10-05T07:12", cola: [ { valor: 1235, fecha: "2026-10-06T19:00" }, { valor: 1262, fecha: "2026-10-07T19:00" } ] },
    { id: 4, deviceId: "ESP32-004", tipo: "ESP32 + módulo 4G", equipoId: 5,  estado: "online",  ultimaConexion: "2026-10-08T20:00", cola: [] },
    { id: 5, deviceId: "ESP32-005", tipo: "ESP32 WiFi (prototipo)", equipoId: null, estado: "sin vincular", ultimaConexion: null, cola: [] },
    { id: 6, deviceId: "ESP32-006", tipo: "ESP32 + módulo 4G", equipoId: 14, estado: "online",  ultimaConexion: "2026-10-08T16:20", cola: [] },
    { id: 7, deviceId: "ESP32-007", tipo: "ESP32 + módulo 4G", equipoId: 7,  estado: "online",  ultimaConexion: "2026-10-08T15:05", cola: [] },
    { id: 8, deviceId: "ESP32-008", tipo: "ESP32 + módulo 4G", equipoId: 8,  estado: "online",  ultimaConexion: "2026-10-08T07:30", cola: [] },
    { id: 9, deviceId: "ESP32-009", tipo: "ESP32 + módulo 4G", equipoId: 10, estado: "online",  ultimaConexion: "2026-10-08T19:40", cola: [] }
  ],

  /* ---------------- Telemetría en faenas mineras ----------------
     enUso: motor encendido (el horómetro avanza). horas: valor con decimales informado por el ESP32. */
  telemetria: [
    { equipoId: 1,  enUso: true,  horas: 3402.4 },
    { equipoId: 2,  enUso: true,  horas: 1984.7 },
    { equipoId: 3,  enUso: false, horas: 1210.2 },
    { equipoId: 5,  enUso: true,  horas: 6470.1 },
    { equipoId: 7,  enUso: false, horas: 1620.5 },
    { equipoId: 8,  enUso: false, horas: 905.3 },
    { equipoId: 10, enUso: true,  horas: 119300.6 },
    { equipoId: 14, enUso: true,  horas: 4015.8 }
  ],

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

  /* ---------------- Alertas gestionadas (las activas se calculan) ---------------- */
  gestionAlertas: [
    { equipoId: 5, enGestion: true, usuario: "James Ramírez", fecha: "2026-10-08T10:15", nota: "Insumos confirmados con bodega" }
  ],

  /* ---------------- Auditoría (trazabilidad de cambios) ---------------- */
  auditoria: [
    { fecha: "2026-10-07T12:30", usuario: "Camila Rojas", accion: "Registro de horómetro", detalle: "VG14: 4.785 h (manual)" },
    { fecha: "2026-10-08T10:15", usuario: "James Ramírez", accion: "Alerta en gestión", detalle: "VR21 marcada en gestión" }
  ]
};
