'use strict';

// Normalización de empresas chilenas. Este mismo código se pega en el nodo
// Code del workflow A (n8n), así que se mantiene sin dependencias externas.

const PERSONA_JURIDICA_MIN = 50000000;

const SUFIJOS_SOCIETARIOS = [
  'sociedad por acciones', 'sociedad anonima', 'sociedad de responsabilidad limitada',
  'empresa individual de responsabilidad limitada', 'limitada', 'ltda', 'spa', 's a', 'sa',
  'eirl', 'e i r l', 'y cia', 'y compania', 'cia',
];

function quitarTildes(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Calcula el dígito verificador de un RUT con el algoritmo módulo 11.
function calcularDV(cuerpo) {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

// Devuelve { valido, cuerpo, dv, rut, personaJuridica } a partir de "76.123.456-7", "761234567", etc.
function parseRut(entrada) {
  const limpio = String(entrada ?? '').toUpperCase().replace(/[^0-9K]/g, '');
  if (limpio.length < 2) return { valido: false };
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return { valido: false };
  const valido = calcularDV(cuerpo) === dv;
  const numero = Number(cuerpo);
  return {
    valido,
    cuerpo,
    dv,
    rut: `${numero}-${dv}`,
    personaJuridica: numero >= PERSONA_JURIDICA_MIN,
  };
}

// "https://www.Empresa.cl/contacto?x=1" -> "empresa.cl"
function normalizarDominio(entrada) {
  if (!entrada) return null;
  let texto = String(entrada).trim().toLowerCase();
  if (!texto) return null;
  texto = texto.replace(/^[a-z]+:\/\//, '');
  texto = texto.split(/[/?#]/)[0];
  texto = texto.replace(/:\d+$/, '');
  texto = texto.replace(/^www\d*\./, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(texto)) return null;
  return texto;
}

// "Inversiones Pérez & Cía. Ltda." -> "inversiones perez"
function normalizarRazonSocial(entrada) {
  let texto = quitarTildes(String(entrada ?? '').toLowerCase());
  texto = texto.replace(/&/g, ' y ');
  texto = texto.replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const sufijo of SUFIJOS_SOCIETARIOS) {
      if (texto === sufijo) continue;
      if (texto.endsWith(' ' + sufijo)) {
        texto = texto.slice(0, -(sufijo.length + 1)).trim();
        cambio = true;
      }
    }
  }
  return texto;
}

// Clave para detectar duplicados: el RUT manda; si no hay RUT válido, el dominio; si no, el nombre.
function dedupKey({ rut, dominio, razonSocial }) {
  const r = parseRut(rut);
  if (r.valido) return `rut:${r.rut}`;
  const d = normalizarDominio(dominio);
  if (d) return `dom:${d}`;
  const n = normalizarRazonSocial(razonSocial);
  return n ? `nom:${n}` : null;
}

// Palabras que describen el giro y no identifican a una empresa: no sirven solas como dominio
// ni como prueba de que un sitio pertenece a la empresa.
const PALABRAS_GENERICAS = new Set([
  'sociedad', 'inversiones', 'inversion', 'comercial', 'comercializadora', 'servicios', 'empresa',
  'empresas', 'grupo', 'inmobiliaria', 'constructora', 'transportes', 'transporte', 'agricola',
  'ingenieria', 'clinica', 'centro', 'chile', 'chilena', 'holding', 'asesorias', 'consultora',
  'consultores', 'distribuidora', 'importadora', 'exportadora', 'gestion', 'desarrollo',
  'proyectos', 'capital', 'negocios', 'compania', 'corporacion', 'spa', 'limitada', 'del', 'los',
  'las', 'de', 'la', 'el', 'y', 'e', 'en', 'para', 'con',
]);

function palabrasDistintivas(razonSocial) {
  return normalizarRazonSocial(razonSocial)
    .replace(/ñ/g, 'n')
    .split(' ')
    .filter((p) => p.length >= 4 && !PALABRAS_GENERICAS.has(p));
}

// Candidatos de dominio a partir de la razón social:
// "Inversiones Club Exponencial SpA" -> clubexponencial.cl, club-exponencial.cl, exponencial.cl, ...
function candidatosDominio(razonSocial) {
  const palabras = normalizarRazonSocial(razonSocial).replace(/ñ/g, 'n').split(' ').filter(Boolean);
  const sinGiro = palabras.filter((p) => !PALABRAS_GENERICAS.has(p));
  const slugs = new Set();
  if (palabras.length) slugs.add(palabras.join(''));
  if (sinGiro.length) {
    slugs.add(sinGiro.join(''));
    if (sinGiro.length > 1) slugs.add(sinGiro.join('-'));
    if (sinGiro.length > 2) slugs.add(sinGiro.slice(0, 2).join(''));
    if (sinGiro[0].length >= 5) slugs.add(sinGiro[0]);
  }
  const candidatos = [];
  for (const slug of slugs) {
    if (slug.length < 4 || slug.length > 40) continue;
    candidatos.push(`${slug}.cl`, `${slug}.com`);
  }
  return candidatos.slice(0, 8);
}

module.exports = {
  PERSONA_JURIDICA_MIN,
  calcularDV,
  parseRut,
  normalizarDominio,
  normalizarRazonSocial,
  dedupKey,
  candidatosDominio,
  palabrasDistintivas,
  PALABRAS_GENERICAS,
};
