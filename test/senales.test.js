'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/senales');

const HOME = `<!doctype html><html><head><title>Clínica Los Pinos | Reñaca</title>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script></head>
<body><nav><a href="/agenda">Agenda tu hora</a> <a href="/politica-de-privacidad">Política de Privacidad</a>
<a href="https://otro-sitio.cl/privacidad">externo</a></nav>
<h1>Bienvenido a Clínica Los Pinos</h1>
<form action="/contacto"><input type="text" name="nombre"><input type="email" name="email"></form>
<p>${'Atención de calidad en Reñaca. '.repeat(40)}</p></body></html>`;

test('verificarSitio acepta el sitio cuando el nombre aparece en el título', () => {
  const r = s.verificarSitio(HOME, { rut: '76123456-0', palabras: ['pinos', 'renaca'] });
  assert.equal(r.ok, true);
  assert.equal(r.evidencia, 'nombre_en_titulo');
});

test('verificarSitio prefiere el RUT como evidencia', () => {
  const html = HOME.replace('</body>', '<footer>RUT 76.123.456-0</footer></body>');
  assert.equal(s.verificarSitio(html, { rut: '76123456-0', palabras: [] }).evidencia, 'rut');
});

test('verificarSitio rechaza dominios estacionados y sitios ajenos', () => {
  const parked = '<html><head><title>pinos.cl</title></head><body>' + 'x'.repeat(300) + ' This domain is for sale! Contact us.</body></html>';
  assert.equal(s.verificarSitio(parked, { rut: '', palabras: ['pinos'] }).evidencia, 'estacionado');
  const enVentaLargo = '<html><head><title>SandsTrading.com is for sale | HugeDomains</title></head><body>' + 'Sands Trading domain. Buy now. '.repeat(300) + '</body></html>';
  assert.equal(s.verificarSitio(enVentaLargo, { rut: '', palabras: ['sands', 'trading'], nombre: 'sands trading' }).evidencia, 'estacionado');
  const ajeno = '<html><head><title>Ferretería Central</title></head><body>' + 'Venta de herramientas. '.repeat(30) + '</body></html>';
  assert.equal(s.verificarSitio(ajeno, { rut: '', palabras: ['pinos', 'renaca'] }).ok, false);
  assert.equal(s.verificarSitio('', { rut: '', palabras: ['pinos'] }).ok, false);
});

test('verificarSitio no acepta una palabra suelta de un nombre compuesto', () => {
  const gonzalez = '<html><head><title>González | Abogados</title></head><body>' + 'Estudio jurídico. '.repeat(30) + '</body></html>';
  const r = s.verificarSitio(gonzalez, { rut: '', palabras: ['gonzalez'], nombre: 'grupo de inversiones gonzalez' });
  assert.equal(r.ok, false);
  const minera = '<html><head><title>Minera Kaniu</title></head><body>' + 'Exploración minera. '.repeat(30) + '</body></html>';
  assert.equal(s.verificarSitio(minera, { rut: '', palabras: ['kaniu'], nombre: 'minera kaniu' }).evidencia, 'nombre_en_titulo');
  const marca = '<html><head><title>Ingeniería Eléctrica - SIMELEC</title></head><body>' + 'Mantenimiento. '.repeat(30) + '</body></html>';
  assert.equal(s.verificarSitio(marca, { rut: '', palabras: ['simelec'], nombre: 'simelec' }).evidencia, 'marca_en_titulo');
  assert.equal(s.verificarSitio(marca.replace('SIMELEC', 'SIMELECTRO'), { rut: '', palabras: ['simelec'], nombre: 'simelec' }).ok, false);
});

test('senalesHome detecta formularios, trackers, login y enlace de política del mismo sitio', () => {
  const r = s.senalesHome(HOME, 'https://clinicalospinos.cl/');
  assert.equal(r.formularios_datos, true);
  assert.equal(r.trackers, true);
  assert.equal(r.banner_cookies, false);
  assert.equal(r.agenda_online, true);
  assert.equal(r.login, false);
  assert.equal(r.tienda_online, false);
  assert.equal(r.sitio_minimo, false);
  assert.match(r.evidencias.agenda_online, /agenda tu hora/);
  assert.equal(r.politica_url, 'https://clinicalospinos.cl/politica-de-privacidad');
  assert.equal(r.contacto_privacidad, false);
});

