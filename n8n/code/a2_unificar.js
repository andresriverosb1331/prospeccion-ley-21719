// Nodo "Unificar fuentes" (workflow A2). Requiere lib/normalize.js, lib/senales.js, lib/fuentes.js
// Une Salud (fichas) y CMF (JSON) al esquema de `empresas`, excluye personas naturales y deduplica por RUT.
const params = $('Parámetros A2').first().json;
const existentes = new Set($('Leer empresas existentes').all().map((i) => i.json.dedup_key).filter(Boolean));
const fichas = $('Elegir fichas de Salud').all();

const stats = { fichas_descargadas: 0, fichas_error: 0, fichas_sin_rut: 0, cmf_total: 0, duplicadas: 0, ya_existentes: 0 };
const registros = [];

$input.all().forEach((item, i) => {
  const ref = fichas[i] && fichas[i].json;
  if (!ref || !ref.url) return;
  const cuerpo = cuerpoRespuesta(item.json);
  if (item.json.statusCode !== 200 || cuerpo === null) { stats.fichas_error++; return; }
  stats.fichas_descargadas++;
  const r = parseFichaSalud(cuerpo, ref.url);
  if (!r) { stats.fichas_sin_rut++; return; }
  registros.push(r);
});

let cmf = [];
if (params.incluir_cmf) {
  let datos = $('Consultar CMF').first().json;
  const texto = cuerpoRespuesta(datos);
  try { cmf = parseCmf(texto !== null ? JSON.parse(texto) : datos); } catch (e) { cmf = []; }
  stats.cmf_total = cmf.length;
  cmf = cmf.slice(0, Number(params.limite_cmf) || 0);
}
registros.push(...cmf);

const vistas = new Set();
const nuevas = [];
for (const r of registros) {
  const clave = dedupKey({ rut: r.rut, razonSocial: r.razon_social });
  if (!clave || vistas.has(clave)) { stats.duplicadas++; continue; }
  vistas.add(clave);
  if (existentes.has(clave)) { stats.ya_existentes++; continue; }
  nuevas.push({
    ...r,
    nombre_norm: normalizarRazonSocial(r.razon_social),
    dedup_key: clave,
    fuente: r.fuente_lista,
    estado: 'nueva',
    run_id: params.run_id,
  });
}

const meta = Object.fromEntries(Object.entries(stats).map(([k, v]) => ['meta_' + k, v]));
if (nuevas.length === 0) return [{ json: { sin_nuevas: true, ...meta } }];
return nuevas.map((n) => ({ json: { sin_nuevas: false, ...n, ...meta } }));
