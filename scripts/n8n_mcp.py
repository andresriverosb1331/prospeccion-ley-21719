"""Cliente mínimo del servidor MCP de n8n para enviar workflows grandes desde archivos.

Uso:
  python scripts/n8n_mcp.py validate_workflow data/raw/build/B.ts
  python scripts/n8n_mcp.py create_workflow_from_code data/raw/build/B.ts --name "B · ..." --version "v1"
  python scripts/n8n_mcp.py update_code <workflowId> data/raw/build/B.ts --version "v2"

El token se lee de la configuración local de Claude Code (~/.claude.json) y nunca se imprime
ni se guarda en el repositorio. Solo se permiten las herramientas listadas en PERMITIDAS.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

URL = "http://localhost:5678/mcp-server/http"
PERMITIDAS = {"validate_workflow", "create_workflow_from_code", "update_workflow", "get_workflow_details",
              "get_data_table_rows", "add_data_table_rows"}
IDS = json.loads((Path(__file__).resolve().parent.parent / "n8n" / "ids.local.json").read_text(encoding="utf-8"))
PROYECTO = IDS["proyecto"]


def token() -> str:
    cfg = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8"))
    for proyecto in cfg.get("projects", {}).values():
        srv = (proyecto.get("mcpServers") or {}).get("n8n")
        if srv and srv.get("url", "").startswith(URL):
            return srv["headers"]["Authorization"]
    sys.exit("No encontré el servidor MCP 'n8n' en ~/.claude.json")


def rpc(metodo: str, params: dict, sesion: str | None, auth: str, id_: int | None = 1):
    cuerpo = {"jsonrpc": "2.0", "method": metodo, "params": params}
    if id_ is not None:
        cuerpo["id"] = id_
    headers = {"Authorization": auth, "Content-Type": "application/json",
               "Accept": "application/json, text/event-stream"}
    if sesion:
        headers["mcp-session-id"] = sesion
    req = urllib.request.Request(URL, data=json.dumps(cuerpo).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=300) as r:
        sesion = r.headers.get("mcp-session-id") or sesion
        texto = r.read().decode("utf-8")
    datos = None
    for linea in texto.splitlines():
        if linea.startswith("data:"):
            datos = json.loads(linea[5:].strip())
    if datos is None and texto.strip().startswith("{"):
        datos = json.loads(texto)
    return datos, sesion


def llamar(herramienta: str, argumentos: dict) -> dict:
    if herramienta not in PERMITIDAS:
        sys.exit(f"Herramienta no permitida: {herramienta}")
    auth = token()
    _, sesion = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                                   "clientInfo": {"name": "n8n_mcp.py", "version": "1"}}, None, auth)
    rpc("notifications/initialized", {}, sesion, auth, id_=None)
    resp, _ = rpc("tools/call", {"name": herramienta, "arguments": argumentos}, sesion, auth, id_=2)
    if "error" in resp:
        sys.exit(json.dumps(resp["error"], ensure_ascii=False))
    contenido = resp["result"].get("content", [])
    texto = "".join(c.get("text", "") for c in contenido)
    if resp["result"].get("isError"):
        sys.exit(texto)
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        return {"texto": texto}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser()
    p.add_argument("accion", choices=["validate_workflow", "create_workflow_from_code", "update_code"])
    p.add_argument("args", nargs="+")
    p.add_argument("--name")
    p.add_argument("--description", default="")
    p.add_argument("--version", default="Actualización")
    a = p.parse_args()

    if a.accion == "validate_workflow":
        codigo = Path(a.args[0]).read_text(encoding="utf-8")
        print(json.dumps(llamar("validate_workflow", {"code": codigo}), ensure_ascii=False))
    elif a.accion == "create_workflow_from_code":
        codigo = Path(a.args[0]).read_text(encoding="utf-8")
        print(json.dumps(llamar("create_workflow_from_code", {
            "code": codigo, "name": a.name, "description": a.description,
            "projectId": PROYECTO, "versionName": a.version}), ensure_ascii=False))
    else:
        # Reemplaza solo el jsCode de los nodos Code del workflow existente con el del archivo compilado.
        wf_id, ruta = a.args[0], a.args[1]
        codigo = Path(ruta).read_text(encoding="utf-8")
        import re
        ops = []
        for m in re.finditer(r"name: '([^']+)',\s*position: \[[^\]]*\],\s*parameters: \{ mode: '[a-zA-Z]+', language: 'javaScript', jsCode: (\"(?:[^\"\\]|\\.)*\")", codigo):
            ops.append({"type": "setNodeParameter", "nodeName": m.group(1), "path": "/jsCode", "value": json.loads(m.group(2))})
        if not ops:
            sys.exit("No encontré nodos Code en el archivo")
        print(json.dumps(llamar("update_workflow", {"workflowId": wf_id, "operations": ops, "versionName": a.version}),
                         ensure_ascii=False))


if __name__ == "__main__":
    main()
