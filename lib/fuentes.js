'use strict';

// Parsers de las fuentes de la fase 2 (ver docs/fuentes-fase2.md) a un esquema común:
// { rut, razon_social, rubro_fuente, sitio_fuente, tipo_fuente, fuente_lista, ref_fuente }
// Sin dependencias: se antepone a los nodos Code de n8n junto con lib/normalize.js.

// Etiquetas de la ficha de un prestador acreditado (Superintendencia de Salud), en orden.
// Todo lo que viene desde "Representante Legal" son datos de una persona: no se extrae.
const ETIQUETAS_SALUD = ['N° de registro', 'Nombre', 'Rut', 'Dirección', 'Teléfono', 'Tipo de Establecimiento',
  'Complejidad Asistencial', 'Propietario del Prestador', 'Página Web'];
const CORTE_PERSONA = /Representante Legal/i;

function decodificarEntidades(texto) {
  return String(texto || '')
    .replace(/&hellip;/g, '…').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ').replace(/&deg;/g, '°').replace(/&nbsp;/g, ' ');
}

// CMF: respuesta JSON del Registro de Prestadores de Servicios Financieros (personas jurídicas vigentes).
function parseCmf(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.per_rut && it.per_nombre)
    .map((it) => {
      const cuerpo = String(it.per_rut).replace(/\D/g, '');
      const servicios = Object.keys(it).filter((k) => /^per_serv_\d+$/.test(k) && /autorizad/i.test(it[k])).length;
      return {
        rut: `${Number(cuerpo)}-${calcularDV(cuerpo)}`,
        razon_social: String(it.per_nombre).trim(),
        rubro_fuente: 'fintech_seguros',
        sitio_fuente: '',
        tipo_fuente: `Prestador Ley Fintec (${servicios} servicio${servicios === 1 ? '' : 's'} autorizado${servicios === 1 ? '' : 's'})`,
        fuente_lista: 'CMF Registro Fintec',
        ref_fuente: `cmf:${Number(cuerpo)}`,
      };
    });
}

// Salud: listado nacional de prestadores acreditados → [{ nombre, url }] (sin inscripciones canceladas).
function parseListadoSalud(html) {
  const vistos = new Set();
  const salida = [];
  const re = /<a[^>]+href=["'](https:\/\/www\.superdesalud\.gob\.cl\/registro\/[a-z0-9-]+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const url = m[1].endsWith('/') ? m[1] : m[1] + '/';
    const nombre = decodificarEntidades(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!nombre || /inscripci[oó]n cancelada/i.test(nombre) || vistos.has(url)) continue;
    vistos.add(url);
    salida.push({ nombre, url });
  }
  return salida;
}

// Salud: ficha de un prestador → esquema común. Lee la descripción estructurada de la página
// (og:description) y corta antes de los datos del representante legal.
function parseFichaSalud(html, url) {
  const crudo = String(html || '');
  const meta = crudo.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  let texto = decodificarEntidades(meta ? meta[1] : '').replace(/\s+/g, ' ').trim();
  const corte = texto.search(CORTE_PERSONA);
  if (corte >= 0) texto = texto.slice(0, corte);
  const campos = {};
  const posiciones = ETIQUETAS_SALUD
    .map((et) => ({ et, i: texto.indexOf(' ' + et + ' ') >= 0 ? texto.indexOf(' ' + et + ' ') + 1 : texto.indexOf(et + ' ') === 0 ? 0 : -1 }))
    .filter((p) => p.i >= 0)
    .sort((a, b) => a.i - b.i);
  posiciones.forEach((p, k) => {
    const fin = k + 1 < posiciones.length ? posiciones[k + 1].i : texto.length;
    campos[p.et] = texto.slice(p.i + p.et.length, fin).replace(/\[…\]\s*$/, '').trim();
  });
  const rut = parseRut(campos['Rut']);
  if (!rut.valido || !rut.personaJuridica) return null;
  const sitio = normalizarDominio((campos['Página Web'] || '').split(/\s/)[0]);
  const tipo = [campos['Tipo de Establecimiento'], campos['Complejidad Asistencial']].filter(Boolean).join(' · ');
  return {
    rut: rut.rut,
    razon_social: campos['Propietario del Prestador'] || campos['Nombre'] || '',
    nombre_comercial: campos['Nombre'] || '',
    rubro_fuente: 'salud',
    sitio_fuente: sitio || '',
    tipo_fuente: tipo ? `Prestador acreditado: ${tipo}` : 'Prestador acreditado',
    fuente_lista: 'Superintendencia de Salud',
    ref_fuente: url,
  };
}

// Tramo según ventas del SII → tamaño.
function tamanoPorTramo(tramo) {
  const t = Number(tramo);
  if (!t || t === 1) return 'sin_info';
  if (t <= 4) return 'micro';
  if (t <= 7) return 'pequena';
  if (t <= 9) return 'mediana';
  return 'grande';
}

module.exports = { parseCmf, parseListadoSalud, parseFichaSalud, tamanoPorTramo, decodificarEntidades };
