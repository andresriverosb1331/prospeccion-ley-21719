// Nodo "Resumen de enriquecimiento" (workflow B). Fila para la tabla `corridas`.
const params = $('Parámetros B').first().json;
const verificadas = $input.all().map((i) => i.json);
const conDominio = verificadas.filter((e) => e.estado === 'con_dominio').length;
const candidatos = $('Generar candidatos').all().length;
const respondieron = $('Evaluar robots').all().length;
return [{
  json: {
    run_id: params.run_id,
    etapa: 'enriquecimiento',
    inicio: params.inicio,
    fin: new Date().toISOString(),
    procesadas: verificadas.length,
    enriquecidas: conDominio,
    sin_dominio: verificadas.length - conDominio,
    errores: 0,
    nota: 'candidatos=' + candidatos + ' respondieron=' + respondieron +
      ' tasa_dominio=' + (verificadas.length ? Math.round((100 * conDominio) / verificadas.length) : 0) + '%' +
      ' diag=' + JSON.stringify((verificadas[0] || {}).diag || {}),
  },
}];
