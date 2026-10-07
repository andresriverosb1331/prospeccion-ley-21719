// Nodo "Elegir fichas de Salud" (workflow A2). Requiere lib/normalize.js, lib/fuentes.js
// Del listado nacional toma las fichas que aún no están en `empresas` (por ref_fuente), hasta el límite.
const params = $('Parámetros A2').first().json;
const conocidas = new Set($('Leer empresas existentes').all().map((i) => i.json.ref_fuente).filter(Boolean));
const listado = parseListadoSalud($input.first().json.html || '');
const nuevas = listado.filter((p) => !conocidas.has(p.url)).slice(0, Number(params.limite_salud) || 0);
const meta = { listado_total: listado.length, ya_conocidas: listado.length - listado.filter((p) => !conocidas.has(p.url)).length };
// Si no hay fichas nuevas se emite un marcador (la descarga falla sin URL y el flujo sigue con la CMF).
if (nuevas.length === 0) return [{ json: { url: '', nombre: '', ...meta } }];
return nuevas.map((p) => ({ json: { ...p, ...meta } }));
