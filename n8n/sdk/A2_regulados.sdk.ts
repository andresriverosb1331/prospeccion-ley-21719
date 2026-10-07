import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const UA = { parameters: [{ name: 'User-Agent', value: 'ProspeccionLey21719Bot/0.1 (respeta robots.txt)' }] };

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar ingesta A2', position: [0, 200] },
  output: [{}]
});

const desdeOrquestador = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Llamado desde orquestador', position: [0, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'run-20261007-120000', limite_salud: 40, limite_cmf: 40 }]
});

const parametros = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Parámetros A2',
    position: [220, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'a2-run', name: 'run_id', value: expr('{{ $json.run_id || ("run-" + $now.toFormat("yyyyLLdd-HHmmss")) }}'), type: 'string' },
          { id: 'a2-ls', name: 'limite_salud', value: expr('{{ $json.limite_salud ?? 40 }}'), type: 'number' },
          { id: 'a2-lc', name: 'limite_cmf', value: expr('{{ $json.limite_cmf ?? 40 }}'), type: 'number' },
          { id: 'a2-ic', name: 'incluir_cmf', value: expr('{{ $json.incluir_cmf ?? true }}'), type: 'boolean' },
          { id: 'a2-ini', name: 'inicio', value: expr('{{ $now.toISO() }}'), type: 'string' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000', limite_salud: 40, limite_cmf: 40, incluir_cmf: true, inicio: '2026-10-07T12:00:00Z' }]
});

const leerExistentes = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer empresas existentes',
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
  output: [{ id: 1, dedup_key: 'rut:76123456-0', ref_fuente: 'https://www.superdesalud.gob.cl/registro/x/' }]
});

const consultarCmf = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Consultar CMF',
    position: [660, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://www.cmfchile.cl/institucional/estadisticas/seg_rgpsf_ajax.php?f=servFiltrosPLSQL&tipo=J&estado=VI',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: UA,
      sendBody: true,
      contentType: 'form-urlencoded',
      bodyParameters: { parameters: [
        { name: 'tipo_busqueda', value: 'J' }, { name: 'rut_ENT', value: '' }, { name: 'nombre_ENT', value: '' },
        { name: 'servicio_ENT', value: '' }, { name: 'Estado', value: 'VI' }
      ] },
      options: { timeout: 60000, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } } }
    }
  },
  output: [{ data: '[{"per_rut":"78076117","per_nombre":"FINTECH SPA","per_serv_4":"Autorizado","per_estado":"Vigente"}]' }]
});

const listadoSalud = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Listado nacional de Salud',
    position: [880, 300],
    executeOnce: true,
    parameters: {
      method: 'GET',
      url: 'https://www.superdesalud.gob.cl/tax-registros/registro-de-prestadores-acreditados-4329/nacional-4258/',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: UA,
      options: { timeout: 60000, response: { response: { responseFormat: 'text', outputPropertyName: 'html' } } }
    }
  },
  output: [{ html: '<a href="https://www.superdesalud.gob.cl/registro/clinica-x/">Clínica X</a>' }]
});

const elegir = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Elegir fichas de Salud',
    position: [1100, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:a2_elegir_fichas__ }
  },
  output: [{ nombre: 'Clínica X', url: 'https://www.superdesalud.gob.cl/registro/clinica-x/', listado_total: 300, ya_conocidas: 0 }]
});

const ficha = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Descargar ficha',
    position: [1320, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: UA,
      options: {
        timeout: 15000,
        batching: { batch: { batchSize: 1, batchInterval: 1000 } },
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } }
      }
    }
  },
  output: [{ statusCode: 200, body: '<html></html>', headers: {} }]
});

