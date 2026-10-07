"""Carga las tablas exportadas en SQLite, ejecuta analysis/consultas.sql y genera un reporte.

Uso:
  python scripts/exportar_tablas.py      # trae los datos de n8n a data/raw/
  python analysis/metricas.py            # genera analysis/output/reporte.md (+ gráficos si hay matplotlib)

El reporte solo contiene cifras agregadas: se puede publicar. Los datos por empresa quedan en data/raw/.
"""

import csv
import re
import sqlite3
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CRUDOS = RAIZ / "data" / "raw"
SALIDA = RAIZ / "analysis" / "output"
NUMERICAS = {"capital", "anio_constitucion", "score_reglas", "score", "confianza", "id", "procesadas", "nuevas",
             "duplicadas", "excluidas", "sin_dominio", "enriquecidas", "calificadas", "revision", "descartadas",
             "errores", "trabajadores"}


def cargar(conexion: sqlite3.Connection, tabla: str) -> int:
    with open(CRUDOS / f"{tabla}.csv", encoding="utf-8") as fh:
        filas = list(csv.DictReader(fh))
    if not filas:
        return 0
    columnas = list(filas[0].keys())
    tipos = {c: "REAL" if c in NUMERICAS else "TEXT" for c in columnas}
    conexion.execute(f"DROP TABLE IF EXISTS {tabla}")
    conexion.execute(f"CREATE TABLE {tabla} ({', '.join(f'{c} {tipos[c]}' for c in columnas)})")

    def valor(c, v):
        if v in ("", None):
            return None
        return float(v) if tipos[c] == "REAL" else v

    conexion.executemany(
        f"INSERT INTO {tabla} VALUES ({', '.join('?' for _ in columnas)})",
        [[valor(c, f[c]) for c in columnas] for f in filas],
    )
    return len(filas)


def consultas() -> dict[str, str]:
    texto = (RAIZ / "analysis" / "consultas.sql").read_text(encoding="utf-8")
    bloques = re.split(r"^-- name: (\w+)\s*$", texto, flags=re.M)
    return {bloques[i]: bloques[i + 1].strip() for i in range(1, len(bloques), 2)}


def tabla_md(cursor: sqlite3.Cursor) -> str:
    columnas = [d[0] for d in cursor.description]
    filas = cursor.fetchall()
    fmt = lambda v: "" if v is None else (f"{v:g}" if isinstance(v, float) else str(v))  # noqa: E731
    lineas = ["| " + " | ".join(columnas) + " |", "|" + "---|" * len(columnas)]
    lineas += ["| " + " | ".join(fmt(v) for v in f) + " |" for f in filas]
    return "\n".join(lineas), columnas, filas


def graficos(resultados: dict) -> list[str]:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        return []
    hechos = []
    especificacion = {
        "embudo": ("Embudo del pipeline", "#2f6f9f"),
        "comparacion_fuentes": ("Empresas por fuente", "#3b7d6e"),
        "por_rubro": ("Empresas con sitio por rubro (IA)", "#5b8c3a"),
        "distribucion_score": ("Distribución del score", "#a0522d"),
        "motivos_revision": ("Motivos de revisión humana", "#7a5195"),
    }
    for nombre, (titulo, color) in especificacion.items():
        _, columnas, filas = resultados[nombre]
        if not filas:
            continue
        etiquetas = [str(f[0]) for f in filas]
        valores = [f[1] or 0 for f in filas]
        fig, ax = plt.subplots(figsize=(8, 0.6 * len(filas) + 1.5))
        ax.barh(etiquetas[::-1], valores[::-1], color=color)
        ax.set_title(titulo)
        ax.set_xlabel(columnas[1])
        for i, v in enumerate(valores[::-1]):
            ax.text(v, i, f" {v:g}", va="center")
        fig.tight_layout()
        archivo = SALIDA / f"{nombre}.png"
        fig.savefig(archivo, dpi=120)
        plt.close(fig)
        hechos.append(archivo.name)
    return hechos


def main() -> None:
    SALIDA.mkdir(parents=True, exist_ok=True)
    conexion = sqlite3.connect(CRUDOS / "prospeccion.sqlite")
    n_emp = cargar(conexion, "empresas")
    n_cor = cargar(conexion, "corridas")
    resultados = {nombre: tabla_md(conexion.execute(sql)) for nombre, sql in consultas().items()}
    imagenes = graficos(resultados)

    titulos = {
        "embudo": "Embudo", "por_estado": "Empresas por estado", "por_rubro": "Rubros (IA)",
        "distribucion_score": "Distribución del score", "motivos_revision": "Motivos de revisión humana",
        "brechas": "Brechas de cumplimiento observadas", "corridas": "Corridas registradas",
        "tasa_duplicados": "Duplicados en la ingesta",
        "comparacion_fuentes": "Fase 1 vs fase 2: rendimiento por fuente",
    }
    partes = [
        "# Reporte de métricas del pipeline",
        "",
        f"Generado desde {n_emp} empresas y {n_cor} corridas exportadas de n8n. Solo cifras agregadas.",
        "",
    ]
    for nombre, (md, _, _) in resultados.items():
        partes += [f"## {titulos.get(nombre, nombre)}", "", md, ""]
        if f"{nombre}.png" in imagenes:
            partes += [f"![{titulos.get(nombre, nombre)}]({nombre}.png)", ""]
    (SALIDA / "reporte.md").write_text("\n".join(partes), encoding="utf-8")
    print(f"reporte: analysis/output/reporte.md · gráficos: {', '.join(imagenes) or 'ninguno (falta matplotlib)'}")


if __name__ == "__main__":
    main()
