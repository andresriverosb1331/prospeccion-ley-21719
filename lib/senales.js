'use strict';

// Extracción de señales de cumplimiento desde el HTML de un sitio y puntaje por reglas
// (ver docs/icp-rubrica.md). Sin dependencias: se antepone a los nodos Code de n8n.

const DOMINIO_ESTACIONADO = /(domain (is )?for sale|este dominio (est[aá] )?(a la venta|disponible)|dominio en venta|parked (free|domain)|sedo\.com|dan\.com|hugedomains|godaddy\.com\/domainsearch|this domain is (registered|parked)|nic chile.*dominio|cuenta suspendida|account suspended|coming soon|sitio en construcci[oó]n|under construction)/i;

const TRACKERS = /(googletagmanager\.com|google-analytics\.com|gtag\(|fbq\(|connect\.facebook\.net|hotjar|clarity\.ms|tiktok\.com\/i18n\/pixel|analytics\.tiktok|doubleclick\.net|hs-scripts\.com|linkedin\.com\/insight|snap\.licdn)/i;
const BANNER_COOKIES = /(cookiebot|onetrust|cookieyes|cookie-law|cookielawinfo|complianz|cookie[-_ ]?consent|cookie[-_ ]?banner|aceptar (todas las )?cookies|usamos cookies|utilizamos cookies|este sitio (web )?utiliza cookies|pol[ií]tica de cookies)/i;
// Señales de interacción: se buscan en el TEXTO VISIBLE (no en el código, donde un plugin
// instalado y sin usar —woocommerce, vtex— o la palabra "login" de un script daban falsos positivos).
const LOGIN_TEXTO = /\b(iniciar sesion|inicia sesion|mi cuenta|ingresa a tu cuenta|ingresar a tu cuenta|log ?in|sign in|acceso clientes|portal (de )?clientes|sucursal virtual)\b/i;
const LOGIN_ENLACE = /href=["'][^"']*(login|signin|sign-in|ingresar|mi-cuenta|my-account|\/account|portal|sucursal)[^"']*["']/i;
const TIENDA_TEXTO = /\b(anadir al carrito|agregar al carro|agregar al carrito|comprar ahora|ver carrito|tu carrito|carro de compras|finalizar compra|ir a pagar)\b/i;
const PRECIO = /\$\s?\d{1,3}(?:[.,]\d{3})+/g;  // $12.990 o $12,990 (Shopify)
const AGENDA_TEXTO = /\b(agenda tu hora|reserva tu hora|reservar hora|agendar (una )?(hora|cita)|reserva online|agenda online)\b/i;
const PLATAFORMA_TIENDA = /(woocommerce|shopify|jumpseller|vtex|prestashop|magento|bsale)/i;
const SITIO_MINIMO = /(coming soon|opening soon|proximamente|en construccion|under construction|just another wordpress site|sitio en mantenimiento|estamos trabajando en nuestro sitio)/i;
const ENLACE_POLITICA = /(privacidad|privacy|datos[-_ ]personales|proteccion[-_ ]de[-_ ]datos|protecci%c3%b3n|aviso[-_ ]legal|tratamiento[-_ ]de[-_ ]datos)/i;
const CONTACTO_PRIVACIDAD = /((privacidad|datos|dpo|protecciondedatos|datospersonales)@[a-z0-9.-]+\.[a-z]{2,}|delegado de protecci[oó]n de datos|encargado de (la )?protecci[oó]n de datos|oficial de (protecci[oó]n de )?datos)/i;

function quitarTildes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function textoVisible(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titulo(html) {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? textoVisible(m[1]) : '';
}

// Formularios que piden datos de personas (email, teléfono, RUT o nombre).
function tieneFormularioDatos(html) {
  const forms = String(html || '').match(/<form[\s\S]*?<\/form>/gi) || [];
  return forms.some((f) => /type=["']?(email|tel)|name=["']?[^"'>]*(email|correo|telefono|phone|rut|nombre|name)/i.test(f));
}

// El nodo HTTP Request de n8n entrega el cuerpo en `body` o en `data` según la respuesta
// (con fullResponse y responseFormat=text). Se lee siempre a través de esta función.
function cuerpoRespuesta(r) {
  if (!r) return null;
  for (const valor of [r.body, r.data]) {
    if (typeof valor === 'string') return valor;
  }
  return null;
}

// El sandbox del nodo Code de n8n no expone la clase global URL: parser mínimo propio.
function partirUrl(url) {
  const m = String(url || '').match(/^(https?):\/\/([^/?#]+)([^?#]*)/i);
  if (!m) return null;
  return { protocolo: m[1].toLowerCase(), host: m[2].toLowerCase().replace(/:\d+$/, ''), ruta: m[3] || '/' };
}

function resolverUrl(href, baseUrl) {
  const base = partirUrl(baseUrl);
  const h = String(href || '').trim().split('#')[0];
  if (!base || !h || /^(mailto|tel|javascript|data):/i.test(h)) return null;
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('//')) return base.protocolo + ':' + h;
  const origen = base.protocolo + '://' + base.host;
  if (h.startsWith('/')) return origen + h;
  const dir = base.ruta.replace(/[^/]*$/, '') || '/';
  return origen + dir + h.replace(/^\.\//, '');
}

// Busca el primer enlace del mismo sitio cuyo href o texto apunte a la política de privacidad.
function enlacePolitica(html, baseUrl) {
  const re = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const base = partirUrl(baseUrl);
  if (!base) return null;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const href = m[1];
    const texto = textoVisible(m[2]);
    if (!ENLACE_POLITICA.test(href) && !ENLACE_POLITICA.test(quitarTildes(texto))) continue;
    const url = resolverUrl(href, baseUrl);
    const partes = partirUrl(url);
    if (!partes || partes.host.replace(/^www\./, '') !== base.host.replace(/^www\./, '')) continue;
    return url;
  }
  return null;
}

// Interpreta robots.txt para User-agent: * y devuelve las rutas prohibidas.
function reglasRobots(texto) {
  const lineas = String(texto || '').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  const disallow = [];
  let aplica = false;
  let enGrupoAgentes = false;
  for (const linea of lineas) {
    const m = linea.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === 'user-agent') {
      if (!enGrupoAgentes) aplica = false;
      enGrupoAgentes = true;
      if (valor === '*') aplica = true;
    } else {
      enGrupoAgentes = false;
      if (aplica && campo === 'disallow' && valor) disallow.push(valor);
    }
  }
  return disallow;
}

function rutaPermitida(disallow, ruta) {
  return !disallow.some((d) => d === '/' || ruta.startsWith(d));
}

// Verifica que el HTML de un dominio candidato corresponda a la empresa.
// `nombre` es la razón social normalizada (sin sufijos) y `palabras` sus palabras distintivas.
// Reglas, de más a menos fuerte:
//  - el sitio muestra el RUT de la empresa;
//  - nombre de una sola palabra (una marca, ej. "simelec"): basta con que aparezca en el título;
//  - nombre con varias palabras: la frase completa (o la de sus palabras distintivas, si son 2+)
//    debe aparecer en el título o el texto. Una sola palabra suelta ("gonzalez", "minera") no basta.
// Devuelve { ok, evidencia, puntos }.
function verificarSitio(html, { rut, palabras, nombre = '' }) {
  if (!html || html.length < 200) return { ok: false, evidencia: 'sin_contenido', puntos: 0 };
  const visible = textoVisible(html);
  const enVenta = /(is for sale|en venta|hugedomains|sedo|dan\.com|afternic|domain parking|parked)/i.test(titulo(html));
  if (enVenta || (DOMINIO_ESTACIONADO.test(visible.slice(0, 5000)) && visible.length < 4000)) {
    return { ok: false, evidencia: 'estacionado', puntos: 0 };
  }
  const tit = quitarTildes(titulo(html).toLowerCase());
  const cuerpo = quitarTildes(visible.toLowerCase());
  const rutNum = String(rut || '').split('-')[0];
  if (rutNum && rutNum.length >= 8) {
    const rutConPuntos = rutNum.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (cuerpo.includes(rutNum) || cuerpo.includes(rutConPuntos)) return { ok: true, evidencia: 'rut', puntos: 3 };
  }
  const limpiar = (t) => ' ' + t.replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const titL = limpiar(tit);
  const cuerpoL = limpiar(cuerpo);
  const nombreL = limpiar(quitarTildes(String(nombre).toLowerCase())).trim();
  const palabrasNombre = nombreL.split(' ').filter(Boolean);
  if (palabrasNombre.length === 1 && palabras.length === 1 && palabras[0].length >= 5) {
    if (titL.includes(' ' + palabras[0] + ' ')) return { ok: true, evidencia: 'marca_en_titulo', puntos: 2 };
    return { ok: false, evidencia: 'no_coincide', puntos: 0 };
  }
  const frases = [nombreL];
  if (palabras.length >= 2) frases.push(palabras.join(' '));
  for (const frase of frases) {
    if (!frase || frase.split(' ').length < 2) continue;
    if (titL.includes(' ' + frase + ' ')) return { ok: true, evidencia: 'nombre_en_titulo', puntos: 2 };
    if (cuerpoL.includes(' ' + frase + ' ')) return { ok: true, evidencia: 'nombre_en_texto', puntos: 1 };
  }
  return { ok: false, evidencia: 'no_coincide', puntos: 0 };
}

// Fragmento del texto alrededor de la coincidencia: queda como evidencia auditable de la señal.
function fragmento(texto, re) {
  const m = re.exec(texto);
  re.lastIndex = 0;
  if (!m) return null;
  return texto.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).trim();
}

function senalesHome(html, baseUrl) {
  const visible = textoVisible(html);
  const visibleSinTildes = quitarTildes(visible).toLowerCase();
  const crudo = String(html || '');
  const palabras = visible.split(' ').filter(Boolean).length;
  const precios = (visible.match(PRECIO) || []).length;

  // "Próximamente" en un menú no hace mínimo a un sitio con contenido: solo cuenta en el título o en sitios pequeños.
  const avisoEnConstruccion = SITIO_MINIMO.test(quitarTildes(titulo(html))) ||
    (palabras < 400 && SITIO_MINIMO.test(quitarTildes(visible.slice(0, 3000))));
  const minimo = palabras < 150 || avisoEnConstruccion;
  const tienePassword = /type=["']?password/i.test(crudo);
  // En un sitio mínimo el "iniciar sesión" suele ser el acceso del dueño (p. ej. tienda Shopify cerrada).
  const login = !minimo && LOGIN_TEXTO.test(visibleSinTildes) && (tienePassword || LOGIN_ENLACE.test(crudo));
  const textoTienda = TIENDA_TEXTO.test(visibleSinTildes);
  // Una tienda cuenta solo si se ve operando: botón de carrito/compra y al menos 2 precios, y no es un sitio "próximamente".
  const tienda = textoTienda && precios >= 2 && !minimo;
  const agenda = AGENDA_TEXTO.test(visibleSinTildes);
  const formularios = tieneFormularioDatos(crudo);

  return {
    sitio_activo: true,
    sitio_minimo: minimo,
    palabras_visibles: palabras,
    titulo: titulo(html).slice(0, 120),
    politica_url: enlacePolitica(html, baseUrl),
    banner_cookies: BANNER_COOKIES.test(crudo),
    trackers: TRACKERS.test(crudo),
    formularios_datos: formularios,
    login,
    tienda_online: tienda,
    agenda_online: agenda,
    plataforma_tienda: (crudo.match(PLATAFORMA_TIENDA) || [null])[0],
    contacto_privacidad: CONTACTO_PRIVACIDAD.test(crudo),
    evidencias: {
      login: login ? fragmento(visibleSinTildes, LOGIN_TEXTO) : null,
      tienda_online: tienda ? fragmento(visibleSinTildes, TIENDA_TEXTO) : null,
      agenda_online: agenda ? fragmento(visibleSinTildes, AGENDA_TEXTO) : null,
      sitio_minimo: minimo ? (palabras < 150 ? palabras + ' palabras visibles' : fragmento(quitarTildes(titulo(html) + ' ' + visible), SITIO_MINIMO)) : null,
    },
    extracto: visible.slice(0, 1500),
  };
}

// Términos propios del cuerpo de una política (no de un pie de página con el enlace "Privacidad").
const TERMINOS_POLITICA = [
  /datos personales|informacion personal|personal information/, /tratamiento/, /finalidad|proposito|fines/,
  /derechos?( de)? (acceso|rectificacion|cancelacion|oposicion|arco)|ejercer (sus|tus) derechos/,
  /consentimiento/, /terceros|proveedores de servicios/, /conserva(cion|remos)|retencion|plazo/,
  /cookies/, /seguridad de (la informacion|los datos|sus datos)/,
];
// Políticas generadas por la plataforma o por un generador: válidas, pero genéricas.
const PLANTILLA_PLATAFORMA = /(cuenta con tecnologia de shopify|con tecnologia de shopify|powered by shopify|esta tienda (funciona|esta alojada) (con|en) shopify|shopify inc)/;
const PLANTILLA_GENERADOR = /(termly|iubenda|privacypolicies\.com|generador de (politicas|terminos)|termsfeed|freeprivacypolicy)/;

// Rutas conocidas de la política según la plataforma del sitio (cuando la portada no la enlaza).
const RUTA_POLITICA_PLATAFORMA = {
  shopify: '/policies/privacy-policy',
};

function senalesPolitica(html) {
  const crudo = String(html || '');
  const visible = quitarTildes(textoVisible(crudo)).toLowerCase();
  if (!visible || visible.length < 300) return { politica_privacidad: false };
  const encabezado = quitarTildes(titulo(crudo) + ' ' + ((crudo.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')).toLowerCase();
  const tituloDePolitica = /(privacidad|privacy|datos personales|proteccion de datos|tratamiento de datos)/.test(encabezado);
  const terminos = TERMINOS_POLITICA.filter((re) => re.test(visible)).length;
  // Es una política si su título/H1 lo dice y el cuerpo usa al menos 3 términos propios de una.
  const esPolitica = tituloDePolitica && terminos >= 3;
  if (!esPolitica) return { politica_privacidad: false, politica_terminos: terminos };
  // Año de la política: solo el que acompaña a "actualización / vigencia / modificación", nunca el "© 2026" del pie.
  const fechas = [...visible.matchAll(/(actualiza\w*|vigen\w*|modifica\w*|fecha de (entrada|publicacion)\w*)[^.]{0,60}?\b(20[12]\d)\b/g)]
    .map((m) => Number(m[3])).filter((a) => a <= 2026);
  const origen = PLANTILLA_PLATAFORMA.test(visible) ? 'plantilla_shopify'
    : PLANTILLA_GENERADOR.test(visible) ? 'plantilla_generador' : 'propia';
  return {
    politica_privacidad: true,
    politica_terminos: terminos,
    politica_origen: origen,
    menciona_ley_nueva: /21\.?719/.test(visible),
    menciona_ley_antigua: /19\.?628/.test(visible),
    politica_anio: fechas.length ? Math.max(...fechas) : null,
    contacto_privacidad_politica: CONTACTO_PRIVACIDAD.test(visible),
  };
}

// Puntaje por reglas SIN el componente de rubro (lo agrega la etapa de IA).
function puntajeReglas(s, { capital, anioConstitucion, tamano, anioActual = 2026 }) {
  let exposicion = 0;
  if (s.formularios_datos) exposicion += 6;
  if (s.login) exposicion += 6;
  if (s.tienda_online) exposicion += 6;
  if (s.agenda_online) exposicion += 6;
  if (s.trackers) exposicion += 4;
  exposicion = Math.min(exposicion, 20);

  let brecha = 0;
  if (!s.politica_privacidad) brecha += 20;
  else if (!s.menciona_ley_nueva || (s.politica_anio && s.politica_anio < 2025)) brecha += 12;
  // Una plantilla de la plataforma no está adaptada al negocio ni a la ley chilena: la tienda
  // sigue siendo responsable de los datos de sus clientes aunque use Shopify.
  if (s.politica_privacidad && s.politica_origen && s.politica_origen !== 'propia' && !s.menciona_ley_nueva) brecha += 4;
  if (!s.contacto_privacidad && !s.contacto_privacidad_politica) brecha += 10;
  if (s.trackers && !s.banner_cookies) brecha += 10;
  brecha = Math.min(brecha, 40);

  // Un sitio mínimo (landing vacía, "próximamente") no demuestra operación: no suma por sitio activo.
  let viabilidad = s.sitio_activo && !s.sitio_minimo ? 5 : 0;
  // Tamaño según ventas (SII) si existe; si no, el capital declarado como proxy.
  if (tamano === 'grande' || tamano === 'mediana') viabilidad += 10;
  else if (tamano === 'pequena') viabilidad += 5;
  else if (capital >= 200000000) viabilidad += 10;
  else if (capital >= 50000000) viabilidad += 5;
  if (anioConstitucion && anioActual - anioConstitucion >= 5) viabilidad += 5;
  viabilidad = Math.min(viabilidad, 20);

  return { exposicion_sin_rubro: exposicion, brecha, viabilidad, total_sin_rubro: exposicion + brecha + viabilidad };
}

const PUNTOS_RUBRO = {
  salud: 20, fintech_seguros: 20, educacion: 20, rrhh: 20,
  retail_ecommerce: 14, saas_tecnologia: 14, inmobiliario: 14, marketing: 14,
  otro: 5,
};

// Puntaje final: reglas + rubro (topado a 40 en exposición) + ajuste de la IA (±15), en 0..100.
function puntajeFinal(reglas, rubro, ajuste) {
  const puntosRubro = PUNTOS_RUBRO[rubro] ?? 5;
  const exposicion = Math.min(reglas.exposicion_sin_rubro + puntosRubro, 40);
  const ajusteAcotado = Math.max(-15, Math.min(15, Number(ajuste) || 0));
  const total = exposicion + reglas.brecha + reglas.viabilidad + ajusteAcotado;
  return Math.max(0, Math.min(100, Math.round(total)));
}

function estadoPorPuntaje(score, confianza) {
  if (Number(confianza) < 0.6) return 'revision';
  if (score >= 70) return 'calificada';
  if (score >= 40) return 'revision';
  return 'descartada';
}

module.exports = {
  cuerpoRespuesta, partirUrl, resolverUrl, textoVisible, titulo, RUTA_POLITICA_PLATAFORMA, tieneFormularioDatos, enlacePolitica, reglasRobots, rutaPermitida,
  verificarSitio, senalesHome, senalesPolitica, puntajeReglas, puntajeFinal, estadoPorPuntaje,
  PUNTOS_RUBRO,
};
