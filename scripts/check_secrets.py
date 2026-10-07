"""Revisa el repositorio en busca de secretos y datos personales antes de publicarlo.

Uso:  python scripts/check_secrets.py [ruta]
Sale con código 1 si encuentra algo. Respeta .gitignore de forma simple
(ignora las carpetas listadas ahí) además de .git/ y los entornos virtuales.
"""

import re
import sys
from pathlib import Path

REGLAS = [
    ("JWT", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
    ("OpenAI/Anthropic key", re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}")),
    ("Bearer token", re.compile(r"Bearer\s+[A-Za-z0-9._~+/-]{20,}=*")),
    ("Clave con valor", re.compile(
        r"""(?i)["']?(api[_-]?key|apikey|secret|password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\s]{8,}["']""")),
    ("Llave privada", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("Credencial n8n", re.compile(r'"credentials"\s*:\s*\{\s*"[A-Za-z0-9]+"\s*:\s*\{\s*"id"\s*:\s*"[A-Za-z0-9]{8,}"')),
    ("Email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
]

# Una línea con esta marca se omite (solo para datos ficticios de tests, con su justificación al lado).
MARCA_IGNORAR = "check-secrets: ignorar"

RUT = re.compile(r"\b(\d{1,2}\.?\d{3}\.?\d{3})-([\dkK])\b")

# Correos que pueden aparecer legítimamente (ejemplos y atribuciones).
EMAIL_PERMITIDOS = re.compile(r"(?i)@(example\.(com|cl|org)|anthropic\.com|users\.noreply\.github\.com)$")

EXTENSIONES = {".py", ".js", ".json", ".md", ".csv", ".sql", ".txt", ".yml", ".yaml", ".html", ".env", ".toml", ".ini", ".cfg", ""}
SIEMPRE_IGNORAR = {".git", ".venv", "venv", "node_modules", "__pycache__"}


def carpetas_ignoradas(raiz: Path) -> set[str]:
    ignoradas = set(SIEMPRE_IGNORAR)
    gi = raiz / ".gitignore"
    if gi.exists():
        for linea in gi.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and linea.endswith("/"):
                ignoradas.add(linea.rstrip("/"))
    return ignoradas


def archivo_ignorado(rel: Path, raiz: Path) -> bool:
    gi = raiz / ".gitignore"
    if not gi.exists():
        return False
    for linea in gi.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or linea.endswith("/"):
            continue
        if rel.match(linea) or rel.as_posix() == linea:
            return True
    return False


def ids_locales(raiz: Path) -> dict[str, str]:
    """IDs de la instancia de n8n (n8n/ids.local.json): no deben aparecer en archivos publicables."""
    archivo = raiz / "n8n" / "ids.local.json"
    if not archivo.exists():
        return {}
    import json
    return {v: k for k, v in json.loads(archivo.read_text(encoding="utf-8")).items() if isinstance(v, str) and len(v) >= 8}


def es_rut_persona_natural(match: re.Match) -> bool:
    cuerpo = int(match.group(1).replace(".", ""))
    return cuerpo < 50_000_000


def revisar(raiz: Path) -> list[tuple[str, int, str, str]]:
    hallazgos = []
    ignoradas = carpetas_ignoradas(raiz)
    ids = ids_locales(raiz)
    for ruta in sorted(raiz.rglob("*")):
        rel = ruta.relative_to(raiz)
        if not ruta.is_file():
            continue
        if any(parte in ignoradas for parte in rel.parts[:-1]) or any(
            rel.as_posix().startswith(c + "/") for c in ignoradas
        ):
            continue
        if archivo_ignorado(rel, raiz) or ruta.suffix.lower() not in EXTENSIONES:
            continue
        if rel.as_posix() == "scripts/check_secrets.py":
            continue
        try:
            texto = ruta.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for n, linea in enumerate(texto.splitlines(), 1):
            if MARCA_IGNORAR in linea:
                continue
            for nombre, patron in REGLAS:
                for m in patron.finditer(linea):
                    if nombre == "Email" and EMAIL_PERMITIDOS.search(m.group(0)):
                        continue
                    hallazgos.append((rel.as_posix(), n, nombre, m.group(0)[:12] + "…"))
            for valor, nombre_id in ids.items():
                if valor in linea:
                    hallazgos.append((rel.as_posix(), n, f"ID local de n8n ({nombre_id})", valor[:4] + "…"))
            for m in RUT.finditer(linea):
                if es_rut_persona_natural(m):
                    hallazgos.append((rel.as_posix(), n, "RUT persona natural", m.group(0)[:4] + "…"))
    return hallazgos


def main() -> int:
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    hallazgos = revisar(raiz)
    if not hallazgos:
        print(f"OK: sin secretos ni datos personales en {raiz}")
        return 0
    print(f"ATENCIÓN: {len(hallazgos)} hallazgo(s):")
    for archivo, linea, tipo, muestra in hallazgos:
        print(f"  {archivo}:{linea}  [{tipo}]  {muestra}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
