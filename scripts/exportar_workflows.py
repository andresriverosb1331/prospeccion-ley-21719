"""Exporta los workflows del pipeline a workflows/*.json, listos para importar en otro n8n y sin secretos.

Se eliminan: IDs de credenciales (queda solo el tipo y un nombre genérico), webhookId, instanceId,
pinData, IDs de versión y metadatos del proyecto. Los IDs de Data Tables se reemplazan por sus nombres.

Uso: python scripts/exportar_workflows.py
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from n8n_mcp import IDS, llamar  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
WORKFLOWS = {
    "A_ingesta": IDS["wf_a"],
    "A2_regulados": IDS["wf_a2"],
    "A3_cruce_sii": IDS["wf_a3"],
    "B_enriquecimiento": IDS["wf_b"],
    "C_calificacion": IDS["wf_c"],
    "D0_crear_planilla": IDS["wf_d0"],
    "D_exportar_sheets": IDS["wf_d"],
    "E_orquestador": IDS["wf_e"],
    "Z_errores": IDS["wf_z"],
}
# IDs internos de esta instancia -> marcadores legibles al importar.
REEMPLAZOS = {
    IDS["tabla_empresas"]: "TABLA_EMPRESAS",
    IDS["tabla_corridas"]: "TABLA_CORRIDAS",
    IDS["planilla"]: "ID_PLANILLA",
    IDS["tabla_sii"]: "TABLA_SII_REFERENCIA",
    **{v: f"WORKFLOW_{k.upper()}" for k, v in WORKFLOWS.items()},
}
CAMPOS_WORKFLOW = ("name", "nodes", "connections", "settings")


def limpiar_nodo(nodo: dict) -> dict:
    nodo = {k: v for k, v in nodo.items() if k not in ("webhookId", "id")}
    if "credentials" in nodo:
        nodo["credentials"] = {tipo: {"name": f"<tu credencial {tipo}>"} for tipo in nodo["credentials"]}
    return nodo


def limpiar(wf: dict) -> dict:
    salida = {k: wf[k] for k in CAMPOS_WORKFLOW if k in wf}
    salida["nodes"] = [limpiar_nodo(n) for n in salida.get("nodes", [])]
    ajustes = dict(salida.get("settings") or {})
    ajustes.pop("errorWorkflow", None)
    salida["settings"] = ajustes
    texto = json.dumps(salida, ensure_ascii=False, indent=2)
    for viejo, nuevo in REEMPLAZOS.items():
        texto = texto.replace(viejo, nuevo)
    return json.loads(texto)


def main() -> None:
    destino = RAIZ / "workflows"
    destino.mkdir(exist_ok=True)
    for nombre, wf_id in WORKFLOWS.items():
        r = llamar("get_workflow_details", {"workflowId": wf_id, "detailLevel": "full"})
        wf = limpiar(r["workflow"])
        (destino / f"{nombre}.json").write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        restos = re.findall(r'"id":\s*"[A-Za-z0-9]{16}"', json.dumps(wf))
        print(f"{nombre}.json: {len(wf['nodes'])} nodos" + (f" · ATENCIÓN restos de IDs: {restos}" if restos else ""))


if __name__ == "__main__":
    main()
