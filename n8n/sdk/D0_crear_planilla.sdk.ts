import { workflow, node, trigger } from '@n8n/workflow-sdk';

const iniciar = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Crear planilla (una vez)', position: [0, 300] },
  output: [{}]
});

const crear = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Crear planilla de prospección',
    position: [240, 300],
    credentials: { googleSheetsOAuth2Api: { id: '__ID:cred_sheets__', name: 'Google Sheets account' } },
    parameters: {
      resource: 'spreadsheet',
      operation: 'create',
      authentication: 'oAuth2',
      title: 'prospeccion-ley-21719 · Prospección en frío (demo)',
      sheetsUi: { sheetValues: [{ title: 'Calificadas' }, { title: 'Revision humana' }] },
      options: { locale: 'es_CL' }
    }
  },
  output: [{ spreadsheetId: 'abc', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/abc' }]
});

export default workflow('crear-planilla', 'D0 · Crear planilla')
  .add(iniciar)
  .to(crear);
