'use strict';

// Ejecuta localmente los nodos Code del workflow B contra los sitios reales, para depurar sin n8n.
// Uso: node scripts/simular_b.js data/raw/empresas.json [limite]
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const UA = 'ProspeccionLey21719Bot/0.1 (respeta robots.txt)';

function cargarNodo(nombre) {
  let src = fs.readFileSync(path.join(RAIZ, 'n8n', 'code', nombre + '.js'), 'utf8');
  const libs = src.split('\n')[0].match(/lib\/[a-z_]+\.js/g) || [];
  const prefijo = libs.map((r) => fs.readFileSync(path.join(RAIZ, r), 'utf8')
    .replace("'use strict';", '').replace(/module\.exports\s*=\s*\{[^}]*\};\s*/s, '')).join('\n');
  return new Function('$', '$input', '$json', 'URL', prefijo + '\n' + src);
}

function todos(nombre, nodos, entrada) {
  const $ = (n) => {
    const items = nodos[n].map((json) => ({ json }));
    return { all: () => items, first: () => items[0] };
  };
  const items = entrada.map((json) => ({ json }));
  return cargarNodo(nombre)($, { all: () => items, first: () => items[0] }, undefined).map((i) => i.json);
}

async function get(url, timeout) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': UA } });
    return { statusCode: r.status, body: await r.text(), headers: {} };
  } catch (e) {
    return { error: { message: e.message } };
  }
}

async function enLotes(items, fn, tam = 10) {
  const out = [];
  for (let i = 0; i < items.length; i += tam) out.push(...(await Promise.all(items.slice(i, i + tam).map(fn))));
  return out;
}

(async () => {
  const filas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).rows.slice(0, Number(process.argv[3]) || 100);
  const params = { run_id: 'sim', inicio: new Date().toISOString(), limite: 100 };
  const cand = todos('enriq_candidatos', {}, filas);
  const robots = await enLotes(cand, (c) => get(c.robots_url, 6000));
  const evaluados = todos('enriq_robots', { 'Generar candidatos': cand }, robots);
  const portadas = await enLotes(evaluados, (c) => get('https://' + c.host + '/', 10000), 5);
  const verif = todos('enriq_verificar', { 'Parámetros B': [params], 'Leer empresas nuevas': filas, 'Evaluar robots': evaluados }, portadas);
  console.log('candidatos', cand.length, 'respondieron', evaluados.length, 'diag', JSON.stringify(verif[0] && verif[0].diag));
  const con = verif.filter((v) => v.estado === 'con_dominio');
  console.log('con dominio:', con.map((v) => v.razon_social + ' -> ' + v.dominio + ' (' + v.verificacion + ')').join('\n  '));
  for (const v of con) {
    const pol = await get(v.politica_url, 10000);
    const senal = cargarNodo('enriq_senales')((n) => ({ item: { json: v } }), null, pol).json;
    console.log(v.dominio, 'score_reglas', senal.score_reglas, JSON.parse(senal.senales_json).politica_privacidad);
  }
})();
