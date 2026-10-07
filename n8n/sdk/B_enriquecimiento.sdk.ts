import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar enriquecimiento', position: [0, 200] },
  output: [{}]
});

const desdeOrquestador = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Llamado desde orquestador', position: [0, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'run-20261007-120000', limite: 50 }]
});

const parametros = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Parámetros B',
    position: [220, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'b-run', name: 'run_id', value: expr('{{ $json.run_id || ("run-" + $now.toFormat("yyyyLLdd-HHmmss")) }}'), type: 'string' },
          { id: 'b-lim', name: 'limite', value: expr('{{ $json.limite || 100 }}'), type: 'number' },
          { id: 'b-ini', name: 'inicio', value: expr('{{ $now.toISO() }}'), type: 'string' },
          { id: 'b-rep', name: 'reprocesar', value: expr('{{ $json.reprocesar ?? false }}'), type: 'boolean' },
          { id: 'b-ree', name: 'reenriquecer', value: expr('{{ $json.reenriquecer ?? false }}'), type: 'boolean' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000', limite: 100, inicio: '2026-10-07T12:00:00.000-03:00' }]
});

const leerNuevas = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer empresas nuevas',
    position: [440, 300],
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'anyCondition',
      filters: { conditions: [{ keyName: 'estado', condition: 'eq', keyValue: 'nueva' }, { keyName: 'estado', condition: 'eq', keyValue: expr('{{ $json.reprocesar ? "sin_dominio" : "nueva" }}') }, { keyName: 'dominio', condition: 'like', keyValue: expr('{{ $json.reenriquecer ? "%.%" : "__nunca__" }}') }] },
      returnAll: false,
      limit: expr('{{ $json.limite }}')
    }
  },
  output: [{ id: 1, rut: '78325555-3', razon_social: 'Clinica Los Pinos SpA', capital: 300000000, anio_constitucion: 2018, estado: 'nueva' }]
});

const candidatos = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Generar candidatos',
    position: [660, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:enriq_candidatos__ }
  },
  output: [{ row_id: 1, host: 'clinicalospinos.cl', robots_url: 'https://clinicalospinos.cl/robots.txt' }]
});

const robots = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Consultar robots.txt',
    position: [880, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.robots_url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'ProspeccionLey21719Bot/0.1 (respeta robots.txt)' }] },
      options: {
        timeout: 6000,
        batching: { batch: { batchSize: 10, batchInterval: 300 } },
        redirect: { redirect: { followRedirects: true, maxRedirects: 3 } },
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } }
      }
    }
  },
  output: [{ statusCode: 200, body: 'User-agent: *\nDisallow: /admin', headers: {} }]
});

const evaluarRobots = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Evaluar robots',
    position: [1100, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:enriq_robots__ }
  },
  output: [{ row_id: 1, host: 'clinicalospinos.cl', respondio: true, disallow: ['/admin'], home_permitido: true }]
});

const portada = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Descargar portada',
    position: [1320, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ "https://" + $json.host + "/" }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'ProspeccionLey21719Bot/0.1 (respeta robots.txt)' }] },
      options: {
        timeout: 10000,
        batching: { batch: { batchSize: 5, batchInterval: 500 } },
        redirect: { redirect: { followRedirects: true, maxRedirects: 5 } },
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } }
      }
    }
  },
  output: [{ statusCode: 200, body: '<html><title>Clinica Los Pinos</title></html>', headers: {} }]
});

const verificar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Verificar dominio',
    position: [1540, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:enriq_verificar__ }
  },
  output: [{ row_id: 1, rut: '78325555-3', razon_social: 'Clinica Los Pinos SpA', capital: 300000000, anio_constitucion: 2018, run_id: 'run-20261007-120000', dominio: 'clinicalospinos.cl', verificacion: 'nombre_en_titulo', home: { sitio_activo: true }, politica_enlazada: true, politica_url: 'https://clinicalospinos.cl/privacidad', estado: 'con_dominio' }]
});

