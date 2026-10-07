// Nodo "Generar candidatos" (workflow B). Requiere lib/normalize.js
// Un item por dominio candidato de cada empresa. Si una fuente oficial informó el sitio
// (p. ej. la Superintendencia de Salud), se prueba solo ese; si no, se generan candidatos
// desde la razón social y el nombre comercial (máx. 8).
const salida = [];
for (const item of $input.all()) {
  const e = item.json;
  if (!e.id) continue;
  const oficial = normalizarDominio(e.sitio_fuente);
  const hosts = oficial
    ? [oficial, 'www.' + oficial]
    : [...new Set([...candidatosDominio(e.nombre_comercial || ''), ...candidatosDominio(e.razon_social)])].slice(0, 8);
  for (const host of hosts) {
    salida.push({ json: { row_id: e.id, host, desde_fuente: Boolean(oficial), robots_url: 'https://' + host + '/robots.txt' } });
  }
}
return salida;
