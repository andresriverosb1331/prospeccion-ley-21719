// Nodo "Armar fila de error" (workflow Z · Registro de errores). Recibe la salida del Error Trigger.
const d = $input.first().json;
const ejecucion = d.execution || {};
const flujo = d.workflow || {};
const mensaje = String((ejecucion.error && ejecucion.error.message) || 'sin mensaje').slice(0, 300);
const ahora = new Date().toISOString();
return [{
  json: {
    run_id: 'exec-' + (ejecucion.id || 'desconocida'),
    etapa: 'error',
    inicio: ahora,
    fin: ahora,
    errores: 1,
    nota: (flujo.name || 'workflow desconocido') + ' | nodo: ' + (ejecucion.lastNodeExecuted || '?') + ' | ' + mensaje,
  },
}];
