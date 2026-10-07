// Nodo "Preparar actualizaciones" (workflow A3 · Cruce SII).
// Une `sii_referencia` con `empresas` por RUT. No pisa un año de constitución que ya exista.
const sii = new Map($('Leer sii_referencia').all().map((i) => [i.json.rut, i.json]).filter(([rut]) => rut));
const salida = [];
for (const item of $('Leer empresas').all()) {
  const e = item.json;
  const s = sii.get(e.rut);
  if (!e.id || !s) continue;
  if (e.tamano === s.tamano && e.trabajadores === s.trabajadores && e.rubro_sii === s.rubro_sii) continue;
  salida.push({
    json: {
      row_id: e.id,
      tamano: s.tamano,
      trabajadores: s.trabajadores,
      rubro_sii: s.rubro_sii,
      comuna: e.comuna || s.comuna,
      anio_constitucion: e.anio_constitucion || s.anio_inicio,
    },
  });
}
return salida;
