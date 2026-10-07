import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar ingesta', position: [0, 300] },
  output: [{}]
});

const desdeOrquestador = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Llamado desde orquestador', position: [0, 500], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'run-20261007-120000', limite: 50 }]
});

const parametros = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Parámetros',
    position: [220, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'p-anio', name: 'anio', value: 2018, type: 'number' },
          { id: 'p-url', name: 'csv_url', value: 'https://datos.gob.cl/dataset/363edd60-4919-4ff1-b85f-f8e14d61285a/resource/ca45026b-4dde-44b0-8725-64446a95f69d/download/2018-sociedades-por-fecha-rut-constitucion-v2.csv', type: 'string' },
          { id: 'p-cap', name: 'capital_min', value: 50000000, type: 'number' },
          { id: 'p-reg', name: 'regiones', value: '13,5,8', type: 'string' },
          { id: 'p-lim', name: 'limite', value: expr('{{ $json.limite || 50 }}'), type: 'number' },
          { id: 'p-run', name: 'run_id', value: expr('{{ $json.run_id || ("run-" + $now.toFormat("yyyyLLdd-HHmmss")) }}'), type: 'string' },
          { id: 'p-ini', name: 'inicio', value: expr('{{ $now.toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ anio: 2018, csv_url: 'https://datos.gob.cl/x.csv', capital_min: 50000000, regiones: '13,5,8', limite: 50, run_id: 'run-20261007-120000', inicio: '2026-10-07T12:00:00.000-03:00' }]
});

const leerClaves = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer claves existentes',
    position: [440, 300],
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      returnAll: true
    }
  },
  output: [{ id: 1, dedup_key: 'rut:78325555-3' }]
});

const descargar = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Descargar CSV RES',
    position: [660, 300],
    executeOnce: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'GET',
      url: expr('{{ $("Parámetros").first().json.csv_url }}'),
      options: {
        timeout: 120000,
        response: { response: { responseFormat: 'text', outputPropertyName: 'csv' } }
      }
    }
  },
  output: [{ csv: 'ID;RUT;Razon Social\n1;78325555-3;Ejemplo SpA' }]
});

const parsear = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parsear y normalizar',
    position: [880, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:ingesta_parsear__ }
  },
  output: [{ sin_nuevas: false, rut: '78325555-3', razon_social: 'Ejemplo SpA', nombre_norm: 'ejemplo', dedup_key: 'rut:78325555-3', comuna: 'SANTIAGO', region: '13', capital: 60000000, anio_constitucion: 2018, tipo_sociedad: 'SpA', fuente: 'RES datos.gob.cl', estado: 'nueva', run_id: 'run-20261007-120000', meta_filas: 100, meta_constituciones: 100 }]
});

const hayNuevas = ifElse({
  version: 2.2,
  config: {
    name: '¿Hay empresas nuevas?',
    position: [1100, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.sin_nuevas }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const guardar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar empresas nuevas',
    position: [1320, 200],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          rut: expr('{{ $json.rut }}'),
          razon_social: expr('{{ $json.razon_social }}'),
          nombre_norm: expr('{{ $json.nombre_norm }}'),
          dedup_key: expr('{{ $json.dedup_key }}'),
          comuna: expr('{{ $json.comuna }}'),
          region: expr('{{ $json.region }}'),
          capital: expr('{{ $json.capital }}'),
          anio_constitucion: expr('{{ $json.anio_constitucion }}'),
          tipo_sociedad: expr('{{ $json.tipo_sociedad }}'),
          fuente: expr('{{ $json.fuente }}'),
          estado: expr('{{ $json.estado }}'),
          run_id: expr('{{ $json.run_id }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'rut', displayName: 'rut', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'razon_social', displayName: 'razon_social', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'nombre_norm', displayName: 'nombre_norm', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'dedup_key', displayName: 'dedup_key', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'comuna', displayName: 'comuna', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'region', displayName: 'region', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'capital', displayName: 'capital', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'anio_constitucion', displayName: 'anio_constitucion', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'tipo_sociedad', displayName: 'tipo_sociedad', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fuente', displayName: 'fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'estado', displayName: 'estado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1, createdAt: '2026-10-07T12:00:00.000Z', updatedAt: '2026-10-07T12:00:00.000Z' }]
});

const resumen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumen de ingesta',
    position: [1540, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:ingesta_resumen__ }
  },
  output: [{ run_id: 'run-20261007-120000', etapa: 'ingesta', inicio: '2026-10-07T12:00:00.000Z', fin: '2026-10-07T12:01:00.000Z', procesadas: 100, nuevas: 50, duplicadas: 0, excluidas: 3, errores: 0, nota: 'filas=100' }]
});

const registrar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar corrida',
    position: [1760, 300],
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
          { id: 'procesadas', displayName: 'procesadas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'nuevas', displayName: 'nuevas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'duplicadas', displayName: 'duplicadas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'excluidas', displayName: 'excluidas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'errores', displayName: 'errores', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'nota', displayName: 'nota', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1 }]
});

const nota = sticky('## A · Ingesta\nDescarga el Registro de Empresas y Sociedades (datos.gob.cl, CC-BY), valida RUT, excluye personas naturales y EIRL, filtra por región y capital, deduplica contra la tabla `empresas` y guarda las nuevas con estado `nueva`. Ajusta año, capital y regiones en **Parámetros**.', [], { color: 4, position: [0, 0], width: 520, height: 200 });

export default workflow('ingesta-res', 'A · Ingesta RES')
  .add(iniciar)
  .to(parametros)
  .add(desdeOrquestador)
  .to(parametros)
  .add(parametros)
  .to(leerClaves)
  .to(descargar)
  .to(parsear)
  .to(hayNuevas
    .onTrue(guardar.to(resumen))
    .onFalse(resumen))
  .add(resumen)
  .to(registrar)
  .add(nota)
  .group('Descarga y normalización', [parametros, leerClaves, descargar, parsear], { description: 'Lee el CSV oficial, valida RUT, excluye personas naturales/EIRL y deduplica contra la tabla empresas' })
  .group('Métricas de la corrida', [resumen, registrar], { description: 'Resume la corrida (nuevas, duplicadas, excluidas) y la registra en la tabla corridas' });
