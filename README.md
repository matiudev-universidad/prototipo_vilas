# Prototipo · Sistema de Control de Mantenciones — Vila's Motor

Prototipo funcional hecho con **HTML, CSS y JavaScript puro** (sin librerías ni servidor).

## Cómo abrirlo
Haz doble clic en `index.html` (Chrome o Edge). No necesita internet: las fuentes e íconos van incluidos.

## Usuarios de prueba
La contraseña de prueba es la indicada en el informe del proyecto. En el código no aparece en texto plano: solo se guarda su hash con sal.

**Seguridad de contraseñas**
- Se almacenan solo como hash con sal (campo `password_hash`, PBKDF2-SHA256 con 100.000 iteraciones y sal aleatoria por usuario), nunca en texto plano.
- Política: mínimo 12 caracteres y al menos un carácter especial. Se exige al cambiar la contraseña (botón del candado junto a «Cerrar sesión»); la clave inicial de prueba es una excepción de la demo.
- Bloqueo temporal: 5 intentos fallidos bloquean la cuenta por 5 minutos (queda en la auditoría).

| Usuario | Rol | Qué puede hacer |
|---|---|---|
| admin@vilasmotors.cl | Administrador | Todo, incluida la auditoría y la gestión de dispositivos |
| james@vilasmotors.cl | Encargada de planificación | CRUD de equipos, alertas en gestión, reportes (sin auditoría) |
| asistente@vilasmotors.cl | Asistente | Registrar horómetro (y correcciones), mantenciones, ver insumos |
| ti@vilasmotors.cl | TI | Dispositivos IoT: registrar, vincular, dar de baja y **simular lecturas ESP32**; auditoría |
| practicante@vilasmotors.cl | Practicante | Solo lectura |

## Qué se puede probar
- **Login con roles**: el menú y los botones cambian según el rol.
- **Dashboard**: KPIs, próximos vencimientos y estado por categoría (VA / VG / VR / V).
- **Equipos (CRUD)**: crear, editar, buscar/filtrar por destino y dar de baja (baja lógica, conserva historial). La tabla se ordena por código de menor a mayor; clic en un encabezado para cambiar el orden.
- **Destinos**: cada sucursal tiene su propio sistema (este es el de Iquique); cada equipo registra su *destino* (faena minera, puerto, base, etc.).
- **Telemetría y horómetros**: equipos en faenas mineras (en uso, detenidos o sin señal). Los horómetros se actualizan solos cada 5 min; «Sincronizar horómetros» fuerza la actualización y luego espera 2 min. Al abrir un equipo se ve su última ubicación en el mapa (requiere internet).
- **Ficha del equipo**: horómetro, ciclo actual, historial de mantenciones y lecturas.
- **Registrar horómetro**: si el valor es menor al último, exige motivo (corrección con trazabilidad).
- **Registrar mantención**: con insumos y validación de stock (bodega Softland simulada, solo lectura).
- **Alertas**: semáforo automático (50 h maquinaria · 300 km camionetas · 1.000 km transporte), marcar «en gestión».
- **Dispositivos IoT**: «Simular lectura» envía el JSON del ESP32; «Quitar señal» guarda lecturas en cola y «Reconectar» las despacha (store-and-forward); «Reinicio» simula un horómetro que vuelve a 3 h y genera alerta de lectura inconsistente.
- **Reportes**: reporte por equipo exportable a PDF (Imprimir → Guardar como PDF).
- **Auditoría** (solo Administrador y TI): quién hizo cada cambio y cuándo.

## Datos
- Todos los datos iniciales están en `js/data.js` (el historial del V168 viene de su planilla real).
- Los cambios se guardan en el navegador (localStorage). El botón **Restablecer datos** vuelve al contenido de `data.js`.

## Estructura
```
prototipo/
├── index.html      Login + estructura de la app
├── css/styles.css  Estilos (dirección visual "panel de instrumentos de faena")
├── fonts/          Tipografías locales: Barlow Condensed, Barlow, JetBrains Mono (funciona sin internet)
└── js/
    ├── icons.js    Íconos SVG (sin librerías ni emojis)
    ├── data.js     Datos semilla
    ├── store.js    Capa de datos y reglas de negocio (simula el backend)
    └── app.js      Vistas, navegación y formularios
```