const tieneDominio = ifElse({
  version: 2.2,
  config: {
    name: '¿Tiene dominio?',
    position: [1760, 200],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.estado }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'con_dominio' }],
        combinator: 'and'
      }
    }
  }
});

const politica = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Descargar política',
    position: [1980, 100],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.politica_url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'ProspeccionLey21719Bot/0.1 (respeta robots.txt)' }] },
      options: {
        timeout: 10000,
        batching: { batch: { batchSize: 5, batchInterval: 500 } },
        redirect: { redirect: { followRedirects: true, maxRedirects: 5 } },
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'text' } }
      }
    }
  },
  output: [{ statusCode: 200, body: '<html><h1>Política de privacidad</h1></html>', headers: {} }]
});

const calcular = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Calcular señales',
    position: [2200, 100],
    parameters: { mode: 'runOnceForEachItem', language: 'javaScript', jsCode: __CODE:enriq_senales__ }
  },
  output: [{ row_id: 1, dominio: 'clinicalospinos.cl', senales_json: '{}', score_reglas: 60, estado: 'enriquecida' }]
});

const guardarSenales = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar señales',
    position: [2420, 100],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.row_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          dominio: expr('{{ $json.dominio }}'),
          senales_json: expr('{{ $json.senales_json }}'),
          score_reglas: expr('{{ $json.score_reglas }}'),
          estado: expr('{{ $json.estado }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'dominio', displayName: 'dominio', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'senales_json', displayName: 'senales_json', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'score_reglas', displayName: 'score_reglas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'estado', displayName: 'estado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1 }]
});

const marcarSinDominio = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Marcar sin dominio',
    position: [1980, 300],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.row_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { estado: 'sin_dominio' },
        matchingColumns: [],
        schema: [
          { id: 'estado', displayName: 'estado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 2 }]
});

const resumen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumen de enriquecimiento',
    position: [1760, 500],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:enriq_resumen__ }
  },
  output: [{ run_id: 'run-20261007-120000', etapa: 'enriquecimiento', procesadas: 50, enriquecidas: 12, sin_dominio: 38, errores: 0, nota: 'candidatos=300' }]
});

const registrar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar corrida B',
    position: [1980, 500],
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
          { id: 'enriquecidas', displayName: 'enriquecidas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'sin_dominio', displayName: 'sin_dominio', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'errores', displayName: 'errores', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'nota', displayName: 'nota', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1 }]
});

const nota = sticky('## B · Dominio y enriquecimiento\nPara cada empresa `nueva`: genera dominios candidatos desde la razón social, respeta robots.txt, verifica que el sitio mencione su RUT o nombre, y extrae señales de cumplimiento (política de privacidad, cookies, formularios, trackers). Guarda `senales_json` y el puntaje por reglas.', [], { color: 5, position: [0, -60], width: 560, height: 200 });

export default workflow('enriquecimiento', 'B · Dominio y enriquecimiento')
  .add(iniciar)
  .to(parametros)
  .add(desdeOrquestador)
  .to(parametros)
  .add(parametros)
  .to(leerNuevas)
  .to(candidatos)
  .to(robots)
  .to(evaluarRobots)
  .to(portada)
  .to(verificar)
  .to(tieneDominio
    .onTrue(politica.to(calcular.to(guardarSenales)))
    .onFalse(marcarSinDominio))
  .add(verificar)
  .to(resumen)
  .to(registrar)
  .add(nota)
  .group('Descubrir dominio', [leerNuevas, candidatos, robots, evaluarRobots, portada, verificar], { description: 'Candidatos desde la razón social, robots.txt y verificación por RUT o nombre en el sitio' })
  .group('Señales de cumplimiento', [politica, calcular, guardarSenales], { description: 'Descarga la política de privacidad, extrae señales y calcula el puntaje por reglas' })
  .group('Métricas', [resumen, registrar], { description: 'Registra cuántas empresas tienen dominio verificado en la tabla corridas' });
