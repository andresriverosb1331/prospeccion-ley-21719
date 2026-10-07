// Nodo "Evaluar robots" (workflow B). Requiere lib/senales.js
// Descarta dominios que no responden y los que prohíben rastrear la portada.
const candidatos = $('Generar candidatos').all();
return $input.all()
  .map((item, i) => {
    const c = candidatos[i].json;
    const r = item.json;
    const respondio = typeof r.statusCode === 'number';
    const cuerpo = cuerpoRespuesta(r) || '';
    const esRobots = respondio && r.statusCode === 200 && /user-agent/i.test(cuerpo);
    const disallow = esRobots ? reglasRobots(cuerpo) : [];
    return { json: { ...c, respondio, disallow, home_permitido: respondio && rutaPermitida(disallow, '/') } };
  })
  .filter((item) => item.json.home_permitido);
