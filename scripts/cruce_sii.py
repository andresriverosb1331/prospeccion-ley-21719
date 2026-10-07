"""Cruza las empresas del pipeline con la nómina de personas jurídicas del SII.

La nómina pesa ~378 MB por año: no cabe en un nodo Code de n8n. Este script la recorre una sola vez
(sin descomprimirla a disco), toma SOLO los RUT que ya están en la Data Table `empresas` y los carga
en la Data Table `sii_referencia`. Luego el workflow A3 · Cruce SII actualiza `empresas`.

Uso: python scripts/cruce_sii.py [--zip data/raw/sii/PUB_EMPRESAS_PJ_2020_A_2024.zip] [--anio 2024]
"""

import argparse
import io
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from n8n_mcp import IDS, PROYECTO, llamar  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent


def tamano_por_tramo(tramo: str) -> str:
    t = int(tramo) if tramo.isdigit() else 0
    if t <= 1:
        return "sin_info"
    if t <= 4:
        return "micro"
    if t <= 7:
        return "pequena"
    if t <= 9:
        return "mediana"
    return "grande"


def leer_tabla(tabla_id: str) -> list[dict]:
    filas, salto = [], 0
    while True:
        r = llamar("get_data_table_rows", {"dataTableId": tabla_id, "projectId": PROYECTO,
                                           "limit": 100, "skip": salto, "sortBy": "id:asc"})
        filas.extend(r["rows"])
        salto += len(r["rows"])
        if not r["rows"] or salto >= r["count"]:
            return filas


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    p.add_argument("--zip", default=str(RAIZ / "data" / "raw" / "sii" / "PUB_EMPRESAS_PJ_2020_A_2024.zip"))
    p.add_argument("--anio", default="2024")
    a = p.parse_args()

    empresas = leer_tabla(IDS["tabla_empresas"])
    ya = {f["rut"] for f in leer_tabla(IDS["tabla_sii"])}
    buscados = {f["rut"].split("-")[0]: f["rut"] for f in empresas if f.get("rut") and f["rut"] not in ya}
    print(f"empresas en el pipeline: {len(empresas)} · ya cruzadas: {len(ya)} · a buscar: {len(buscados)}")
    if not buscados:
        return

    encontrados = []
    with zipfile.ZipFile(a.zip) as z:
        nombre = next(n for n in z.namelist() if a.anio in n)
        with z.open(nombre) as fh:
            texto = io.TextIOWrapper(fh, encoding="latin-1")
            cab = texto.readline().rstrip("\n").split("\t")
            col = {c.encode("latin-1").decode("utf-8", "replace"): i for i, c in enumerate(cab)}
            i_rut, i_tramo, i_trab = col["RUT"], col["Tramo según ventas"], col["Número de trabajadores dependie"]
            i_ini, i_rubro, i_act, i_com = (col["Fecha inicio de actividades vige"], col["Rubro económico"],
                                            col["Actividad económica"], col["Comuna"])
            for linea in texto:
                campos = linea.rstrip("\n").split("\t")
                rut = campos[i_rut] if len(campos) > i_rut else ""
                if rut not in buscados:
                    continue
                tramo = campos[i_tramo].strip()
                encontrados.append({
                    "rut": buscados[rut],
                    "tramo_ventas": int(tramo) if tramo.isdigit() else None,
                    "tamano": tamano_por_tramo(tramo),
                    "trabajadores": int(campos[i_trab]) if campos[i_trab].strip().isdigit() else None,
                    "rubro_sii": campos[i_rubro].strip()[:120],
                    "actividad_sii": campos[i_act].strip()[:160],
                    "comuna": campos[i_com].strip(),
                    "anio_inicio": int(campos[i_ini][:4]) if campos[i_ini][:4].isdigit() else None,
                    "anio_comercial": int(a.anio),
                })
                del buscados[rut]
                if not buscados:
                    break

    print(f"encontrados en el SII {a.anio}: {len(encontrados)} · sin registro: {len(buscados)}")
    for i in range(0, len(encontrados), 50):
        llamar("add_data_table_rows", {"dataTableId": IDS["tabla_sii"], "projectId": PROYECTO,
                                       "rows": encontrados[i:i + 50]})
    print(f"cargadas {len(encontrados)} filas en sii_referencia")


if __name__ == "__main__":
    main()
