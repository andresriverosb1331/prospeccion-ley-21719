// Nodo "Calcular señales" (workflow B, una vez por item). Requiere lib/senales.js
const base = $('Verificar dominio').item.json;
const r = $json;
const cuerpo = cuerpoRespuesta(r);
const politica = r.statusCode === 200 && cuerpo !== null
  ? senalesPolitica(cuerpo)
  : { politica_privacidad: false };
const senales = {
  ...base.home,
  ...politica,
  politica_url: politica.politica_privacidad ? base.politica_url : '',
  politica_enlazada: base.politica_enlazada,
  politica_consultada: base.politica_url,
  politica_http: r.statusCode || null,
  politica_bytes: cuerpo === null ? null : cuerpo.length,
  politica_error: r.error ? String(r.error.message || r.error).slice(0, 120) : null,
  verificacion: base.verificacion,
};
const reglas = puntajeReglas(senales, { capital: base.capital, anioConstitucion: base.anio_constitucion, tamano: base.tamano });
return {
  json: {
    row_id: base.row_id,
    dominio: base.dominio,
    senales_json: JSON.stringify({ ...senales, reglas }),
    score_reglas: reglas.total_sin_rubro,
    estado: 'enriquecida',
  },
};