test('senalesPolitica reconoce la ley citada y el año', () => {
  const pol = '<html><body><h1>Política de privacidad</h1><p>' + 'Tratamiento de sus datos personales conforme a la Ley 19.628, con la finalidad de prestar el servicio y respetando sus derechos de acceso y rectificación. '.repeat(4) + 'Actualizada en marzo de 2021. Escríbanos a privacidad@example.cl</p><footer>© 2026</footer></body></html>';
  const r = s.senalesPolitica(pol);
  assert.equal(r.politica_privacidad, true);
  assert.equal(r.menciona_ley_antigua, true);
  assert.equal(r.menciona_ley_nueva, false);
  assert.equal(r.politica_anio, 2021);
  assert.equal(r.contacto_privacidad_politica, true);
  assert.equal(s.senalesPolitica('<p>corto</p>').politica_privacidad, false);
});

test('reglasRobots y rutaPermitida interpretan el grupo User-agent: *', () => {
  const robots = 'User-agent: Googlebot\nDisallow: /privado\n\nUser-agent: *\nDisallow: /admin\nDisallow: /politica-interna\n';
  const d = s.reglasRobots(robots);
  assert.deepEqual(d, ['/admin', '/politica-interna']);
  assert.equal(s.rutaPermitida(d, '/'), true);
  assert.equal(s.rutaPermitida(d, '/admin/login'), false);
  assert.equal(s.rutaPermitida(s.reglasRobots('User-agent: *\nDisallow: /'), '/'), false);
  assert.deepEqual(s.reglasRobots(''), []);
});

test('puntajeReglas y puntajeFinal siguen la rúbrica', () => {
  const senales = { sitio_activo: true, formularios_datos: true, login: true, tienda_online: true, trackers: true,
    banner_cookies: false, politica_privacidad: false, contacto_privacidad: false };
  const reglas = s.puntajeReglas(senales, { capital: 300000000, anioConstitucion: 2018 });
  assert.deepEqual(reglas, { exposicion_sin_rubro: 20, brecha: 40, viabilidad: 20, total_sin_rubro: 80 });
  assert.equal(s.puntajeFinal(reglas, 'salud', 0), 100);
  assert.equal(s.puntajeFinal(reglas, 'otro', -15), 70);
  const cumple = s.puntajeReglas({ sitio_activo: true, politica_privacidad: true, menciona_ley_nueva: true,
    politica_anio: 2026, contacto_privacidad: true }, { capital: 60000000, anioConstitucion: 2024 });
  assert.equal(cumple.brecha, 0);
  assert.equal(s.puntajeFinal(cumple, 'otro', 0), 15);
});

test('estadoPorPuntaje aplica umbrales y baja confianza', () => {
  assert.equal(s.estadoPorPuntaje(85, 0.9), 'calificada');
  assert.equal(s.estadoPorPuntaje(55, 0.9), 'revision');
  assert.equal(s.estadoPorPuntaje(20, 0.9), 'descartada');
  assert.equal(s.estadoPorPuntaje(90, 0.4), 'revision');
});

test('resolverUrl resuelve enlaces relativos y absolutos sin la clase URL', () => {
  assert.equal(s.resolverUrl('/privacidad', 'https://a.cl/'), 'https://a.cl/privacidad');
  assert.equal(s.resolverUrl('privacidad.html', 'https://a.cl/legal/index.html'), 'https://a.cl/legal/privacidad.html');
  assert.equal(s.resolverUrl('//b.cl/x', 'https://a.cl/'), 'https://b.cl/x');
  assert.equal(s.resolverUrl('mailto:x@example.cl', 'https://a.cl/'), null);
  assert.deepEqual(s.partirUrl('https://WWW.A.cl:443/p?q=1'), { protocolo: 'https', host: 'www.a.cl', ruta: '/p' });
});

// Casos reales que daban falsos positivos (diagnóstico del 2026-10-07).
const RELLENO = '<p>' + 'Somos una empresa con experiencia en servicios profesionales para clientes. '.repeat(20) + '</p>';

test('un plugin de tienda en el código no es una tienda (woocommerce/vtex sin carrito visible)', () => {
  const html = '<html><head><title>Nueva Vida</title><link rel="stylesheet" href="/wp-content/plugins/woocommerce/style.css"></head><body>' + RELLENO + '</body></html>';
  const r = s.senalesHome(html, 'https://a.cl/');
  assert.equal(r.tienda_online, false);
  assert.equal(r.login, false);
  assert.equal(r.plataforma_tienda, 'woocommerce');
});

test('"login" solo en el código no cuenta como login', () => {
  const html = '<html><head><title>Carflex</title><script>var loginUrl = "/api/login";</script></head><body>' + RELLENO + '</body></html>';
  assert.equal(s.senalesHome(html, 'https://a.cl/').login, false);
});

