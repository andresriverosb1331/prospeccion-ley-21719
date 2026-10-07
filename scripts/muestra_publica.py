"""Genera la muestra publicable data/sample/empresas_sample.csv desde data/raw/empresas.csv.

Reglas de la muestra (el repositorio es público):
- Solo personas jurídicas del Registro de Empresas y Sociedades (dato público, licencia CC-BY).
- Solo empresas cuyo sitio fue verificado y que la IA NO marcó como ajeno (no se asocia
  públicamente una empresa a un sitio que no es suyo).
- Solo campos estructurados: sin extracto del sitio, sin texto libre de la IA, sin títulos de página.
- Máximo 20 filas.

Uso: python scripts/muestra_publica.py
"""

import csv
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "data" / "raw" / "empresas.csv"
DESTINO = RAIZ / "data" / "sample" / "empresas_sample.csv"
SENALES = ["politica_privacidad", "menciona_ley_nueva", "banner_cookies", "trackers", "formularios_datos",
           "login", "tienda_online", "agenda_online", "sitio_minimo"]
COLUMNAS = ["rut", "razon_social", "region", "anio_constitucion", "dominio", "verificacion", *SENALES,
            "rubro", "score", "estado"]


def main() -> None:
    with open(ORIGEN, encoding="utf-8") as fh:
        filas = list(csv.DictReader(fh))
    elegibles = [
        f for f in filas
        if f.get("dominio") and f.get("senales_json") and "sitio_no_corresponde" not in (f.get("error") or "")
        and int(f["rut"].split("-")[0]) >= 50_000_000
    ]
    elegibles.sort(key=lambda f: -float(f.get("score") or f.get("score_reglas") or 0))
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    with open(DESTINO, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        for f in elegibles[:20]:
            s = json.loads(f["senales_json"])
            w.writerow({
                "rut": f["rut"], "razon_social": f["razon_social"], "region": f["region"],
                "anio_constitucion": int(float(f["anio_constitucion"])) if f.get("anio_constitucion") else "",
                "dominio": f["dominio"], "verificacion": s.get("verificacion", ""),
                **{k: int(bool(s.get(k))) for k in SENALES},
                "rubro": f.get("rubro") or "", "score": f.get("score") or "", "estado": f["estado"],
            })
    print(f"{min(20, len(elegibles))} filas -> data/sample/empresas_sample.csv "
          f"(de {len(filas)} empresas; {len(elegibles)} elegibles)")


if __name__ == "__main__":
    main()
