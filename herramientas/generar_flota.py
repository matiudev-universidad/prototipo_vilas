"""
Genera js/flota.js a partir de la planilla real de equipos de Vila's Motor Iquique.

Uso:
    python3 herramientas/generar_flota.py datos/Equipos_Iquique.xlsx

Qué hace:
  1. Lee la planilla (MAQUINARIA, FABRICANTE, MODELO, N° INTERNO, PPU) y limpia los datos:
     errores de tipeo, marcas y modelos escritos de distintas formas, patentes o series
     escritas dentro del modelo.
  2. Une cada fila "PLUMA" al camión pluma que tiene justo arriba (es la grúa montada
     en ese camión, no un equipo aparte).
  3. Asigna códigos internos PROVISORIOS por categoría (VA001, VG001, VR001…), porque la
     planilla no trae N° interno.
  4. Traspasa el historial, lecturas, dispositivos y alertas de los equipos de ejemplo
     anteriores (herramientas/historial_previo.json) a un equipo real equivalente.
  5. Para el resto genera datos de operación SIMULADOS (destino, horómetro/km, última
     mantención, dispositivo IoT/GPS) de forma reproducible (semilla fija).
"""
import json
import random
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
HOY = datetime(2026, 10, 8, 20, 0)  # "ahora" de los datos semilla
rnd = random.Random(2026)

# ---------------------------------------------------------------- Limpieza
MARCAS = {
    "KOMATSU": "Komatsu", "HANGCHA": "Hangcha", "HAMM": "Hamm", "JCB": "JCB", "JBC": "JCB", "SANY": "Sany",
    "BOBCAT": "Bobcat", "KONECRANES": "Konecranes", "MAZDA": "Mazda", "MAXUS": "Maxus", "DODGE": "Dodge",
    "HYUNDAI": "Hyundai", "MITSUBISHI": "Mitsubishi", "RENAULT": "Renault", "TOYOTA": "Toyota", "HINO": "Hino",
    "GREAT WALL": "Great Wall", "RAM": "RAM", "GENIE": "Genie", "PRAMAC": "Pramac", "VIELCO": "Vielco",
    "SULLAIR": "Sullair", "LINCOLN": "Lincoln", "WACKER NEUSON": "Wacker Neuson", "ALLMAND": "Allmand",
    "FREIGHTLINER": "Freightliner", "MERCEDES BENZ": "Mercedes-Benz", "MERCEDEZ BENZ": "Mercedes-Benz",
    "HAULLOTE": "Haulotte", "PALFINGER": "Palfinger", "KAESER": "Kaeser", "BOONIGA": "Booniga",
    "DOOSAN": "Doosan", "ATLAS COPCO": "Atlas Copco", "MITSUBISHI FUSO": "Mitsubishi Fuso",
    "MITSUBISHI-FUSO": "Mitsubishi Fuso", "SNORKEL": "Snorkel", "FOTON": "Foton", "JAC": "JAC",
    "TREMAC": "Tremac", "RANDON": "Randon", "LEDWELL": "Ledwell", "GOREN": "Goren",
}

MODELOS = [  # (expresión, reemplazo) sobre el modelo en mayúsculas
    (r"^JCB270CAB_AC_CL$", "270 CAB AC"),
    (r"_CL$", ""),
    (r"_", " "),
    (r"^FD30T[\s-]?17$", "FD30T-17"),
    (r"^FD160?E[\s-]?8$", "FD160E-8"),  # incluye el "FD16E-8" de la planilla
    (r"^FD100[\s-]?8$", "FD100-8"),
    (r"^FG20T[\s-]?16$", "FG20T-16"),
    (r"^JS?220\s?LC$", "JS220LC"),
    (r"^455 ZX$", "455ZX"),
    (r"^FD 1121$", "FD1121"),
    (r"^TRACTO ", ""),
    (r"\((CUMMINS|DETROIT)\)", r"\1"),
    (r"MOBILAR", "MOBILAIR"),
    (r"HILIDHT", "HILIGHT"),
    (r"^LN LEK1,450HZLED$", "LN LEK1.4-50HZ LED"),
    (r"^Z - ", "Z-"),
]