test('login visible con campo de contraseña sí cuenta', () => {
  const html = '<html><head><title>Portal</title></head><body><a href="/mi-cuenta">Mi cuenta</a><form><input type="password" name="clave"></form>' + RELLENO + '</body></html>';
  const r = s.senalesHome(html, 'https://a.cl/');
  assert.equal(r.login, true);
  assert.match(r.evidencias.login, /mi cuenta/);
});

test('tienda "opening soon" es sitio mínimo y no tienda operando', () => {
  const html = '<html><head><title>Vinova</title></head><body>Vinova Opening soon. Sign up for our newsletter. Inicia sesión aquí. Añadir al carrito $12.990 $15.990 <input type="password"></body></html>';
  const r = s.senalesHome(html, 'https://a.cl/');
  assert.equal(r.sitio_minimo, true);
  assert.equal(r.tienda_online, false);
});

test('tienda real: botón de carrito visible y precios', () => {
  const html = '<html><head><title>MediBox</title></head><body>' + RELLENO + '<div>Kit botiquín $12.990 <button>Añadir al carrito</button></div><div>Mascarillas $4.990 <button>Añadir al carrito</button></div></body></html>';
  const r = s.senalesHome(html, 'https://a.cl/');
  assert.equal(r.tienda_online, true);
  assert.equal(r.sitio_minimo, false);
});

test('un sitio mínimo no suma viabilidad por sitio activo', () => {
  const normal = s.puntajeReglas({ sitio_activo: true, sitio_minimo: false }, { capital: 0 });
  const minimo = s.puntajeReglas({ sitio_activo: true, sitio_minimo: true }, { capital: 0 });
  assert.equal(normal.viabilidad - minimo.viabilidad, 5);
});

test('"Próximamente" en el menú de un sitio con contenido no lo vuelve mínimo', () => {
  const html = '<html><head><title>Santa Leonor — Geotecnología</title></head><body><nav>Software Próximamente</nav>' + RELLENO.repeat(3) + '</body></html>';
  assert.equal(s.senalesHome(html, 'https://a.cl/').sitio_minimo, false);
});

test('precios con coma como separador de miles (Shopify) cuentan', () => {
  const html = '<html><head><title>Tienda</title></head><body>' + RELLENO + 'Precio habitual $4,490 CLP · $7,350 CLP · Ver carrito</body></html>';
  assert.equal(s.senalesHome(html, 'https://a.cl/').tienda_online, true);
});

test('una página que solo menciona "Privacidad" en el pie no es una política (404 de Shopify)', () => {
  const html = '<html><head><title>Página no encontrada</title></head><body><h1>404</h1>' + 'Producto no disponible. '.repeat(30) + '<footer>Privacidad · Términos · © 2026</footer></body></html>';
  const r = s.senalesPolitica(html);
  assert.equal(r.politica_privacidad, false);
});

test('reconoce la plantilla de Shopify y no toma el año del copyright', () => {
  const html = '<html><head><title>Política de privacidad MEDIBOX</title></head><body><h1>Política de privacidad</h1>' +
    '<p>Última actualización: 14 de agosto de 2026. MEDIBOX gestiona esta tienda. MEDIBOX cuenta con tecnología de Shopify que nos permite ofrecerle los Servicios. ' +
    'Tratamiento de su información personal, con la finalidad de procesar pedidos; compartimos datos con terceros proveedores de servicios y usted puede ejercer sus derechos. '.repeat(3) +
    '</p><footer>© 2030 Medibox</footer></body></html>';
  const r = s.senalesPolitica(html);
  assert.equal(r.politica_privacidad, true);
  assert.equal(r.politica_origen, 'plantilla_shopify');
  assert.equal(r.politica_anio, 2026);
  const reglas = s.puntajeReglas({ sitio_activo: true, ...r, contacto_privacidad: true }, { capital: 0 });
  assert.equal(reglas.brecha, 12 + 4);
});

test('la ruta de la política según plataforma', () => {
  assert.equal(s.RUTA_POLITICA_PLATAFORMA.shopify, '/policies/privacy-policy');
});

test('la viabilidad usa el tamaño del SII cuando existe', () => {
  const grande = s.puntajeReglas({ sitio_activo: true }, { capital: 0, tamano: 'grande' });
  const sinDato = s.puntajeReglas({ sitio_activo: true }, { capital: 0 });
  assert.equal(grande.viabilidad - sinDato.viabilidad, 10);
});
