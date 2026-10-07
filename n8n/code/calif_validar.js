// Nodo "Validar y puntuar" (workflow C, una vez por item). Requiere lib/senales.js
// Valida la respuesta del modelo, aplica la rúbrica y decide el estado. Ante cualquier duda: revisión humana.
const base = $('Preparar prompt').item.json;
const r = $json;
const problemas = [];

function textoRespuesta(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (x.content && Array.isArray(x.content.parts)) return x.content.parts.map((p) => p.text || '').join('');
  if (Array.isArray(x.parts)) return x.parts.map((p) => p.text || '').join('');
  if (typeof x.text === 'string') return x.text;
  if (typeof x.output === 'string') return x.output;
  if (x.rubro !== undefined) return JSON.stringify(x);
  return '';
}

let datos = null;
if (r.error) {
  problemas.push('ia_error: ' + String(r.error.message || r.error).slice(0, 120));
} else {
  const texto = textoRespuesta(r.content && typeof r.content === 'object' && r.content.rubro !== undefined ? r.content : r)
    .replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try {
    datos = JSON.parse(texto);
  } catch (err) {
    problemas.push('json_invalido');
  }
}

const rubro = datos && Object.prototype.hasOwnProperty.call(PUNTOS_RUBRO, datos.rubro) ? datos.rubro : 'otro';
if (datos && rubro !== datos.rubro) problemas.push('rubro_fuera_de_lista');
const ajuste = datos && Number.isFinite(Number(datos.ajuste)) ? Number(datos.ajuste) : 0;
if (datos && Math.abs(ajuste) > 15) problemas.push('ajuste_fuera_de_rango');
const confianza = datos && Number.isFinite(Number(datos.confianza)) ? Math.max(0, Math.min(1, Number(datos.confianza))) : 0;
const motivo = datos && typeof datos.motivo === 'string' ? datos.motivo.trim().slice(0, 500) : '';
if (datos && motivo.length < 20) problemas.push('motivo_insuficiente');
const evidencia = datos && base.urls_validas.includes(datos.evidencia_url) ? datos.evidencia_url : '';
if (datos && !evidencia) problemas.push('evidencia_no_verificable');
if (datos && datos.sitio_corresponde === false) problemas.push('sitio_no_corresponde');
// Observaciones que no bloquean, pero quedan visibles para quien revise.
const observaciones = [];
if (datos && Array.isArray(datos.senales_no_respaldadas) && datos.senales_no_respaldadas.length) {
  observaciones.push('senales_no_respaldadas: ' + datos.senales_no_respaldadas.slice(0, 5).join(', '));
}
// Un sitio mínimo nunca pasa directo a ventas.
if (base.sitio_minimo) problemas.push('sitio_minimo');

const score = puntajeFinal(base.reglas || { exposicion_sin_rubro: 0, brecha: 0, viabilidad: 0 }, rubro, ajuste);
let estado = estadoPorPuntaje(score, confianza);
if (problemas.length) estado = 'revision';
const segmento = score >= 70 ? 'alto_riesgo' : score >= 40 ? 'medio' : 'bajo';

return {
  json: {
    row_id: base.row_id,
    rubro,
    segmento,
    motivo,
    evidencia_url: evidencia,
    confianza,
    score,
    estado,
    error: problemas.concat(observaciones).join('; '),
  },
};
