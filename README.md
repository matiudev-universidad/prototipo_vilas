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
- **Inicio**: botón «Inicio» en la barra superior (y el logo) vuelven al panel de flota.
- **Dashboard**: KPIs clicables (llevan a Equipos filtrado por ese estado), próximos vencimientos y estado por categoría (VA / VG / VR / V).
- **Semáforo de 4 niveles**: verde (operativo), amarillo (próximo, dentro del aviso), naranja (crítico, queda la mitad del aviso o menos) y rojo (vencido).
- **Lectura programada**: el intervalo se respeta como en el historial (hitos fijos: 250, 500, 750… h). Ej.: VR005 (grúa horquilla Hangcha 3,5 ton, que recibió el historial real de la antigua V168) hizo la de 3.000 h a las 3.157 h → la siguiente queda programada a las 3.250 h. El «Restante» es positivo si quedan horas/km y negativo si ya se pasó.
- **Flota real de Iquique**: 384 equipos de la planilla de Vila's (grúas horquilla, generadores, luminarias, camionetas, camiones, camas bajas, etc.). Las tablas largas se muestran de a 25 con paginación, y los formularios tienen buscador de equipos.
- **Equipos (CRUD)**: crear, editar, buscar (código, nombre, marca, modelo o patente), filtrar por categoría, destino o estado y dar de baja (baja lógica, conserva historial). La tabla se ordena por código de menor a mayor; clic en un encabezado para cambiar el orden.
- **Camiones pluma**: la pluma va unida a su camión (se ve en la ficha como «Pluma montada»).
- **Destinos**: cada sucursal tiene su propio sistema (este es el de Iquique); cada equipo registra su *destino* (faena minera, puerto, base, etc.).
- **Telemetría y horómetros**: equipos en faenas mineras y equipos con rastreador GPS (en uso, detenidos o sin señal). Las camas bajas y ramplas no tienen horómetro: su GPS informa encendido, ubicación y km recorridos, y la mantención se programa por km. Los horómetros se actualizan solos cada 5 min; «Sincronizar horómetros» fuerza la actualización y luego espera 2 min. Al hacer clic en un cuadro (En uso, Detenidos, Sin señal) se filtra la tabla. Al abrir un equipo se ve su última ubicación en el mapa (requiere internet).
- **Ficha del equipo**: horómetro, ciclo actual, historial de mantenciones y lecturas.
- **Registrar horómetro**: si el valor es menor al último, exige motivo (corrección con trazabilidad).
- **Mantenciones**: filtros por equipo, tipo y fechas, con botón «Limpiar filtros».
- **Registrar mantención**: sugiere la pauta del hito programado; insumos con buscador que carga de a 5 y validación de stock (bodega Softland simulada, solo lectura).
- **Alertas**: semáforo automático (50 h maquinaria · 300 km camionetas · 1.000 km transporte), marcar «en gestión».
- **Dispositivos IoT**: ESP32 (horas de motor) y rastreadores GPS (`GPS-000`). «Simular lectura» envía el JSON del ESP32 o del GPS; «Quitar señal» guarda lecturas en cola y «Reconectar» las despacha (store-and-forward); «Reinicio» simula un horómetro que vuelve a 3 h y genera alerta de lectura inconsistente.
- **Reportes**: reporte por equipo exportable a PDF (Imprimir → Guardar como PDF).
- **Auditoría** (solo Administrador y TI): quién hizo cada cambio y cuándo; cada registro se puede abrir para ver el detalle y el equipo relacionado.

## Datos
- **Flota**: `js/flota.js` se genera desde la planilla real `datos/Equipos_Iquique.xlsx` con:
  ```
  python3 herramientas/generar_flota.py datos/Equipos_Iquique.xlsx
  ```
  (requiere `openpyxl`). El script limpia los datos (errores de tipeo, modelos escritos de distintas formas, patentes o series escritas en el modelo) y une cada «PLUMA» a su camión.
- **Qué es real y qué es simulado**:
  - Real: tipo, marca y modelo de cada equipo (de la planilla).
  - Provisorio: los códigos internos (`VA001` vehículos de administración, `VG001` generadores, `VR001` maquinaria de renta), porque la planilla no trae N° interno ni PPU.
  - Simulado: destino, cliente, horómetro/km, última mantención y dispositivos. Se generan con una semilla fija, así que siempre salen iguales.
  - Traspasado: el historial, lecturas, dispositivos y alertas de los antiguos equipos de ejemplo pasaron a un equipo real equivalente (ej.: V168 → VR005, VG10 → VG004, VR55 → VR143). El historial de la V168 viene de su planilla real. La tabla completa se imprime al correr el script.
- Usuarios, categorías, destinos e insumos siguen en `js/data.js`.
- Los cambios se guardan en el navegador (localStorage). El botón **Restablecer datos** vuelve al estado inicial. Los datos de la versión anterior (con los 14 equipos de ejemplo) se descartan solos al abrir esta versión.

## Estructura
```
prototipo/
├── index.html      Login + estructura de la app
├── datos/          Planilla real de equipos (Equipos_Iquique.xlsx)
├── herramientas/   generar_flota.py (genera js/flota.js) e historial_previo.json (historial traspasado)
├── css/styles.css  Estilos (dirección visual "panel de instrumentos de faena")
├── fonts/          Tipografías locales: Barlow Condensed, Barlow, JetBrains Mono (funciona sin internet)
└── js/
    ├── icons.js    Íconos SVG (sin librerías ni emojis)
    ├── flota.js    Flota real de Iquique (GENERADO, no editar a mano)
    ├── data.js     Datos semilla (usuarios, destinos, insumos) + flota
    ├── store.js    Capa de datos y reglas de negocio (simula el backend)
    └── app.js      Vistas, navegación y formularios
```
