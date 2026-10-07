// Nodo "Parsear y normalizar" (workflow A · Ingesta). Requiere lib/normalize.js antepuesto.
const params = $('Parámetros').first().json;
const existentes = new Set(
  $('Leer claves existentes').all().map((i) => i.json.dedup_key).filter(Boolean)
);

const texto = String($input.first().json.csv || '').replace(/^﻿/, '');
const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
const cabecera = lineas[0].split(';').map((h) => h.trim());
const col = (nombre) => cabecera.indexOf(nombre);
const C = {
  rut: col('RUT'),
  razon: col('Razon Social'),
  anio: col('Anio'),
  comuna: col('Comuna Social'),
  region: col('Region Social'),
  tipo: col('Codigo de sociedad'),
  actuacion: col('Tipo de actuacion'),
  capital: col('Capital'),
};
if (Object.values(C).some((i) => i < 0)) {
  throw new Error('El CSV no tiene las columnas esperadas: ' + cabecera.join(' | '));
}

const regiones = new Set(String(params.regiones).split(',').map((s) => s.trim()));
const capitalMin = Number(params.capital_min) || 0;
const limite = Number(params.limite) || 50;
const excluirHoldings = params.excluir_holdings !== false;

const filas = lineas.slice(1).map((l) => l.split(';'));
const disueltas = new Set();
for (const f of filas) {
  if (/DISOLU/i.test(f[C.actuacion] || '')) disueltas.add(parseRut(f[C.rut]).rut);
}

// Capitales declarados sobre 100 mil millones de CLP en una SpA nueva suelen ser errores de tipeo.
const CAPITAL_ATIPICO = 100000000000;

const stats = { filas: filas.length, constituciones: 0, rut_invalido: 0, persona_natural: 0, eirl: 0,
  disueltas: 0, capital_atipico: 0, fuera_filtro: 0, holdings: 0, duplicadas_csv: 0, ya_existentes: 0 };
const vistas = new Set();
const candidatas = [];

for (const f of filas) {
  if (!/CONSTITU/i.test(f[C.actuacion] || '')) continue;
  stats.constituciones++;
  const rut = parseRut(f[C.rut]);
  if (!rut.valido) { stats.rut_invalido++; continue; }
  if (!rut.personaJuridica) { stats.persona_natural++; continue; }
  if (disueltas.has(rut.rut)) { stats.disueltas++; continue; }
  // Una EIRL tiene un único dueño y su razón social suele ser su nombre completo:
  // se excluye para no tratar datos de personas naturales.
  const tipo = String(f[C.tipo] || '').trim();
  if (/^EIRL$/i.test(tipo) || /INDIVIDUAL DE RESPONSABILIDAD/i.test(f[C.razon] || '')) { stats.eirl++; continue; }
  const capital = Number(String(f[C.capital] || '0').replace(/[^0-9]/g, '')) || 0;
  if (capital > CAPITAL_ATIPICO) { stats.capital_atipico++; continue; }
  const region = String(f[C.region] || '').trim();
  if (capital < capitalMin || !regiones.has(region)) { stats.fuera_filtro++; continue; }
  const razonSocial = String(f[C.razon] || '').trim();
  // Las sociedades de inversión/holdings rara vez tienen sitio ni clientes personas: fuera del ICP.
  if (excluirHoldings && /^(sociedad (de )?)?inversiones\b|\bholding\b|\binversiones\s+(y|e)\s+inversiones\b/i.test(quitarTildes(razonSocial))) {
    stats.holdings++; continue;
  }
  const clave = dedupKey({ rut: rut.rut, razonSocial });
  if (vistas.has(clave)) { stats.duplicadas_csv++; continue; }
  vistas.add(clave);
  if (existentes.has(clave)) { stats.ya_existentes++; continue; }
  candidatas.push({
    rut: rut.rut,
    razon_social: razonSocial,
    nombre_norm: normalizarRazonSocial(razonSocial),
    dedup_key: clave,
    comuna: String(f[C.comuna] || '').trim(),
    region,
    capital,
    anio_constitucion: Number(f[C.anio]) || null,
    tipo_sociedad: tipo,
    fuente: 'RES datos.gob.cl',
    estado: 'nueva',
    run_id: params.run_id,
  });
}

// Primero las de mayor capital: tienen más probabilidad de tener sitio web y presupuesto.
candidatas.sort((a, b) => b.capital - a.capital);
const seleccion = candidatas.slice(0, limite);
const meta = { ...Object.fromEntries(Object.entries(stats).map(([k, v]) => ['meta_' + k, v])),
  meta_candidatas: candidatas.length, meta_seleccionadas: seleccion.length };

if (seleccion.length === 0) return [{ json: { sin_nuevas: true, ...meta } }];
return seleccion.map((e) => ({ json: { sin_nuevas: false, ...e, ...meta } }));
