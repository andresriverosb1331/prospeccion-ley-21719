"""Mide cuánto coincide la calificación de la IA con una etiqueta humana.

1. python analysis/eval_agreement.py --preparar      -> crea data/raw/eval.csv (hasta 20 empresas con sitio)
2. Una persona completa la columna `etiqueta_humana` con: calificada | revision | descartada
   (y opcionalmente `sitio_correcto` con si | no).
3. python analysis/eval_agreement.py                -> acuerdo, matriz de confusión y casos en desacuerdo

El archivo de evaluación queda en data/raw/ (no se publica). El resultado agregado sí puede publicarse.
"""

import argparse
import csv
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
EMPRESAS = RAIZ / "data" / "raw" / "empresas.csv"
EVAL = RAIZ / "data" / "raw" / "eval.csv"
ESTADOS = ["calificada", "revision", "descartada"]
COLUMNAS = ["id", "razon_social", "dominio", "rubro_ia", "score_ia", "estado_ia", "motivo_ia",
            "etiqueta_humana", "sitio_correcto", "comentario"]


def preparar(n: int) -> None:
    with open(EMPRESAS, encoding="utf-8") as fh:
        filas = [f for f in csv.DictReader(fh) if f.get("estado") in ESTADOS]
    filas.sort(key=lambda f: -float(f.get("score") or 0))
    with open(EVAL, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNAS)
        w.writeheader()
        for f in filas[:n]:
            w.writerow({"id": f["id"], "razon_social": f["razon_social"], "dominio": f["dominio"],
                        "rubro_ia": f["rubro"], "score_ia": f["score"], "estado_ia": f["estado"],
                        "motivo_ia": f["motivo"], "etiqueta_humana": "", "sitio_correcto": "", "comentario": ""})
    print(f"{min(n, len(filas))} empresas en data/raw/eval.csv: completa `etiqueta_humana`.")


def evaluar(ruta: Path) -> dict:
    with open(ruta, encoding="utf-8") as fh:
        filas = [f for f in csv.DictReader(fh) if f.get("etiqueta_humana", "").strip()]
    if not filas:
        raise SystemExit("No hay filas con `etiqueta_humana`: etiqueta primero data/raw/eval.csv")
    pares = Counter((f["estado_ia"], f["etiqueta_humana"].strip().lower()) for f in filas)
    acuerdo = sum(c for (ia, hum), c in pares.items() if ia == hum) / len(filas)
    # Precisión de "calificada": de lo que la IA mandó a ventas, cuánto lo habría mandado una persona.
    ia_calif = [f for f in filas if f["estado_ia"] == "calificada"]
    precision = (sum(f["etiqueta_humana"].strip().lower() == "calificada" for f in ia_calif) / len(ia_calif)
                 if ia_calif else None)
    con_sitio = [f for f in filas if f.get("sitio_correcto", "").strip()]
    sitio_ok = (sum(f["sitio_correcto"].strip().lower() == "si" for f in con_sitio) / len(con_sitio)
                if con_sitio else None)
    desacuerdos = [f for f in filas if f["estado_ia"] != f["etiqueta_humana"].strip().lower()]
    return {"n": len(filas), "acuerdo": acuerdo, "precision_calificada": precision,
            "sitio_correcto": sitio_ok, "matriz": pares, "desacuerdos": desacuerdos}


def imprimir(r: dict) -> None:
    pct = lambda x: "n/a" if x is None else f"{100 * x:.0f}%"  # noqa: E731
    print(f"Empresas etiquetadas: {r['n']}")
    print(f"Acuerdo IA vs. persona: {pct(r['acuerdo'])}")
    print(f"Precisión de 'calificada': {pct(r['precision_calificada'])}")
    print(f"Dominio correcto (según la persona): {pct(r['sitio_correcto'])}")
    print("\nMatriz de confusión (filas = IA, columnas = persona):")
    print("            " + "".join(f"{e:>12}" for e in ESTADOS))
    for ia in ESTADOS:
        print(f"{ia:>12}" + "".join(f"{r['matriz'].get((ia, h), 0):>12}" for h in ESTADOS))
    if r["desacuerdos"]:
        print("\nDesacuerdos para revisar el prompt o la rúbrica:")
        for f in r["desacuerdos"]:
            print(f"  - {f['razon_social']}: IA={f['estado_ia']} ({f['score_ia']}), persona={f['etiqueta_humana']}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--preparar", action="store_true")
    p.add_argument("--n", type=int, default=20)
    p.add_argument("--archivo", default=str(EVAL))
    a = p.parse_args()
    if a.preparar:
        preparar(a.n)
    else:
        imprimir(evaluar(Path(a.archivo)))


if __name__ == "__main__":
    main()
