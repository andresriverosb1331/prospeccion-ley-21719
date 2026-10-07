import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar pipeline', position: [0, 300] },
  output: [{}]
});

const parametros = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Parámetros E',
    position: [220, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'e-run', name: 'run_id', value: expr('{{ "run-" + $now.toFormat("yyyyLLdd-HHmmss") }}'), type: 'string' },
          { id: 'e-lim', name: 'limite', value: 50, type: 'number' },
          { id: 'e-fue', name: 'fuente', value: 'regulados', type: 'string' },
          { id: 'e-ini', name: 'inicio', value: expr('{{ $now.toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000', limite: 50, fuente: 'regulados', inicio: '2026-10-07T12:00:00.000-03:00' }]
});

const elegirFuente = ifElse({
  version: 2.2,
  config: {
    name: '¿Fuente regulados?',
    position: [330, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.fuente }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'regulados' }],
        combinator: 'and'
      }
    }
  }
});

const ejecutarA2 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Ejecutar A2 · Regulados',
    position: [440, 140],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: '__ID:wf_a2__', cachedResultName: 'A2 · Ingesta sectores regulados' }, options: { waitForSubWorkflow: true } }
  },
  output: [{ id: 1 }]
});

const ejecutarA3 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Ejecutar A3 · Cruce SII',
    position: [550, 140],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: '__ID:wf_a3__', cachedResultName: 'A3 · Cruce SII' }, options: { waitForSubWorkflow: true } }
  },
  output: [{ id: 2 }]
});

const ejecutarA = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Ejecutar A · Ingesta',
    position: [440, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: '__ID:wf_a__', cachedResultName: 'A · Ingesta RES' }, options: { waitForSubWorkflow: true } }
  },
  output: [{ id: 1 }]
});

const contextoB = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Contexto B',
    position: [660, 300],
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cb-run', name: 'run_id', value: expr('{{ $("Parámetros E").first().json.run_id }}'), type: 'string' },
          { id: 'cb-lim', name: 'limite', value: expr('{{ $("Parámetros E").first().json.limite }}'), type: 'number' },
          { id: 'cb-rep', name: 'reprocesar', value: false, type: 'boolean' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000', limite: 50, reprocesar: false }]
});

const ejecutarB = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Ejecutar B · Enriquecimiento',
    position: [880, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: '__ID:wf_b__', cachedResultName: 'B · Dominio y enriquecimiento' }, options: { waitForSubWorkflow: true } }
  },
  output: [{ id: 2 }]
});

const contextoC = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Contexto C',
    position: [1100, 300],
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cc-run', name: 'run_id', value: expr('{{ $("Parámetros E").first().json.run_id }}'), type: 'string' },
          { id: 'cc-lim', name: 'limite', value: expr('{{ $("Parámetros E").first().json.limite }}'), type: 'number' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000', limite: 50 }]
});

const ejecutarC = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Ejecutar C · Calificación',
    position: [1320, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: '__ID:wf_c__', cachedResultName: 'C · Calificación con IA' }, options: { waitForSubWorkflow: true } }
  },
  output: [{ id: 3 }]
});

const contextoD = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Contexto D',
    position: [1540, 300],
    executeOnce: true,
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cd-run', name: 'run_id', value: expr('{{ $("Parámetros E").first().json.run_id }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000' }]
});

const ejecutarD = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.4,
  config: {
    name: 'Ejecutar D · Sheets',
    position: [1760, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: '__ID:wf_d__', cachedResultName: 'D · Exportar a Google Sheets' }, options: { waitForSubWorkflow: true } }
  },
  output: [{ Empresa: 'SIMELEC SPA' }]
});

const resumen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumen del pipeline',
    position: [1980, 300],
    executeOnce: true,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:pipeline_resumen__ }
  },
  output: [{ run_id: 'run-20261007-120000', etapa: 'pipeline', errores: 0, nota: 'ingesta=ok | enriquecimiento=ok | calificacion=ok | sheets=ok' }]
});

const registrar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar corrida del pipeline',
    position: [2200, 300],
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

const nota = sticky('## E · Orquestador\nEjecuta la ingesta (A2 → A3 con `fuente=regulados`, o A con `fuente=res`) y luego B → C → D con un mismo `run_id`. Antes de A3, `scripts/cruce_sii.py` debe haber cargado `sii_referencia`. Si una etapa falla, el pipeline sigue con lo que hay en la tabla `empresas` y el fallo queda en la fila `etapa=pipeline` de `corridas`. Ajusta el tamaño del lote en **Parámetros E**.', [], { color: 7, position: [0, 80], width: 560, height: 180 });

export default workflow('orquestador', 'E · Orquestador del pipeline')
  .add(iniciar)
  .to(parametros)
  .to(elegirFuente
    .onTrue(ejecutarA2.to(ejecutarA3.to(contextoB)))
    .onFalse(ejecutarA.to(contextoB)))
  .add(contextoB)
  .to(ejecutarB)
  .to(contextoC)
  .to(ejecutarC)
  .to(contextoD)
  .to(ejecutarD)
  .to(resumen)
  .to(registrar)
  .add(nota)
  .group('Enriquecimiento', [contextoB, ejecutarB], { description: 'Busca el dominio y las señales de cumplimiento de las empresas nuevas' })
  .group('Calificación y entrega', [contextoC, ejecutarC, contextoD, ejecutarD], { description: 'Califica con IA y reescribe la planilla de Google Sheets' })
  .group('Métricas', [resumen, registrar], { description: 'Registra el estado de cada etapa en la tabla corridas' });