def limpiar_modelo(modelo, marca_up):
    """Devuelve (modelo, patente_o_serie)."""
    if modelo is None:
        return None, None
    m = re.sub(r"\s+", " ", str(modelo).strip().upper())
    if m in ("0", "NO APLICA", ""):
        return None, None
    serie = None
    pat = re.search(r"\(([A-Z]{4}-?\d{2})\)", m)  # patente escrita dentro del modelo
    if pat:
        serie = pat.group(1)
        m = m.replace(pat.group(0), "").strip()
    if re.match(r"^JCB3CX4T\w+$", m):  # N° de serie escrito como modelo
        serie, m = m, "3CX 4X4"
    if marca_up and m.startswith(marca_up + " "):
        m = m[len(marca_up) + 1:]
    for exp, rep in MODELOS:
        m = re.sub(exp, rep, m)
    return m.strip() or None, serie


def num_es(txt):
    """'07' → '7', '3.5' → '3,5'"""
    v = float(txt.replace(",", "."))
    return (str(int(v)) if v == int(v) else str(v)).replace(".", ",")


def clasificar(maq):
    """MAQUINARIA (texto de la planilla) → (tipo, nombre base, modelo de pluma integrada)."""
    q = re.sub(r"\s+", " ", maq.strip().upper()).replace("HORQULLA", "HORQUILLA").replace("RETRO EXCAVADORA", "RETROEXCAVADORA")
    if q.startswith("GRUA HORQUILLA"):
        cap = re.search(r"(\d+(?:[.,]\d+)?)\s*TON", q)
        suf = " eléctrica" if "ELECTRICA" in q else " a gas" if "GAS" in q else ""
        return "Grúa horquilla", f"Grúa horquilla {num_es(cap.group(1))} ton{suf}", None
    m = re.match(r"GENERADOR (\d+) KVA", q)
    if m:
        return "Generador", f"Generador {m.group(1)} kVA", None
    m = re.match(r"ALZA HOMBRE ART ([\d.,]+) ?M", q)
    if m:
        return "Alza hombre", f"Alza hombre articulado {num_es(m.group(1))} m", None
    if q == "ALZA HOMBRE":
        return "Alza hombre", "Alza hombre", None
    m = re.match(r"PLATAFORMA TIJERA ELECTRICA (\d+) M", q)
    if m:
        return "Plataforma tijera", f"Plataforma tijera eléctrica {m.group(1)} m", None
    if q.startswith("PLATAFORMA TIJERA"):
        return "Plataforma tijera", "Plataforma tijera", None
    if q.startswith("CAMION PLUMA"):
        pk = re.search(r"PK ?\d+ ?\w*", q)
        traccion = re.search(r"\d+X\d+", q)
        return "Camión pluma", "Camión pluma" + (" " + traccion.group(0).lower() if traccion else ""), (pk.group(0).replace(" 6X4", "") if pk else None)
    fijos = {
        "LUMINARIA SOLAR": ("Luminaria solar", "Luminaria solar"),
        "LUMINARIA": ("Luminaria", "Luminaria"),
        "CAMION TOLVA": ("Camión tolva", "Camión tolva"),
        "CAMION ALJIBE": ("Camión aljibe", "Camión aljibe"),
        "CAMION COMBUSTIBLE": ("Camión combustible", "Camión combustible"),
        "CAMION LUBRICADOR": ("Camión lubricador", "Camión lubricador"),
        "CAMION PLATAFORMA": ("Camión", "Camión plataforma"),
        "CAMION PLANO 5TN": ("Camión", "Camión plano 5 ton"),
        "CAMION RESCATE": ("Camión", "Camión de rescate"),
        "CAMION PANTALLA": ("Camión", "Camión pantalla"),
        "CAMION": ("Camión", "Camión"),
        "TRACTO CAMION": ("Tracto camión", "Tracto camión"),
        "CAMA BAJA": ("Cama baja", "Cama baja"),
        "SEMIREMOLQUE": ("Cama baja", "Semirremolque cama baja"),
        "RAMPLA": ("Rampla", "Rampla"),
        "CAMIONETA": ("Camioneta", "Camioneta"),
        "FURGÓN": ("Furgón", "Furgón"),
        "MINIBUS": ("Minibús", "Minibús"),
        "RETROEXCAVADORA": ("Retroexcavadora", "Retroexcavadora"),
        "EXCAVADORA": ("Excavadora", "Excavadora"),
        "CARGADOR FRONTAL": ("Cargador frontal", "Cargador frontal"),
        "MINICARGADOR": ("Minicargador", "Minicargador"),
        "MANIPULADOR": ("Manipulador", "Manipulador telescópico"),
        "MOTONIVELADORA": ("Motoniveladora", "Motoniveladora"),
        "RODILLO COMPACTADOR": ("Rodillo compactador", "Rodillo compactador"),
        "COMPRESOR": ("Compresor", "Compresor"),
        "SOLDADORA": ("Soldadora", "Soldadora"),
    }
    if q in fijos:
        return fijos[q] + (None,)
    raise ValueError(f"Tipo de maquinaria no reconocido: {maq!r}")


