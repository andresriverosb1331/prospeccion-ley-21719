import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar cruce SII', position: [0, 200] },
  output: [{}]
});

const desdeOrquestador = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Llamado desde orquestador', position: [0, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'run-20261007-120000' }]
});

const leerSii = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer sii_referencia',
    position: [240, 300],
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_sii__', cachedResultName: 'sii_referencia' },
      returnAll: true
    }
  },
  output: [{ id: 1, rut: '76123456-0', tamano: 'grande', trabajadores: 250, rubro_sii: 'SALUD', comuna: 'SANTIAGO', anio_inicio: 2001 }]
});

const leerEmpresas = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer empresas',
    position: [460, 300],
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      returnAll: true
    }
  },
  output: [{ id: 7, rut: '76123456-0', comuna: '', anio_constitucion: null, tamano: null }]
});

const preparar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar actualizaciones',
    position: [680, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:a3_cruce__ }
  },
  output: [{ row_id: 7, tamano: 'grande', trabajadores: 250, rubro_sii: 'SALUD', comuna: 'SANTIAGO', anio_constitucion: 2001 }]
});

const actualizar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Actualizar empresas',
    position: [900, 300],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.row_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          tamano: expr('{{ $json.tamano }}'),
          trabajadores: expr('{{ $json.trabajadores }}'),
          rubro_sii: expr('{{ $json.rubro_sii }}'),
          comuna: expr('{{ $json.comuna }}'),
          anio_constitucion: expr('{{ $json.anio_constitucion }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'tamano', displayName: 'tamano', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'trabajadores', displayName: 'trabajadores', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'rubro_sii', displayName: 'rubro_sii', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'comuna', displayName: 'comuna', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'anio_constitucion', displayName: 'anio_constitucion', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 7 }]
});

const nota = sticky('## A3 · Cruce SII\nPasa a `empresas` el tamaño según ventas, los trabajadores y el rubro del SII. Antes, `scripts/cruce_sii.py` recorre la nómina del SII (378 MB, fuera de n8n) y carga en `sii_referencia` solo los RUT del pipeline.', [], { color: 6, position: [0, -40], width: 520, height: 180 });

export default workflow('cruce-sii', 'A3 · Cruce SII')
  .add(iniciar)
  .to(leerSii)
  .add(desdeOrquestador)
  .to(leerSii)
  .add(leerSii)
  .to(leerEmpresas)
  .to(preparar)
  .to(actualizar)
  .add(nota);
