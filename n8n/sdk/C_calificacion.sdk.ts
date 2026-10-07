import { workflow, node, trigger, sticky, splitInBatches, nextBatch, expr } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar calificación', position: [0, 200] },
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
    name: 'Parámetros C',
    position: [220, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'c-run', name: 'run_id', value: expr('{{ $json.run_id || ("run-" + $now.toFormat("yyyyLLdd-HHmmss")) }}'), type: 'string' },
          { id: 'c-lim', name: 'limite', value: expr('{{ $json.limite || 50 }}'), type: 'number' },
          { id: 'c-ini', name: 'inicio', value: expr('{{ $now.toISO() }}'), type: 'string' },
          { id: 'c-esp', name: 'espera_segundos', value: expr('{{ $json.espera_segundos || 7 }}'), type: 'number' },
          { id: 'c-rei', name: 'reintentar_errores_ia', value: expr('{{ $json.reintentar_errores_ia ?? true }}'), type: 'boolean' }
        ]
      }
    }
  },
  output: [{ run_id: 'run-20261007-120000', limite: 50, inicio: '2026-10-07T12:00:00.000-03:00', espera_segundos: 7 }]
});

const leer = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer empresas enriquecidas',
    position: [440, 300],
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'anyCondition',
      filters: { conditions: [
        { keyName: 'estado', condition: 'eq', keyValue: 'enriquecida' },
        { keyName: 'error', condition: 'like', keyValue: expr('{{ $json.reintentar_errores_ia ? "ia_error%" : "__nunca__" }}') }
      ] },
      returnAll: false,
      limit: expr('{{ $json.limite }}')
    }
  },
  output: [{ id: 7, razon_social: 'SIMELEC SPA', dominio: 'simelec.cl', comuna: 'SAN JOSE MAIPO', capital: 500000000, anio_constitucion: 2018, senales_json: '{}', estado: 'enriquecida' }]
});

const lote = splitInBatches({ version: 3, config: { name: 'Una empresa a la vez', position: [660, 300], parameters: { batchSize: 1 } } });

const prompt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar prompt',
    position: [880, 200],
    parameters: { mode: 'runOnceForEachItem', language: 'javaScript', jsCode: __CODE:calif_prompt__ }
  },
  output: [{ row_id: 7, prompt: 'Eres analista...', reglas: { exposicion_sin_rubro: 12, brecha: 40, viabilidad: 20, total_sin_rubro: 72 }, urls_validas: ['https://simelec.cl/'] }]
});

const gemini = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Calificar con Gemini',
    position: [1100, 200],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    credentials: { googlePalmApi: { id: '__ID:cred_gemini__', name: 'Google Gemini(PaLM) Api account' } },
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'id', value: 'models/gemini-flash-latest' },
      messages: { values: [{ content: expr('{{ $json.prompt }}'), role: 'user' }] },
      simplify: true,
      jsonOutput: true,
      builtInTools: {},
      options: { temperature: 0.2, maxOutputTokens: 1024, thinkingBudget: 0 }
    }
  },
  output: [{ content: { parts: [{ text: '{"rubro":"otro","ajuste":0,"motivo":"Sin política de privacidad.","evidencia_url":"https://simelec.cl/","confianza":0.8,"sitio_corresponde":true}' }], role: 'model' } }]
});

const validar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar y puntuar',
    position: [1320, 200],
    parameters: { mode: 'runOnceForEachItem', language: 'javaScript', jsCode: __CODE:calif_validar__ }
  },
  output: [{ row_id: 7, rubro: 'otro', segmento: 'alto_riesgo', motivo: 'Sin política de privacidad.', evidencia_url: 'https://simelec.cl/', confianza: 0.8, score: 77, estado: 'calificada', error: '' }]
});

const guardar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar calificación',
    position: [1540, 80],
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.row_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          rubro: expr('{{ $json.rubro }}'),
          segmento: expr('{{ $json.segmento }}'),
          motivo: expr('{{ $json.motivo }}'),
          evidencia_url: expr('{{ $json.evidencia_url }}'),
          confianza: expr('{{ $json.confianza }}'),
          score: expr('{{ $json.score }}'),
          estado: expr('{{ $json.estado }}'),
          error: expr('{{ $json.error }}')
        },
        matchingColumns: [],
        schema: [
          { id: 'rubro', displayName: 'rubro', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'segmento', displayName: 'segmento', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'motivo', displayName: 'motivo', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'evidencia_url', displayName: 'evidencia_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'confianza', displayName: 'confianza', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'score', displayName: 'score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'estado', displayName: 'estado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'error', displayName: 'error', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 7 }]
});

const espera = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Pausa por límite de la API',
    position: [1540, 300],
    parameters: { resume: 'timeInterval', amount: expr('{{ $("Parámetros C").first().json.espera_segundos }}'), unit: 'seconds' }
  },
  output: [{ row_id: 7, estado: 'calificada' }]
});

const resumen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumen de calificación',
    position: [880, 480],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:calif_resumen__ }
  },
  output: [{ run_id: 'run-20261007-120000', etapa: 'calificacion', procesadas: 10, calificadas: 4, revision: 4, descartadas: 2, errores: 1, nota: 'rubros={}' }]
});

const registrar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar corrida C',
    position: [1100, 480],
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
          { id: 'calificadas', displayName: 'calificadas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'revision', displayName: 'revision', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'descartadas', displayName: 'descartadas', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'errores', displayName: 'errores', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'nota', displayName: 'nota', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      }
    }
  },
  output: [{ id: 1 }]
});

const nota = sticky('## C · Calificación con IA\nGemini clasifica el rubro, propone un ajuste (±15) con evidencia y confirma que el sitio es de la empresa. El código valida el JSON, aplica la rúbrica de docs/icp-rubrica.md y manda a **revisión humana** todo lo dudoso. Una empresa a la vez con pausa para respetar el límite de la API.', [], { color: 6, position: [0, -60], width: 560, height: 200 });

export default workflow('calificacion', 'C · Calificación con IA')
  .add(iniciar)
  .to(parametros)
  .add(desdeOrquestador)
  .to(parametros)
  .add(parametros)
  .to(leer)
  .to(lote
    .onEachBatch(prompt.to(gemini.to(validar.to(espera.to(nextBatch(lote))))))
    .onDone(resumen.to(registrar)))
  .add(validar)
  .to(guardar)
  .add(nota)
  .group('Calificar una empresa', [prompt, gemini, validar], { description: 'Arma el prompt con señales verificadas, consulta a Gemini y valida la respuesta contra la rúbrica' })
  .group('Métricas', [resumen, registrar], { description: 'Registra calificadas, en revisión y descartadas en la tabla corridas' });