# ---------------------------------------------------------------- Reglas por tipo
VA = {"Camioneta", "Furgón", "Minibús"}
TRANSPORTE = {"Camión", "Camión pluma", "Camión tolva", "Camión aljibe", "Camión combustible", "Camión lubricador",
              "Tracto camión", "Cama baja", "Rampla"}
REMOLQUES = {"Cama baja", "Rampla"}  # sin motor: se controlan por GPS (km recorridos)
INTERVALO_H = {"Grúa horquilla": 250, "Manipulador": 250, "Minicargador": 250, "Alza hombre": 250,
               "Plataforma tijera": 250, "Soldadora": 250, "Rodillo compactador": 250,
               "Excavadora": 500, "Retroexcavadora": 500, "Cargador frontal": 500, "Motoniveladora": 500,
               "Generador": 500, "Compresor": 500, "Luminaria": 500, "Luminaria solar": 1000}


def reglas(tipo):
    """→ (categoria, unidad, intervalo, aviso)"""
    if tipo in VA:
        return "VA", "km", 10000, 300
    if tipo in TRANSPORTE:
        return "VR", "km", 20000, 1000
    return ("VG" if tipo == "Generador" else "VR"), "h", INTERVALO_H[tipo], 50


DESTINOS = {
    "Base Iquique": (-20.24, -70.13), "Collahuasi": (-20.97, -68.70), "Quebrada Blanca": (-21.00, -68.80),
    "Cerro Colorado": (-20.04, -69.26), "Nueva Victoria": (-20.49, -69.65), "Puerto Iquique": (-20.20, -70.16),
    "Zona Franca": (-20.20, -70.14), "Alto Hospicio": (-20.27, -70.10),
}
MINAS = ["Collahuasi", "Quebrada Blanca", "Cerro Colorado", "Nueva Victoria"]
CLIENTES = {"Collahuasi": "Minera Collahuasi", "Quebrada Blanca": "Teck Quebrada Blanca",
            "Cerro Colorado": "Minera Cerro Colorado", "Nueva Victoria": "SQM Nueva Victoria",
            "Puerto Iquique": "Empresa Portuaria Iquique", "Zona Franca": "ZOFRI",
            "Alto Hospicio": "Municipalidad Alto Hospicio", "Base Iquique": "—"}
TIERRA = {"Excavadora", "Retroexcavadora", "Cargador frontal", "Minicargador", "Manipulador", "Motoniveladora", "Rodillo compactador"}
ENERGIA = {"Generador", "Luminaria", "Luminaria solar", "Compresor", "Soldadora"}


