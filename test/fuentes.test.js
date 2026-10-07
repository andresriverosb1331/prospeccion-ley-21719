'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// fuentes.js usa funciones de normalize.js (como en n8n, donde se anteponen juntas).
const src = ['normalize.js', 'fuentes.js']
  .map((f) => fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8')
    .replace("'use strict';", '').replace(/module\.exports\s*=\s*\{[^}]*\};\s*/s, ''))
  .join('\n');
const f = new Function(src + '\nreturn { parseCmf, parseListadoSalud, parseFichaSalud, tamanoPorTramo };')();

// Datos sintéticos con la misma forma que las páginas reales (sin personas reales).
const FICHA = `<html><head><title>Clínica Ejemplo - Superintendencia de Salud</title>
<meta property="og:description" content="Datos del Prestador N&deg; de registro 999 Nombre Cl&iacute;nica Ejemplo Rut 76.123.456-0 Direcci&oacute;n Av. Siempre Viva 123, Santiago Tel&eacute;fono 2222222 Tipo de Establecimiento Atenci&oacute;n Cerrada Complejidad Asistencial Alta Complejidad Propietario del Prestador Servicios Cl&iacute;nicos Ejemplo SpA P&aacute;gina Web www.clinicaejemplo.cl Representante Legal Nombre Persona Ficticia Rut 11.111.111-Z [&hellip;]" />
</head><body></body></html>`;

test('parseFichaSalud extrae RUT, propietario, tipo y sitio, sin datos del representante legal', () => {
  const r = f.parseFichaSalud(FICHA, 'https://www.superdesalud.gob.cl/registro/clinica-ejemplo/');
  assert.equal(r.rut, '76123456-0');
  assert.equal(r.razon_social, 'Servicios Clínicos Ejemplo SpA');
  assert.equal(r.nombre_comercial, 'Clínica Ejemplo');
  assert.equal(r.sitio_fuente, 'clinicaejemplo.cl');
  assert.equal(r.tipo_fuente, 'Prestador acreditado: Atención Cerrada · Alta Complejidad');
  assert.equal(r.rubro_fuente, 'salud');
  const todo = JSON.stringify(r);
  assert.ok(!todo.includes('Persona Ficticia'));
  assert.ok(!todo.includes('11.111.111') && !todo.includes('11111111'));
  assert.ok(!todo.includes('2222222'));
});

test('parseFichaSalud descarta fichas sin RUT válido o de personas naturales', () => {
  assert.equal(f.parseFichaSalud('<html></html>', 'x'), null);
  const natural = FICHA.replace('76.123.456-0', '12.345.678-5');  // check-secrets: ignorar (RUT ficticio para testear la exclusión)
  assert.equal(f.parseFichaSalud(natural, 'x'), null);
});

test('parseListadoSalud lista prestadores y omite inscripciones canceladas y duplicados', () => {
  const html = '<ul><li><a href="https://www.superdesalud.gob.cl/registro/clinica-a/">Clínica A</a></li>' +
    '<li><a href="https://www.superdesalud.gob.cl/registro/cancelada-x/">Inscripción cancelada</a></li>' +
    '<li><a href="https://www.superdesalud.gob.cl/registro/clinica-a">Clínica A</a></li>' +
    '<li><a href="https://www.superdesalud.gob.cl/otra/pagina/">Otra</a></li></ul>';
  assert.deepEqual(f.parseListadoSalud(html), [{ nombre: 'Clínica A', url: 'https://www.superdesalud.gob.cl/registro/clinica-a/' }]);
});

test('parseCmf convierte RUT sin DV, cuenta servicios y marca el rubro', () => {
  const r = f.parseCmf([
    { per_rut: '78076117', per_nombre: '125 GLOBAL INVESTMENTS SPA', per_serv_4: 'Autorizado', per_estado: 'Vigente' },
    { per_rut: '', per_nombre: 'Sin RUT' },
  ]);
  assert.equal(r.length, 1);
  assert.match(r[0].rut, /^78076117-[0-9K]$/);
  assert.equal(r[0].rubro_fuente, 'fintech_seguros');
  assert.equal(r[0].tipo_fuente, 'Prestador Ley Fintec (1 servicio autorizado)');
  assert.equal(r[0].ref_fuente, 'cmf:78076117');
});

test('tamanoPorTramo agrupa los tramos de ventas del SII', () => {
  assert.equal(f.tamanoPorTramo('1'), 'sin_info');
  assert.equal(f.tamanoPorTramo(3), 'micro');
  assert.equal(f.tamanoPorTramo(6), 'pequena');
  assert.equal(f.tamanoPorTramo(9), 'mediana');
  assert.equal(f.tamanoPorTramo(12), 'grande');
});
