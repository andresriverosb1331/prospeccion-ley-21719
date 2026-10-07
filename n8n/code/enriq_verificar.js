// Nodo "Verificar dominio" (workflow B). Requiere lib/normalize.js, lib/senales.js
// Elige, por empresa, el candidato cuyo sitio menciona su RUT o su nombre; extrae señales de la portada.
const params = $('Parámetros B').first().json;
const empresas = $('Leer empresas nuevas').all().map((i) => i.json).filter((e) => e.id);
const candidatos = $('Evaluar robots').all();
const porId = Object.fromEntries(empresas.map((e) => [e.id, e]));
const mejores = {};
// Diagnóstico de la etapa: por qué se descartó cada candidato.
const diag = { http_200: 0, http_otro: 0, error_red: 0, cuerpo_no_texto: 0, sin_contenido: 0,
  estacionado: 0, no_coincide: 0, verificado: 0 };

$input.all().forEach((item, i) => {
  const c = candidatos[i].json;
  const r = item.json;
  const emp = porId[c.row_id];
  if (!emp) return;
  if (r.error || typeof r.statusCode !== 'number') { diag.error_red++; return; }
  if (r.statusCode !== 200) { diag.http_otro++; return; }
  diag.http_200++;
  const cuerpo = cuerpoRespuesta(r);
  if (cuerpo === null) { diag.cuerpo_no_texto++; return; }
  // Un sitio informado por un registro oficial se acepta si responde con contenido real
  // (no estacionado ni vacío); igual se intenta la verificación por RUT/nombre para la evidencia.
  const nombreBase = emp.nombre_comercial || emp.razon_social;
  let v = verificarSitio(cuerpo, { rut: emp.rut, palabras: palabrasDistintivas(nombreBase),
    nombre: normalizarRazonSocial(nombreBase) });
  if (!v.ok && v.evidencia === 'no_coincide' && nombreBase !== emp.razon_social) {
    v = verificarSitio(cuerpo, { rut: emp.rut, palabras: palabrasDistintivas(emp.razon_social),
      nombre: normalizarRazonSocial(emp.razon_social) });
  }
  if (!v.ok && c.desde_fuente && v.evidencia === 'no_coincide') v = { ok: true, evidencia: 'sitio_registro_oficial', puntos: 3 };
  diag[v.ok ? 'verificado' : v.evidencia] = (diag[v.ok ? 'verificado' : v.evidencia] || 0) + 1;
  if (!v.ok) return;
  const previo = mejores[c.row_id];
  const preferirCl = previo && v.puntos === previo.v.puntos && c.host.endsWith('.cl') && !previo.c.host.endsWith('.cl');
  if (!previo || v.puntos > previo.v.puntos || preferirCl) mejores[c.row_id] = { c, v, html: cuerpo };
});

// Un dominio que calza con dos empresas distintas no identifica a ninguna: se descarta.
// Excepción: si un registro oficial informó ese sitio (p. ej. una red de clínicas cuyos centros
// acreditados comparten la web), el dominio compartido es legítimo.
const usos = {};
for (const m of Object.values(mejores)) usos[m.c.host.replace(/^www\./, '')] = (usos[m.c.host.replace(/^www\./, '')] || 0) + 1;
for (const [id, m] of Object.entries(mejores)) {
  if (usos[m.c.host.replace(/^www\./, '')] > 1 && !m.c.desde_fuente) {
    delete mejores[id]; diag.dominio_compartido = (diag.dominio_compartido || 0) + 1;
  }
}

return empresas.map((e) => {
  const base = { row_id: e.id, rut: e.rut, razon_social: e.razon_social, capital: e.capital,
    anio_constitucion: e.anio_constitucion, tamano: e.tamano, run_id: params.run_id, diag };
  const m = mejores[e.id];
  if (!m) return { json: { ...base, dominio: '', estado: 'sin_dominio' } };
  const home = senalesHome(m.html, 'https://' + m.c.host + '/');
  // Si la portada no enlaza una política, se prueba la ruta conocida de la plataforma (o la más común).
  const plataforma = String(home.plataforma_tienda || '').toLowerCase();
  const rutaPorDefecto = RUTA_POLITICA_PLATAFORMA[plataforma] || '/politica-de-privacidad';
  const politicaUrl = home.politica_url || 'https://' + m.c.host + rutaPorDefecto;
  const politicaPermitida = rutaPermitida(m.c.disallow, (partirUrl(politicaUrl) || { ruta: '/' }).ruta);
  return { json: { ...base, dominio: m.c.host, verificacion: m.v.evidencia, home,
    politica_enlazada: Boolean(home.politica_url),
    politica_url: politicaPermitida ? politicaUrl : 'https://' + m.c.host + '/',
    estado: 'con_dominio' } };
});
