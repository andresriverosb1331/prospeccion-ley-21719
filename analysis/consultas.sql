-- Consultas de métricas del pipeline (SQLite). Las ejecuta analysis/metricas.py.
-- Cada bloque empieza con "-- name: <nombre>" para poder cargarlas por separado.

-- name: embudo
-- Cuántas empresas llegan a cada etapa del pipeline.
SELECT 'ingestadas'            AS etapa, COUNT(*) AS empresas FROM empresas
UNION ALL SELECT 'con dominio verificado', COUNT(*) FROM empresas WHERE COALESCE(dominio, '') <> ''
UNION ALL SELECT 'calificadas por IA',     COUNT(*) FROM empresas WHERE estado IN ('calificada', 'revision', 'descartada')
UNION ALL SELECT 'calificadas (score >= 70)', COUNT(*) FROM empresas WHERE estado = 'calificada';

-- name: por_estado
SELECT estado, COUNT(*) AS empresas
FROM empresas
GROUP BY estado
ORDER BY empresas DESC;

-- name: por_rubro
-- Rubro asignado por la IA (solo empresas con sitio verificado).
SELECT COALESCE(rubro, 'sin calificar') AS rubro,
       COUNT(*)                         AS empresas,
       ROUND(AVG(score), 1)             AS score_promedio
FROM empresas
WHERE COALESCE(dominio, '') <> ''
GROUP BY rubro
ORDER BY empresas DESC;

-- name: distribucion_score
SELECT CASE
         WHEN score >= 70 THEN '70-100'
         WHEN score >= 40 THEN '40-69'
         ELSE '0-39'
       END AS tramo,
       COUNT(*) AS empresas
FROM empresas
WHERE score IS NOT NULL
GROUP BY tramo
ORDER BY tramo DESC;

-- name: motivos_revision
-- Por qué una empresa terminó en revisión humana (controles de calidad de la etapa C).
SELECT CASE
         WHEN error LIKE '%sitio_no_corresponde%' THEN 'la IA dice que el sitio no es de la empresa'
         WHEN error LIKE '%ia_error%'             THEN 'error de la API de IA'
         WHEN error LIKE '%json_invalido%'        THEN 'respuesta no es JSON válido'
         WHEN error LIKE '%evidencia%'            THEN 'evidencia no verificable'
         WHEN COALESCE(error, '') = ''            THEN 'score entre 40 y 69 o confianza < 0,6'
         ELSE error
       END AS causa,
       COUNT(*) AS empresas
FROM empresas
WHERE estado = 'revision'
GROUP BY causa
ORDER BY empresas DESC;

-- name: brechas
-- Señales de cumplimiento entre las empresas con sitio verificado.
SELECT COUNT(*)                                                                AS con_sitio,
       SUM(COALESCE(json_extract(senales_json, '$.politica_privacidad'), 0) = 0)            AS sin_politica_privacidad,
       SUM(COALESCE(json_extract(senales_json, '$.menciona_ley_nueva'), 0) = 1)             AS citan_ley_21719,
       SUM(COALESCE(json_extract(senales_json, '$.formularios_datos'), 0) = 1)              AS con_formularios_datos,
       SUM(COALESCE(json_extract(senales_json, '$.trackers'), 0) = 1
           AND COALESCE(json_extract(senales_json, '$.banner_cookies'), 0) = 0)             AS trackers_sin_banner
FROM empresas
WHERE COALESCE(senales_json, '') <> '';

-- name: corridas
SELECT run_id, etapa, procesadas, nuevas, duplicadas, excluidas, enriquecidas, sin_dominio,
       calificadas, revision, descartadas, errores,
       ROUND((julianday(fin) - julianday(inicio)) * 86400, 1) AS segundos
FROM corridas
ORDER BY id;

-- name: tasa_duplicados
SELECT SUM(duplicadas) AS duplicadas,
       SUM(nuevas)     AS nuevas,
       ROUND(100.0 * SUM(duplicadas) / NULLIF(SUM(duplicadas) + SUM(nuevas), 0), 1) AS pct_duplicadas
FROM corridas
WHERE etapa = 'ingesta';

-- name: comparacion_fuentes
-- Fase 1 (RES) vs fase 2 (registros de sectores regulados): ¿qué fuente entrega cuentas útiles?
SELECT COALESCE(NULLIF(fuente_lista, ''), 'Registro de Empresas y Sociedades (fase 1)') AS origen,
       COUNT(*)                                                        AS empresas,
       SUM(COALESCE(dominio, '') <> '')                                AS con_dominio,
       ROUND(100.0 * SUM(COALESCE(dominio, '') <> '') / COUNT(*), 1)   AS pct_dominio,
       SUM(COALESCE(tamano, '') IN ('mediana', 'grande'))              AS medianas_o_grandes_sii,
       SUM(estado = 'calificada')                                      AS calificadas,
       SUM(estado = 'revision')                                        AS en_revision
FROM empresas
GROUP BY origen
ORDER BY empresas DESC;
