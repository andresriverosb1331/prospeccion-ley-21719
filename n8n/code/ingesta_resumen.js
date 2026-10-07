// Nodo "Resumen de ingesta" (workflow A). Arma la fila para la tabla `corridas`.
const params = $('Parámetros').first().json;
const parse = $('Parsear y normalizar').all().map((i) => i.json);
const m = parse[0] || {};
const nuevas = parse.filter((e) => !e.sin_nuevas).length;

return [{
  json: {
    run_id: params.run_id,
    etapa: 'ingesta',
    inicio: params.inicio,
    fin: new Date().toISOString(),
    procesadas: m.meta_constituciones || 0,
    nuevas,
    duplicadas: (m.meta_duplicadas_csv || 0) + (m.meta_ya_existentes || 0),
    excluidas: (m.meta_persona_natural || 0) + (m.meta_rut_invalido || 0) + (m.meta_disueltas || 0) +
      (m.meta_eirl || 0) + (m.meta_capital_atipico || 0),
    errores: 0,
    nota: 'filas=' + (m.meta_filas || 0) + ' fuera_filtro=' + (m.meta_fuera_filtro || 0) +
      ' holdings=' + (m.meta_holdings || 0) +
      ' candidatas=' + (m.meta_candidatas || 0) + ' ya_existentes=' + (m.meta_ya_existentes || 0) +
      ' anio=' + params.anio,
  },
}];