def pesos_destino(tipo):
    if tipo in VA:
        return {"Base Iquique": 60, "Mina": 30, "Puerto Iquique": 5, "Alto Hospicio": 5}
    if tipo == "Grúa horquilla":
        return {"Zona Franca": 30, "Puerto Iquique": 25, "Base Iquique": 15, "Mina": 30}
    if tipo in ENERGIA:
        return {"Mina": 55, "Base Iquique": 20, "Puerto Iquique": 10, "Alto Hospicio": 10, "Zona Franca": 5}
    if tipo in TIERRA:
        return {"Mina": 50, "Alto Hospicio": 25, "Base Iquique": 15, "Puerto Iquique": 10}
    if tipo in ("Alza hombre", "Plataforma tijera"):
        return {"Zona Franca": 25, "Puerto Iquique": 25, "Mina": 30, "Base Iquique": 20}
    if tipo in REMOLQUES:
        return {"Base Iquique": 40, "Puerto Iquique": 20, "Mina": 40}
    return {"Mina": 50, "Base Iquique": 30, "Puerto Iquique": 20}  # camiones


def elegir_destino(tipo):
    p = pesos_destino(tipo)
    d = rnd.choices(list(p), weights=list(p.values()))[0]
    return rnd.choice(MINAS) if d == "Mina" else d


# Rango típico de lectura actual (h o km) por tipo
def rango_lectura(tipo):
    if tipo in VA:
        return 8000, 180000
    if tipo in REMOLQUES:
        return 15000, 250000
    if tipo in TRANSPORTE:
        return 30000, 420000
    if tipo == "Luminaria solar":
        return 2000, 9000
    if tipo in ("Generador", "Luminaria"):
        return 600, 16000
    return 800, 12000


# ---------------------------------------------------------------- Semáforo (igual que js/store.js)
def estado(eq):
    hito = (eq["ultimaMantencion"] + eq["aviso"]) // eq["intervalo"] * eq["intervalo"]
    restante = hito + eq["intervalo"] - eq["horometro"]
    if restante <= 0:
        return "rojo", hito
    if restante <= eq["aviso"] / 2:
        return "naranja", hito
    if restante <= eq["aviso"]:
        return "amarillo", hito
    return "verde", hito


def pauta(eq, hito):
    if eq["unidad"] == "km":
        return eq["intervalo"]
    return next((p for p in (2000, 1000, 500, 250) if p >= eq["intervalo"] and hito % p == 0), eq["intervalo"])


