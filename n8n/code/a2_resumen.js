// Nodo "Resumen de ingesta A2". Fila para la tabla `corridas`.
const params = $('Parámetros A2').first().json;
const filas = $('Unificar fuentes').all().map((i) => i.json);
const m = filas[0] || {};
const nuevas = filas.filter((f) => !f.sin_nuevas);
const porFuente = {};
for (const f of nuevas) porFuente[f.fuente_lista] = (porFuente[f.fuente_lista] || 0) + 1;
const conSitio = nuevas.filter((f) => f.sitio_fuente).length;
const elegir = $('Elegir fichas de Salud').first().json;
return [{
  json: {
    run_id: params.run_id,
    etapa: 'ingesta_regulados',
    inicio: params.inicio,
    fin: new Date().toISOString(),
    procesadas: (m.meta_fichas_descargadas || 0) + (m.meta_cmf_total || 0),
    nuevas: nuevas.length,
    duplicadas: (m.meta_duplicadas || 0) + (m.meta_ya_existentes || 0),
    excluidas: m.meta_fichas_sin_rut || 0,
    errores: m.meta_fichas_error || 0,
    nota: 'por_fuente=' + JSON.stringify(porFuente) + ' con_sitio_oficial=' + conSitio +
      ' listado_salud=' + (elegir.listado_total || 0) + ' cmf_total=' + (m.meta_cmf_total || 0),
  },
}];
