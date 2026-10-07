import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar exportación', position: [0, 200] },
  output: [{}]
});

const desdeOrquestador = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'Llamado desde orquestador', position: [0, 400], parameters: { inputSource: 'passthrough' } },
  output: [{ run_id: 'run-20261007-120000' }]
});

const limpiarCalificadas = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Limpiar Calificadas',
    position: [240, 300],
    executeOnce: true,
    credentials: { googleSheetsOAuth2Api: { id: '__ID:cred_sheets__', name: 'Google Sheets account' } },
    parameters: {
      resource: 'sheet',
      operation: 'clear',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: '__ID:planilla__' },
      sheetName: { __rl: true, mode: 'name', value: 'Calificadas' },
      clear: 'wholeSheet'
    }
  },
  output: [{ spreadsheetId: 'abc' }]
});

const limpiarRevision = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Limpiar Revisión humana',
    position: [460, 300],
    executeOnce: true,
    credentials: { googleSheetsOAuth2Api: { id: '__ID:cred_sheets__', name: 'Google Sheets account' } },
    parameters: {
      resource: 'sheet',
      operation: 'clear',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: '__ID:planilla__' },
      sheetName: { __rl: true, mode: 'name', value: 'Revision humana' },
      clear: 'wholeSheet'
    }
  },
  output: [{ spreadsheetId: 'abc' }]
});

const encabezados = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Escribir encabezados',
    position: [570, 460],
    executeOnce: true,
    credentials: { googleSheetsOAuth2Api: { id: '__ID:cred_sheets__', name: 'Google Sheets account' } },
    parameters: {
      method: 'POST',
      url: 'https://sheets.googleapis.com/v4/spreadsheets/__ID:planilla__/values:batchUpdate',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleSheetsOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: "{\"valueInputOption\": \"RAW\", \"data\": [{\"range\": \"Calificadas!A1:O1\", \"values\": [[\"Empresa\", \"RUT\", \"Sitio\", \"Comuna\", \"Fuente\", \"Tamano\", \"Rubro\", \"Score\", \"Segmento\", \"Confianza\", \"Motivo\", \"Evidencia\", \"Senales\", \"Observacion\", \"Actualizado\"]]}, {\"range\": \"'Revision humana'!A1:O1\", \"values\": [[\"Empresa\", \"RUT\", \"Sitio\", \"Comuna\", \"Fuente\", \"Tamano\", \"Rubro\", \"Score\", \"Segmento\", \"Confianza\", \"Motivo\", \"Evidencia\", \"Senales\", \"Observacion\", \"Actualizado\"]]}]}",
      options: {}
    }
  },
  output: [{ totalUpdatedRows: 2 }]
});

const leer = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Leer calificadas y en revisión',
    position: [680, 300],
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: '__ID:tabla_empresas__', cachedResultName: 'empresas' },
      matchType: 'anyCondition',
      filters: { conditions: [
        { keyName: 'estado', condition: 'eq', keyValue: 'calificada' },
        { keyName: 'estado', condition: 'eq', keyValue: 'revision' }
      ] },
      returnAll: true
    }
  },
  output: [{ id: 7, razon_social: 'SIMELEC SPA', rut: '76123456-0', dominio: 'simelec.cl', estado: 'calificada', score: 77 }]
});

const filas = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar filas',
    position: [900, 300],
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: __CODE:sheets_filas__ }
  },
  output: [{ hoja: 'Calificadas', Empresa: 'SIMELEC SPA', RUT: '76123456-0', Sitio: 'https://simelec.cl/', Comuna: 'SAN JOSE MAIPO', Rubro: 'otro', Score: 77, Segmento: 'alto_riesgo', Confianza: 0.8, Motivo: 'Sin política.', Evidencia: 'https://simelec.cl/', Senales: 'sin política de privacidad', Observacion: '', Actualizado: '2026-10-07' }]
});

const esCalificada = ifElse({
  version: 2.2,
  config: {
    name: '¿Calificada?',
    position: [1120, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.hoja }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'Calificadas' }],
        combinator: 'and'
      }
    }
  }
});

const COLUMNAS = [
  { id: 'Empresa', displayName: 'Empresa', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'RUT', displayName: 'RUT', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Sitio', displayName: 'Sitio', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Comuna', displayName: 'Comuna', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Fuente', displayName: 'Fuente', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Tamano', displayName: 'Tamano', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Rubro', displayName: 'Rubro', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Score', displayName: 'Score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
  { id: 'Segmento', displayName: 'Segmento', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Confianza', displayName: 'Confianza', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
  { id: 'Motivo', displayName: 'Motivo', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Evidencia', displayName: 'Evidencia', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Senales', displayName: 'Senales', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Observacion', displayName: 'Observacion', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'Actualizado', displayName: 'Actualizado', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
];

const escribirCalificadas = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Escribir Calificadas',
    position: [1340, 200],
    credentials: { googleSheetsOAuth2Api: { id: '__ID:cred_sheets__', name: 'Google Sheets account' } },
    parameters: {
      resource: 'sheet',
      operation: 'append',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: '__ID:planilla__' },
      sheetName: { __rl: true, mode: 'name', value: 'Calificadas' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: COLUMNAS },
      options: { handlingExtraData: 'ignoreIt' }
    }
  },
  output: [{ Empresa: 'SIMELEC SPA' }]
});

const escribirRevision = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Escribir Revisión humana',
    position: [1340, 400],
    credentials: { googleSheetsOAuth2Api: { id: '__ID:cred_sheets__', name: 'Google Sheets account' } },
    parameters: {
      resource: 'sheet',
      operation: 'append',
      authentication: 'oAuth2',
      documentId: { __rl: true, mode: 'id', value: '__ID:planilla__' },
      sheetName: { __rl: true, mode: 'name', value: 'Revision humana' },
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: COLUMNAS },
      options: { handlingExtraData: 'ignoreIt' }
    }
  },
  output: [{ Empresa: 'Otra SpA' }]
});

const nota = sticky('## D · Exportar a Google Sheets\nReescribe la planilla completa desde la tabla `empresas` (fuente de verdad): pestaña **Calificadas** para el equipo comercial y **Revision humana** para lo dudoso. Antes de usarlo: ejecutar `D0 · Crear planilla` y poner su ID en `n8n/ids.local.json` (`planilla`).', [], { color: 3, position: [0, -60], width: 560, height: 200 });

export default workflow('exportar-sheets', 'D · Exportar a Google Sheets')
  .add(iniciar)
  .to(limpiarCalificadas)
  .add(desdeOrquestador)
  .to(limpiarCalificadas)
  .add(limpiarCalificadas)
  .to(limpiarRevision)
  .to(encabezados)
  .to(leer)
  .to(filas)
  .to(esCalificada
    .onTrue(escribirCalificadas)
    .onFalse(escribirRevision))
  .add(nota)
  .group('Reiniciar planilla', [limpiarCalificadas, limpiarRevision, encabezados], { description: 'Vacía ambas pestañas y reescribe los encabezados: la planilla se regenera completa en cada corrida' })
  .group('Preparar datos', [leer, filas], { description: 'Lee calificadas y en revisión desde la Data Table y las ordena por score' });