def simular_lecturas(eq):
    """Horómetro y última mantención coherentes con un estado del semáforo elegido al azar."""
    I, A = eq["intervalo"], eq["aviso"]
    objetivo = rnd.choices(["verde", "amarillo", "naranja", "rojo"], weights=[70, 12, 8, 10])[0]
    paso = 10 if eq["unidad"] == "km" else 1
    if objetivo == "verde":
        r = rnd.randint(A + 1, I)
    elif objetivo == "amarillo":
        r = rnd.randint(A // 2 + 1, A)
    elif objetivo == "naranja":
        r = rnd.randint(1, A // 2)
    else:
        r = -rnd.randint(0, A * 2)
    r = max(1, r // paso * paso) if r > 0 else r // paso * paso
    lo, hi = rango_lectura(eq["tipo"])
    k = max(2, round((rnd.randint(lo, hi) + r) / I))
    proxima = k * I
    eq["horometro"] = proxima - r
    hito = proxima - I
    delta = rnd.randint(-int(A * 0.8), max(0, min(int(I * 0.1), I - r if r > 0 else I // 10)))
    eq["ultimaMantencion"] = min(eq["horometro"], hito + delta // paso * paso)
    assert estado(eq)[0] == objetivo, (eq, objetivo)


# ---------------------------------------------------------------- Lectura de la planilla
def leer(ruta):
    ws = openpyxl.load_workbook(ruta, data_only=True).active
    filas = [r for r in ws.iter_rows(min_row=2, values_only=True) if r and r[0]]
    equipos = []
    for maq, fab, mod, interno, ppu in filas:
        marca_up = re.sub(r"\s+", " ", str(fab).strip().upper()) if fab else None
        if maq.strip().upper() == "PLUMA":
            cam = equipos[-1]
            assert cam["tipo"] == "Camión pluma", f"PLUMA sin camión pluma arriba (fila tras {cam['nombre']})"
            modelo, _ = limpiar_modelo(mod, marca_up)
            cam["pluma"] = {"marca": MARCAS.get(marca_up) if marca_up else None, "modelo": modelo or cam["pluma"]["modelo"]}
            continue
        tipo, nombre, pluma_modelo = clasificar(maq)
        marca = MARCAS.get(marca_up) if marca_up else None
        modelo, serie = limpiar_modelo(mod, marca_up)
        if marca_up and marca_up not in MARCAS:  # ej: "S8510-8415" escrito en FABRICANTE
            modelo, marca = marca_up, None
        if tipo == "Cama baja" and modelo == "CAMA BAJA":
            modelo = None
        if not re.search(r"\d", nombre) and marca:  # nombres genéricos: se agrega la marca
            nombre += " " + marca
        eq = {"tipo": tipo, "nombre": nombre, "marca": marca or "—", "modelo": modelo or "—",
              "patente": str(ppu).strip() if ppu else (serie or "—")}
        if tipo == "Camión pluma":
            eq["pluma"] = {"marca": None, "modelo": pluma_modelo}
        equipos.append(eq)
    return equipos


# Equipos de ejemplo anteriores → equipo real equivalente (criterio, n° de coincidencia)
EQUIVALENTES = {
    1: (lambda e: e["nombre"] == "Grúa horquilla 3,5 ton" and e["marca"] == "Hangcha", 0),
    2: (lambda e: e["modelo"] == "G45QX", 0),
    3: (lambda e: e["modelo"] == "G45QX", 1),
    4: (lambda e: e["modelo"] == "G115QS", 0),
    5: (lambda e: e["modelo"] == "JS220LC", 0),
    6: (lambda e: e["tipo"] == "Retroexcavadora" and e["modelo"] == "3CX", 0),
    7: (lambda e: e["modelo"] == "533-105 T", 0),
    8: (lambda e: e["modelo"] == "LTV 6K", 0),
    9: (lambda e: e["modelo"] == "LTV 6K", 1),
    10: (lambda e: e["tipo"] == "Camión tolva" and e["marca"] == "Freightliner", 0),
    11: (lambda e: e["modelo"] == "HILUX D CAB 4X4 3.0", 0),
    12: (lambda e: e["modelo"] == "L200 KATANA CRT 4X4 2.4", 0),
    13: (lambda e: e["nombre"] == "Grúa horquilla 2,5 ton eléctrica", 0),
    14: (lambda e: e["modelo"] == "JS220LC", 1),
}
CAMPOS_OPERACION = ["destino", "cliente", "horometro", "unidad", "intervalo", "ultimaMantencion", "aviso", "lat", "lng"]


def fecha_menos(dias, base=HOY):
    return (base - timedelta(days=dias))


def iso(d, hora=True):
    return d.strftime("%Y-%m-%dT%H:%M") if hora else d.strftime("%Y-%m-%d")


def main(ruta):
    equipos = leer(ruta)
    previo = json.loads((RAIZ / "herramientas" / "historial_previo.json").read_text(encoding="utf-8"))

    # ids y códigos provisorios (orden de la planilla dentro de cada categoría)
    contador = {"VA": 0, "VG": 0, "VR": 0}
    for i, eq in enumerate(equipos, 1):
        cat, unidad, intervalo, aviso = reglas(eq["tipo"])
        contador[cat] += 1
        eq.update({"id": i, "codigo": f"{cat}{contador[cat]:03d}", "categoria": cat, "unidad": unidad,
                   "intervalo": intervalo, "aviso": aviso, "activo": True})

    # traspaso de los equipos de ejemplo anteriores
    viejo_a_nuevo, usados = {}, set()
    for viejo in previo["equipos"]:
        criterio, n = EQUIVALENTES[viejo["id"]]
        candidatos = [e for e in equipos if criterio(e)]
        destino = candidatos[n]
        assert destino["id"] not in usados and destino["unidad"] == viejo["unidad"]
        usados.add(destino["id"])
        viejo_a_nuevo[viejo["id"]] = destino
        for c in CAMPOS_OPERACION:
            destino[c] = viejo[c]
    codigo_nuevo = {v["codigo"]: viejo_a_nuevo[v["id"]]["codigo"] for v in previo["equipos"]}

    def recodificar(txt):
        return re.sub(r"\b(V[AGR]?\d+)\b", lambda m: codigo_nuevo.get(m.group(1), m.group(1)), txt)

    mantenciones = [dict(m, equipoId=viejo_a_nuevo[m["equipoId"]]["id"]) for m in previo["mantenciones"]]
    lecturas = [dict(l, equipoId=viejo_a_nuevo[l["equipoId"]]["id"]) for l in previo["lecturas"]]
    dispositivos = [dict(d, equipoId=viejo_a_nuevo[d["equipoId"]]["id"] if d["equipoId"] else None) for d in previo["dispositivos"]]
    telemetria = [dict(t, equipoId=viejo_a_nuevo[t["equipoId"]]["id"]) for t in previo["telemetria"]]
    gestion = [dict(g, equipoId=viejo_a_nuevo[g["equipoId"]]["id"]) for g in previo["gestionAlertas"]]
    auditoria = [dict(a, detalle=recodificar(a["detalle"])) for a in previo["auditoria"]]
    ots_usadas = {int(m["ot"]) for m in mantenciones}

    # datos de operación simulados para los equipos reales restantes
    nuevos = [e for e in equipos if e["id"] not in usados]
    n_esp, n_gps = max(int(d["deviceId"][6:]) for d in dispositivos), 0
    pendientes_ot = []
    for eq in nuevos:
        dest = elegir_destino(eq["tipo"])
        lat, lng = DESTINOS[dest]
        eq.update({"destino": dest, "cliente": "Uso interno" if eq["categoria"] == "VA" else CLIENTES[dest],
                   "lat": round(lat + rnd.uniform(-.012, .012), 4), "lng": round(lng + rnd.uniform(-.012, .012), 4)})
        simular_lecturas(eq)

        # dispositivo: ESP32 en faenas mineras; GPS en camas bajas y ramplas (sin motor)
        disp = None
        if eq["tipo"] in REMOLQUES:
            n_gps += 1
            disp = {"deviceId": f"GPS-{n_gps:03d}", "tipo": "Rastreador GPS 4G"}
        elif dest in MINAS:
            n_esp += 1
            disp = {"deviceId": f"ESP32-{n_esp:03d}", "tipo": "ESP32 + módulo 4G"}
        ultima = fecha_menos(rnd.uniform(0, 12)).replace(second=0, microsecond=0)
        if disp:
            online = rnd.random() > 0.07
            conexion = (HOY - timedelta(minutes=rnd.randint(5, 600))) if online else fecha_menos(rnd.uniform(1.5, 6))
            conexion = conexion.replace(second=0, microsecond=0)
            ultima = conexion
            disp.update({"id": len(dispositivos) + 1, "equipoId": eq["id"], "estado": "online" if online else "offline",
                         "ultimaConexion": iso(conexion), "cola": []})
            dispositivos.append(disp)
            telemetria.append({"equipoId": eq["id"], "enUso": rnd.random() < (0.35 if eq["tipo"] in REMOLQUES else 0.55),
                               "horas": round(eq["horometro"] + rnd.uniform(0, .9), 1)})
        origen = ("GPS" if disp["deviceId"].startswith("GPS") else "ESP32") if disp else "manual"
        lecturas.append({"id": len(lecturas) + 1, "equipoId": eq["id"], "valor": eq["horometro"], "fecha": iso(ultima),
                         "origen": origen, "usuario": disp["deviceId"] if disp else rnd.choice(["Camila Rojas", "James Ramírez"]),
                         "esCorreccion": False})

        # última mantención (fecha estimada según el uso diario típico)
        if eq["ultimaMantencion"] > 0:
            uso_dia = (rnd.uniform(80, 200) if eq["categoria"] == "VA" else rnd.uniform(150, 400)) if eq["unidad"] == "km" else rnd.uniform(3, 10)
            dias = min(700, (eq["horometro"] - eq["ultimaMantencion"]) / uso_dia + rnd.uniform(1, 6))
            hito = estado(eq)[1]
            u = "km" if eq["unidad"] == "km" else "h"
            pendientes_ot.append({"equipoId": eq["id"], "fecha": iso(fecha_menos(dias), hora=False),
                                  "tipo": f"Preventiva {pauta(eq, hito):,} {u}".replace(",", "."), "valor": eq["ultimaMantencion"],
                                  "responsable": "Servicio en terreno" if dest in MINAS else "Taller Iquique", "insumos": []})

    # N° de OT correlativo según la fecha (como en la planilla real: ~18 OT por día)
    base_ot = date(2023, 10, 16)
    for m in sorted(pendientes_ot, key=lambda m: m["fecha"]):
        ot = 89867 + int((date.fromisoformat(m["fecha"]) - base_ot).days * 17.9) + rnd.randint(0, 12)
        while ot in ots_usadas:
            ot += 1
        ots_usadas.add(ot)
        mantenciones.append(dict(m, id=len(mantenciones) + 1, ot=str(ot)))

    orden = ["id", "codigo", "nombre", "tipo", "categoria", "marca", "modelo", "patente", "cliente", "destino",
             "horometro", "unidad", "intervalo", "ultimaMantencion", "aviso", "activo", "lat", "lng", "pluma"]
    equipos = [{k: e[k] for k in orden if k in e} for e in equipos]
    salida = {"equipos": equipos, "mantenciones": mantenciones, "lecturas": lecturas, "dispositivos": dispositivos,
              "telemetria": telemetria, "gestionAlertas": gestion, "auditoria": auditoria}

    def lista(nombre):
        return "  " + nombre + ": [\n" + ",\n".join("    " + json.dumps(x, ensure_ascii=False) for x in salida[nombre]) + "\n  ]"

    js = ("/* ==========================================================================\n"
          "   Vila's Motor · Prototipo — FLOTA REAL (base Iquique)\n"
          "   ARCHIVO GENERADO por herramientas/generar_flota.py desde datos/Equipos_Iquique.xlsx.\n"
          "   No editar a mano: modifica la planilla o el script y vuelve a generarlo.\n"
          "   - Tipo, marca y modelo vienen de la planilla real (limpiados).\n"
          "   - Los códigos internos (VA001, VG001, VR001…) son PROVISORIOS: la planilla no trae N° interno.\n"
          "   - Destino, horómetro/km, mantenciones y dispositivos de los equipos nuevos son SIMULADOS.\n"
          "   - El historial de los antiguos equipos de ejemplo se traspasó a un equipo real equivalente.\n"
          "   ========================================================================== */\n\n"
          "const FLOTA = {\n" + ",\n\n".join(lista(n) for n in salida) + "\n};\n")
    (RAIZ / "js" / "flota.js").write_text(js, encoding="utf-8")

    # resumen
    from collections import Counter
    print(f"{len(equipos)} equipos · {sum(1 for e in equipos if 'pluma' in e)} camiones pluma "
          f"({sum(1 for e in equipos if e.get('pluma', {}).get('modelo'))} con datos de pluma)")
    print("Categorías:", dict(Counter(e["categoria"] for e in equipos)))
    print("Estados:", dict(Counter(estado(e)[0] for e in equipos)))
    print(f"{len(mantenciones)} mantenciones · {len(lecturas)} lecturas · {len(dispositivos)} dispositivos · {len(telemetria)} con telemetría")
    print("Traspasos:")
    for v in previo["equipos"]:
        n = viejo_a_nuevo[v["id"]]
        print(f"  {v['codigo']:5} {v['nombre']:34} → {n['codigo']} {n['nombre']} ({n['marca']} {n['modelo']})")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "datos" / "Equipos_Iquique.xlsx")
