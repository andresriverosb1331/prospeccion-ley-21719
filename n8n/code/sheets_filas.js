// Nodo "Preparar filas" (workflow D). Una fila legible por empresa calificada o en revisión.
const SENALES_LEGIBLES = [
  ['politica_privacidad', 'tiene política de privacidad', 'sin política de privacidad'],
  ['menciona_ley_nueva', 'cita la Ley 21.719', null],
  ['politica_plantilla', 'política = plantilla genérica', null],
  ['banner_cookies', 'banner de cookies', null],
  ['trackers', 'usa trackers', null],
  ['formularios_datos', 'formularios con datos personales', null],
  ['login', 'login visible', null],
  ['tienda_online', 'tienda online operando', null],
  ['agenda_online', 'agenda online', null],
  ['sitio_minimo', 'sitio mínimo / en construcción', null],
];

return $input.all()
  .map((item) => item.json)
  .filter((e) => e.id && (e.estado === 'calificada' || e.estado === 'revision'))
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .map((e) => {
    let s = {};
    try { s = JSON.parse(e.senales_json || '{}'); } catch (err) { s = {}; }
    s.politica_plantilla = Boolean(s.politica_origen && s.politica_origen !== 'propia');
    const senales = SENALES_LEGIBLES
      .map(([clave, si, no]) => (s[clave] ? si : no))
      .filter(Boolean)
      .join(' · ');
    return {
      json: {
        hoja: e.estado === 'calificada' ? 'Calificadas' : 'Revision humana',
        Empresa: e.razon_social,
        RUT: e.rut,
        Sitio: e.dominio ? 'https://' + e.dominio + '/' : '',
        Comuna: e.comuna,
        Fuente: e.fuente_lista || 'Registro de Empresas y Sociedades',
        Tamano: e.tamano || '',
        Rubro: e.rubro,
        Score: e.score,
        Segmento: e.segmento,
        Confianza: e.confianza,
        Motivo: e.motivo,
        Evidencia: e.evidencia_url,
        Senales: senales,
        Observacion: e.error || '',
        Actualizado: new Date().toISOString().slice(0, 10),
      },
    };
  });