const unificar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Unificar fuentes',
    position: [1540, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:a2_unificar__ }
  },
  output: [{ sin_nuevas: false, rut: '76123456-0', razon_social: 'Clínica X SpA', nombre_norm: 'clinica x', dedup_key: 'rut:76123456-0', fuente: 'Superintendencia de Salud', estado: 'nueva', run_id: 'run', fuente_lista: 'Superintendencia de Salud', rubro_fuente: 'salud', sitio_fuente: 'clinicax.cl', tipo_fuente: 'Prestador acreditado', ref_fuente: 'https://www.superdesalud.gob.cl/registro/clinica-x/', nombre_comercial: 'Clínica X' }]
});

const hayNuevas = ifElse({
  version: 2.2,
  config: {
    name: '¿Hay empresas nuevas?',
    position: [1760, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.sin_nuevas }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const COLUMNAS = ['rut', 'razon_social', 'nombre_norm', 'dedup_key', 'fuente', 'estado', 'run_id', 'fuente_lista',
  'rubro_fuente', 'sitio_fuente', 'tipo_fuente', 'ref_fuente', 'nombre_comercial'];

const guardar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar empresas nuevas',
    position: [1980, 200],
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
          fuente: expr('{{ $json.fuente }}'),
          estado: expr('{{ $json.estado }}'),
          run_id: expr('{{ $json.run_id }}'),
          fuente_lista: expr('{{ $json.fuente_lista }}'),
          rubro_fuente: expr('{{ $json.rubro_fuente }}'),
          sitio_fuente: expr('{{ $json.sitio_fuente }}'),
          tipo_fuente: expr('{{ $json.tipo_fuente }}'),
          ref_fuente: expr('{{ $json.ref_fuente }}'),
          nombre_comercial: expr('{{ $json.nombre_comercial || "" }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'rut', displayName: 'rut', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'razon_social', displayName: 'razon_social', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'nombre_norm', displayName: 'nombre_norm', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'dedup_key', displayName: 'dedup_key', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fuente', displayName: 'fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'estado', displayName: 'estado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'run_id', displayName: 'run_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'fuente_lista', displayName: 'fuente_lista', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'rubro_fuente', displayName: 'rubro_fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'sitio_fuente', displayName: 'sitio_fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'tipo_fuente', displayName: 'tipo_fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'ref_fuente', displayName: 'ref_fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'nombre_comercial', displayName: 'nombre_comercial', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1 }]
});

const resumen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumen de ingesta A2',
    position: [2200, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:a2_resumen__ }
  },
  output: [{ run_id: 'run', etapa: 'ingesta_regulados', nuevas: 40, nota: 'por_fuente={}' }]
});

const registrar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar corrida A2',
    position: [2420, 300],
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

const nota = sticky('## A2 · Ingesta de sectores regulados\nFuentes oficiales del ICP: **CMF** (Registro de Prestadores Fintech, JSON) y **Superintendencia de Salud** (prestadores acreditados: listado + una ficha por prestador, 1 solicitud por segundo). Solo personas jurídicas; de la ficha no se guardan teléfono, dirección ni datos del representante legal. Ver docs/fuentes-fase2.md.', [], { color: 4, position: [0, -60], width: 600, height: 200 });

export default workflow('ingesta-regulados', 'A2 · Ingesta sectores regulados')
  .add(iniciar)
  .to(parametros)
  .add(desdeOrquestador)
  .to(parametros)
  .add(parametros)
  .to(leerExistentes)
  .to(consultarCmf)
  .to(listadoSalud)
  .to(elegir)
  .to(ficha)
  .to(unificar)
  .to(hayNuevas
    .onTrue(guardar.to(resumen))
    .onFalse(resumen))
  .add(resumen)
  .to(registrar)
  .add(nota)
  .group('Fuentes oficiales', [leerExistentes, consultarCmf, listadoSalud, elegir, ficha, unificar], { description: 'CMF (JSON) y Superintendencia de Salud (listado + fichas) unificadas al esquema de empresas' })
  .group('Métricas', [resumen, registrar], { description: 'Registra empresas nuevas por fuente en la tabla corridas' });
