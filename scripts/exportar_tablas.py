"""Exporta las Data Tables `empresas` y `corridas` de n8n a data/raw/*.csv (carpeta ignorada por git).

Uso: python scripts/exportar_tablas.py
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from n8n_mcp import IDS, PROYECTO, llamar  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
TABLAS = {"empresas": IDS["tabla_empresas"], "corridas": IDS["tabla_corridas"]}


def leer_todo(tabla_id: str) -> list[dict]:
    filas, salto = [], 0
    while True:
        r = llamar("get_data_table_rows", {"dataTableId": tabla_id, "projectId": PROYECTO,
                                           "limit": 100, "skip": salto, "sortBy": "id:asc"})
        filas.extend(r["rows"])
        salto += len(r["rows"])
        if not r["rows"] or salto >= r["count"]:
            return filas


def main() -> None:
    destino = RAIZ / "data" / "raw"
    destino.mkdir(parents=True, exist_ok=True)
    for nombre, tabla_id in TABLAS.items():
        filas = leer_todo(tabla_id)
        columnas = sorted({c for f in filas for c in f})
        with open(destino / f"{nombre}.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=columnas)
            w.writeheader()
            w.writerows(filas)
        print(f"{nombre}: {len(filas)} filas -> data/raw/{nombre}.csv")


if __name__ == "__main__":
    main()
