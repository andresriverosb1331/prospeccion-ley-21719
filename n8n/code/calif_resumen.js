// Nodo "Resumen de calificación" (workflow C). Fila para la tabla `corridas`.
const params = $('Parámetros C').first().json;
const filas = $input.all().map((i) => i.json).filter((f) => f.row_id !== undefined);
const cuenta = (estado) => filas.filter((f) => f.estado === estado).length;
const rubros = {};
for (const f of filas) rubros[f.rubro] = (rubros[f.rubro] || 0) + 1;
return [{
  json: {
    run_id: params.run_id,
    etapa: 'calificacion',
    inicio: params.inicio,
    fin: new Date().toISOString(),
    procesadas: filas.length,
    calificadas: cuenta('calificada'),
    revision: cuenta('revision'),
    descartadas: cuenta('descartada'),
    errores: filas.filter((f) => f.error).length,
    nota: 'rubros=' + JSON.stringify(rubros),
  },
}];
