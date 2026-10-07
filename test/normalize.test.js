'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularDV, parseRut, normalizarDominio, normalizarRazonSocial, dedupKey, candidatosDominio,
  palabrasDistintivas,
} = require('../lib/normalize');

test('calcularDV cubre los casos 0, K y numéricos', () => {
  assert.equal(calcularDV('11111111'), '1');
  assert.equal(calcularDV('77777777'), '7');
  assert.equal(calcularDV(String(Array.from({ length: 200 }, (_, i) => 76000000 + i).find((n) => calcularDV(String(n)) === '0'))), '0');
  assert.equal(calcularDV('78325555'), '3');
  assert.equal(calcularDV('78325512'), 'K');
  assert.equal(calcularDV('78325537'), '5');
});

test('parseRut acepta distintos formatos y valida el DV', () => {
  assert.deepEqual(parseRut('78.325.512-k'), {
    valido: true, cuerpo: '78325512', dv: 'K', rut: '78325512-K', personaJuridica: true,
  });
  assert.equal(parseRut('783255553').valido, true);
  assert.equal(parseRut('78325555-4').valido, false);
  assert.equal(parseRut('').valido, false);
  assert.equal(parseRut(null).valido, false);
});

test('parseRut marca a las personas naturales (RUT < 50.000.000)', () => {
  const persona = parseRut(`12345678-${calcularDV('12345678')}`);
  assert.equal(persona.valido, true);
  assert.equal(persona.personaJuridica, false);
  assert.equal(parseRut('78325555-3').personaJuridica, true);
});

test('normalizarDominio limpia protocolo, www, ruta y puerto', () => {
  assert.equal(normalizarDominio('https://www.Empresa.cl/contacto?x=1'), 'empresa.cl');
  assert.equal(normalizarDominio('http://shop.empresa.com:8080'), 'shop.empresa.com');
  assert.equal(normalizarDominio('empresa.cl'), 'empresa.cl');
  assert.equal(normalizarDominio('no es un dominio'), null);
  assert.equal(normalizarDominio(''), null);
});

test('normalizarRazonSocial quita tildes, puntuación y sufijos societarios', () => {
  assert.equal(normalizarRazonSocial('Inversiones Pérez & Cía. Ltda.'), 'inversiones perez');
  assert.equal(normalizarRazonSocial('ECS Group SpA'), 'ecs group');
  assert.equal(normalizarRazonSocial('Comercial Andes S.A.'), 'comercial andes');
  assert.equal(normalizarRazonSocial('Innovarte Chile Figueroa y Reyes Limitada'), 'innovarte chile figueroa y reyes');
  assert.equal(normalizarRazonSocial('SpA'), 'spa');
});

test('dedupKey prioriza RUT, luego dominio, luego nombre', () => {
  assert.equal(dedupKey({ rut: '78.325.512-K', dominio: 'x.cl', razonSocial: 'X' }), 'rut:78325512-K');
  assert.equal(dedupKey({ rut: 'malo', dominio: 'www.x.cl', razonSocial: 'X' }), 'dom:x.cl');
  assert.equal(dedupKey({ rut: '', dominio: '', razonSocial: 'Astraly SpA' }), 'nom:astraly');
  assert.equal(dedupKey({}), null);
});

test('dedupKey trata como iguales variantes de la misma empresa', () => {
  const a = dedupKey({ rut: '78325512-K' });
  const b = dedupKey({ rut: '78.325.512-k' });
  assert.equal(a, b);
});

test('candidatosDominio genera slugs .cl y .com sin palabras de giro sueltas', () => {
  assert.deepEqual(candidatosDominio('Astraly SpA'), ['astraly.cl', 'astraly.com']);
  const c = candidatosDominio('Inversiones Club Exponencial SpA');
  assert.ok(c.includes('clubexponencial.cl'));
  assert.ok(c.includes('club-exponencial.cl'));
  assert.ok(c.length <= 8);
  const inmob = candidatosDominio('Inmobiliaria e Inversiones Miraflores SpA');
  assert.ok(inmob.includes('miraflores.cl'));
  assert.ok(!inmob.includes('inmobiliaria.cl'));
  assert.deepEqual(candidatosDominio('SpA'), []);
});

test('palabrasDistintivas descarta palabras de giro y cortas', () => {
  assert.deepEqual(palabrasDistintivas('Clínica Los Pinos de Reñaca SpA'), ['pinos', 'renaca']);
  assert.deepEqual(palabrasDistintivas('Inversiones y Servicios SpA'), []);
});
