# Data Tables de n8n

Crear ambas tablas en n8n (*Overview → Data tables*) antes de importar los workflows.

## `empresas`

Una fila por empresa. Es la **fuente de verdad** del pipeline.

| Columna | Tipo | Quién la escribe | Descripción |
|---|---|---|---|
| `rut` | string | A | RUT de la sociedad, normalizado (`76123456-0`) |
| `razon_social` | string | A | Tal como viene en el RES |
| `nombre_norm` | string | A | Razón social sin tildes, puntuación ni sufijo societario |
| `dedup_key` | string | A | `rut:...` (o `dom:` / `nom:` si no hay RUT válido) |
| `comuna`, `region` | string | A | Domicilio social |
| `capital` | number | A | Capital declarado (CLP) |
| `anio_constitucion` | number | A | Año del archivo del RES |
| `tipo_sociedad` | string | A | SpA, SRL, S.A., ... |
| `fuente` | string | A | `RES datos.gob.cl` |
| `run_id` | string | A | Corrida que la ingresó |
| `estado` | string | A, B, C | `nueva` → `enriquecida` / `sin_dominio` → `calificada` / `revision` / `descartada` |
| `dominio` | string | B | Dominio verificado (vacío si no se encontró) |
| `senales_json` | string | B | Señales de cumplimiento + puntaje por reglas (JSON) |
| `score_reglas` | number | B | Puntaje sin el componente de rubro |
| `rubro`, `segmento` | string | C | Asignados por la IA / por el score |
| `score` | number | C | Puntaje final 0–100 |
| `motivo`, `evidencia_url` | string | C | Justificación de la IA y URL visitada que la respalda |
| `confianza` | number | C | 0–1 |
| `error` | string | C | Controles de calidad que fallaron (`sitio_no_corresponde`, `ia_error`, ...) |

## `corridas`

Una fila por etapa y corrida (más una fila `pipeline` por orquestación y una `error` por falla capturada por Z).

| Columna | Tipo | Descripción |
|---|---|---|
| `run_id` | string | Identificador compartido por todas las etapas de una corrida |
| `etapa` | string | `ingesta` · `enriquecimiento` · `calificacion` · `pipeline` · `error` |
| `inicio`, `fin` | date | Marca de tiempo de la etapa |
| `procesadas`, `nuevas`, `duplicadas`, `excluidas` | number | Ingesta |
| `enriquecidas`, `sin_dominio` | number | Enriquecimiento |
| `calificadas`, `revision`, `descartadas` | number | Calificación |
| `errores` | number | Items con problemas o etapas fallidas |
| `nota` | string | Detalle: filtros, diagnóstico de descartes, rubros, estado de cada etapa |
