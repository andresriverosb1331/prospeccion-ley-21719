"""Inserta el código de los nodos Code en un archivo SDK de workflow.

En el archivo SDK, `__CODE:nombre__` se reemplaza por el contenido de
n8n/code/nombre.js como literal de string JS. Si la primera línea dice
"Requiere lib/a.js, lib/b.js", se anteponen esas librerías (sin
'use strict' ni module.exports), porque el nodo Code de n8n no puede
importar archivos locales.

Uso: python scripts/build_code.py n8n/sdk/A_ingesta.sdk.ts  -> imprime a stdout
     python scripts/build_code.py n8n/sdk/A_ingesta.sdk.ts --out build/A.ts
"""

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def lib_inline(ruta: str) -> str:
    src = (RAIZ / ruta).read_text(encoding="utf-8")
    src = src.replace("'use strict';", "")
    src = re.sub(r"module\.exports\s*=\s*\{[^}]*\};\s*", "", src, flags=re.S)
    return src.strip() + "\n\n"


def codigo(nombre: str) -> str:
    texto = (RAIZ / "n8n" / "code" / f"{nombre}.js").read_text(encoding="utf-8")
    primera = texto.splitlines()[0]
    if "Requiere" in primera:
        texto = "".join(lib_inline(r) for r in re.findall(r"lib/[a-z_]+\.js", primera)) + texto
    # ensure_ascii: el parser del SDK recibe solo ASCII (tildes, BOM y rangos Unicode quedan como \uXXXX)
    return json.dumps(texto, ensure_ascii=True)


def main() -> None:
    sdk = Path(sys.argv[1])
    # --stub deja los nodos Code vacíos: sirve para validar solo la estructura del workflow.
    reemplazo = (lambda m: json.dumps("return $input.all();")) if "--stub" in sys.argv else (lambda m: codigo(m.group(1)))
    salida = re.sub(r"__CODE:([a-z0-9_]+)__", reemplazo, sdk.read_text(encoding="utf-8"))
    # IDs de la instancia: viven en n8n/ids.local.json (ignorado por git).
    ids = json.loads((RAIZ / "n8n" / "ids.local.json").read_text(encoding="utf-8"))
    salida = re.sub(r"__ID:([a-z0-9_]+)__", lambda m: ids[m.group(1)], salida)
    if "--out" in sys.argv:
        destino = Path(sys.argv[sys.argv.index("--out") + 1])
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(salida, encoding="utf-8")
        print(f"escrito {destino} ({len(salida)} caracteres)")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(salida)


if __name__ == "__main__":
    main()
