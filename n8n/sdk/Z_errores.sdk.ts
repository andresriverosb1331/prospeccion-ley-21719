import { workflow, node, trigger, sticky } from '@n8n/workflow-sdk';

const alFallar = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Cuando un workflow falla', position: [0, 300] },
  output: [{ execution: { id: '42', lastNodeExecuted: 'Nodo', error: { message: 'Error de ejemplo' } }, workflow: { id: 'w', name: 'Workflow' } }]
});

const fila = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Armar fila de error',
    position: [240, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:error_fila__ }
  },
  output: [{ run_id: 'exec-42', etapa: 'error', inicio: '2026-10-07T12:00:00Z', fin: '2026-10-07T12:00:00Z', errores: 1, nota: 'Workflow | nodo: Nodo | Error' }]
});

const registrar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar error',
    position: [480, 300],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_corridas__', cachedResultName: 'corridas' },
      columns: {
        mappingMode: 'autoMapInputData',
        value: {},
        matchingColumns: [],
        schema: [
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'etapa', displayName: 'etapa', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'inicio', displayName: 'inicio', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true },
          { id: 'fin', displayName: 'fin', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true },
          { id: 'errores', displayName: 'errores', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'nota', displayName: 'nota', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1 }]
});

const nota = sticky('## Z · Registro de errores\nWorkflow de error compartido por A, B, C, D y E: cada ejecución de producción que falla deja una fila `etapa=error` en la tabla `corridas` con el workflow, el nodo y el mensaje.', [], { color: 2, position: [0, 80], width: 520, height: 160 });

export default workflow('registro-errores', 'Z · Registro de errores')
  .add(alFallar)
  .to(fila)
  .to(registrar)
  .add(nota);
