// Nodo "Resumen del pipeline" (workflow E). Una fila en `corridas` con el estado de cada etapa.
// Las etapas de ingesta son alternativas (RES o regulados): la que no corresponde queda "omitida".
const p = $('Parámetros E').first().json;
const ETAPAS = [
  ['ingesta', 'Ejecutar A · Ingesta', true],
  ['ingesta_regulados', 'Ejecutar A2 · Regulados', true],
  ['cruce_sii', 'Ejecutar A3 · Cruce SII', true],
  ['enriquecimiento', 'Ejecutar B · Enriquecimiento', false],
  ['calificacion', 'Ejecutar C · Calificación', false],
  ['sheets', 'Ejecutar D · Sheets', false],
];

const estado = ETAPAS.map(([etapa, nodo, opcional]) => {
  let salida;
  try {
    salida = $(nodo).first().json || {};
  } catch (e) {
    return { etapa, ok: opcional, omitida: opcional, error: opcional ? '' : 'no se ejecutó' };
  }
  const err = salida.error;
  return { etapa, ok: !err, omitida: false, error: err ? String(err.message || err).slice(0, 200) : '' };
});

const fallos = estado.filter((e) => !e.ok);
return [{
  json: {
    run_id: p.run_id,
    etapa: 'pipeline',
    inicio: p.inicio,
    fin: new Date().toISOString(),
    errores: fallos.length,
    nota: 'fuente=' + (p.fuente || 'res') + ' | ' + estado
      .filter((e) => !e.omitida)
      .map((e) => e.etapa + '=' + (e.ok ? 'ok' : 'FALLO(' + e.error + ')')).join(' | '),
  },
}];
