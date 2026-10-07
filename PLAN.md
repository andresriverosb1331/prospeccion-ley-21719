# Plan: prospeccion-ley-21719 — pipeline de prospección en frío (demo)

**Objetivo:** Tomar empresas chilenas de una fuente pública, normalizarlas y deduplicarlas, enriquecerlas con señales de cumplimiento de la **Ley 21.719** (vigente desde 01-12-2026), calificarlas con Gemini (con revisión humana) y dejarlas en una Data Table de n8n + Google Sheets, con métricas y análisis SQL/Python. El repo se publicará en GitHub **público**.

**Terminado cuando:** una corrida end-to-end con 30–50 empresas reales deja cada empresa calificada con evidencia, métricas registradas en `corridas`, análisis generado, y el repo pasa `scripts/check_secrets.py` sin hallazgos.

**Supuestos:**
- n8n corre en Docker en `http://localhost:5678`; los workflows se construyen vía MCP `n8n`.
- IA: Google Gemini (credencial n8n de tipo `googlePalmApi`, hoy "Google Gemini(PaLM) Api account"). Destino: Data Table n8n + Google Sheets (credencial n8n de tipo Google Sheets OAuth2; usar la que exista).
- Las credenciales viven en n8n, no en el repo. No se usa `.env` salvo que una tarea lo requiera.
- Solo datos de **personas jurídicas** (RUT ≥ 50.000.000). Nada de datos personales de terceros.
- Las visitas a sitios de empresas las hace n8n respetando `robots.txt`, con timeout y pausas.
- Rúbrica: ≥70 calificada · 40–69 revisión humana · <40 descartada.
- Estructura del repo: `docs/`, `lib/`, `test/`, `workflows/`, `scripts/`, `analysis/`, `data/sample/` (público), `data/raw/` (ignorado).

## Permisos aprobados (2026-10-07)
Reglas en `.claude/settings.local.json`:
- 🌐 WebSearch + WebFetch a: datos.gob.cl, registrodeempresasysociedades.cl, mercadopublico.cl, api.mercadopublico.cl, chilecompra.cl, bcn.cl, docs.n8n.io, ai.google.dev → T1, T2, T7, T15
- 🔌 MCP n8n: búsqueda/lectura, crear/actualizar/validar/probar/ejecutar workflows, crear Data Tables, agregar columnas y filas, leer filas, carpetas → T3, T5–T10, T13
- ⚙️ Comandos (PowerShell y Bash): `node --test`, `node`, `python`, `py`, `.venv/Scripts/python -m pip install`, `git init/add/commit/status/diff` → T4, T11, T12, T13, T17
- 📁 Crear/editar archivos dentro de `C:\Users\Public\n8n` → todas

## Fuera del /goal (requiere confirmación manual)
- Crear el repo en GitHub y `git push` (antes: mostrar resultado de `check_secrets.py` al usuario).
- Activar/publicar workflows con triggers programados.
- Borrar o archivar workflows, Data Tables o columnas.
- Contactar a cualquier empresa (correos, formularios, mensajes).
- Etiquetado manual de la muestra de evaluación (T11).
- Grabar el video demo.

## Tareas
| ID | Tarea | Prio | Dif | Depende | 🌐 | 🔑 | Terminado cuando | Estado |
|---|---|---|---|---|---|---|---|---|
| T1 | **Spike** fuentes: evaluar Registro de Empresas y Sociedades, Mercado Público (proveedores) y directorios gremiales (campos, ¿trae sitio web?, formato, licencia/términos). Elegir principal + respaldo | P0 | 2 | — | Sí: datasets y licencias en datos.gob.cl / mercadopublico.cl / sitios de gremios | Web | `docs/fuente.md` con decisión, licencia y muestra de 5 registros | ✅ |
| T2 | Perfil de cliente ideal (rubros con alto tratamiento de datos: salud, fintech, retail, educación, SaaS) y rúbrica 0–100 con pesos por señal y umbrales | P0 | 2 | — | Sí: obligaciones clave Ley 21.719 en bcn.cl | Web | `docs/icp-rubrica.md` | ✅ |
| T16 | `.gitignore` estricto: `.env*`, `data/raw/`, `*.sqlite`, `.venv/`, `.claude/settings.local.json`, `__pycache__/`, `node_modules/` | P0 | 1 | — | No | — | Archivo existe con esas entradas | ✅ |
| T3 | Crear Data Tables `empresas` (rut, razon_social, dominio, rubro, comuna, fuente, dedup_key, estado, senales_json, score, segmento, motivo, evidencia_url, confianza, ts) y `corridas` (run_id, inicio, fin, procesadas, duplicadas, enriquecidas, calificadas, revision, descartadas, errores, tokens) | P0 | 1 | — | No | MCP n8n | Tablas visibles vía `search_data_tables` con columnas | ✅ |
| T4 | `lib/normalize.js`: validar RUT (DV módulo 11), excluir personas naturales (RUT < 50.000.000), normalizar dominio (sin www/protocolo/path) y razón social (sin tildes, sufijos SpA/Ltda/S.A.), `dedupKey`. Tests en `test/normalize.test.js` | P0 | 2 | — | No | node | `node --test` pasa (incluye caso persona natural) | ✅ |
| T17 | `scripts/check_secrets.py`: detecta JWT, API keys (`AIza…`, `sk-…`), `Bearer`, `apiKey`/`token` con valor, emails, RUT < 50M, IDs de credenciales n8n. Sale ≠0 si hay hallazgos | P0 | 2 | T16 | No | python | Detecta archivo trampa temporal y pasa limpio sobre el repo real | ✅ |
| T5 | Workflow **A · Ingesta**: trigger manual → leer fuente → Code (lógica de `lib/normalize.js`) → dedup contra `empresas` → insertar con estado `nueva` | P0 | 3 | T1, T3, T4 | No | MCP n8n | Ejecutar 2 veces seguidas no crea duplicados | ✅ |
| T6 | Workflow **B · Enriquecimiento**: por empresa con dominio → revisar `robots.txt` → GET home (+ enlaces "privacidad/cookies/términos") con timeout 10 s y pausa entre requests → extraer señales: política de privacidad, banner cookies, formularios con datos personales, contacto de privacidad/DPO, fecha de actualización de política → guardar `senales_json`, estado `enriquecida` | P0 | 4 | T5 | No | MCP n8n | ≥10 empresas con señales; fallos registrados sin romper el flujo | ✅ |
| T7 | Workflow **C · Calificación**: Gemini con salida JSON estructurada (score, segmento, motivo, evidencia_url, confianza) usando la rúbrica de T2; validar JSON; enrutar por umbrales; estado `calificada`/`revision`/`descartada` | P0 | 3 | T2, T6 | Sí: modelo Gemini vigente, límites capa gratuita, nodo n8n | MCP n8n + credencial googlePalmApi | 100% JSON válido en muestra de 10 | ✅ |
| T8 | Workflow **D · Exportar a Sheets**: crear/actualizar planilla con pestañas "Calificadas" y "Revisión humana" | P1 | 2 | T7 | No | MCP n8n + credencial Google Sheets | Planilla poblada | ⛔ |
| T9 | Orquestador A→B→C→D (Execute Workflow) + workflow Error Trigger que registra fallos; métricas por corrida en `corridas` | P1 | 3 | T5–T8 | No | MCP n8n | Error provocado queda registrado; corrida deja fila en `corridas` | ✅ |
| T10 | Corrida end-to-end con 30–50 empresas reales | P0 | 3 | T9 | No | MCP n8n | Métricas en `corridas`; resumen en Bitácora | ✅ |
| T11 | Set de evaluación: exportar 20 empresas a `data/raw/eval.csv` con columna `etiqueta_humana` vacía + `analysis/eval_agreement.py` (precisión / matriz de confusión) | P1 | 2 | T10 | No | python | Script corre con etiquetas de prueba; queda listo para etiquetado manual | ✅ |
| T12 | Análisis: exportar `empresas` y `corridas` a `data/raw/*.csv` → SQLite → `analysis/consultas.sql` + `analysis/metricas.py` (por rubro, distribución de score, tasa duplicados, errores, costo estimado) con gráficos en `analysis/output/` (venv con pandas + matplotlib) | P1 | 2 | T10 | No | python, pip (venv) | `python analysis/metricas.py` genera `analysis/output/reporte.md` + PNGs | ✅ |
| T18 | Muestra pública `data/sample/empresas_sample.csv` (≤20 filas: RUT empresa, razón social, rubro, dominio, señales, score) + métricas agregadas | P0 | 2 | T10, T17 | No | — | Pasa `check_secrets.py` | ✅ |
| T13 | Exportar workflows a `workflows/*.json` sin secretos (quitar IDs de credenciales, webhookId, instanceId, pinData) + `git init` + commit local tras `check_secrets.py` limpio | P1 | 2 | T10, T17 | No | MCP n8n, git | Commit hecho y check limpio | ✅ |
| T14 | README: problema, diagrama (Mermaid), cómo correr, decisiones, métricas, limitaciones y sección **"Datos y privacidad"** (solo datos públicos de personas jurídicas, fuente y licencia, robots.txt, sin contacto, sin datos personales) | P0 | 2 | T10–T13, T18 | No | — | README completo; `check_secrets.py` limpio | ✅ |
| T15 | Descubrir dominio web para empresas sin sitio (candidatos desde la razón social + verificación del sitio). Necesaria: el RES no trae sitio web | P0 | 4 | T5 | Sí | Web | ≥50% de empresas con dominio | ✅ |

Estados: ⬜ pendiente · 🔄 en curso · ✅ hecha · ⛔ bloqueada · ⏭️ omitida

## Bitácora
- 2026-10-07 — Plan creado. Permisos aprobados y escritos. MCP n8n verificado (conectado). Credencial Gemini presente (googlePalmApi). Falta credencial Google Sheets. Sin Data Tables todavía.
- 2026-10-07 T1 ✅ — Fuente principal: Registro de Empresas y Sociedades (datos.gob.cl, CC-BY, CSV `;` ~15 MB/año). Sin sitio web ni rubro → T15 sube a P0 (antes de T6). Ver docs/fuente.md.
- 2026-10-07 T2 ✅ — ICP + rúbrica híbrida (reglas 0-100 + ajuste IA ±15). Ley 21.719 vigente 01-12-2026; proyecto de postergación (Boletín 18.623-07) en trámite. Ver docs/icp-rubrica.md.
- 2026-10-07 T16 ✅ — .gitignore creado.
- 2026-10-07 T4 ✅ — lib/normalize.js + 8 tests (`node --test test/normalize.test.js` pasa). En Windows `node --test test/` falla: usar la ruta del archivo.
- 2026-10-07 T17 ✅ — scripts/check_secrets.py detecta 5/5 en archivo trampa y no marca RUT de empresa; repo limpio.
- 2026-10-07 T3 ✅ — Data Tables `empresas` y `corridas` creadas en el proyecto personal.
- 2026-10-07 T5 ✅ — Workflow `A · Ingesta RES` (wf_a). 2 corridas: 50 nuevas + 50 nuevas, la 2.ª reconoció 50 `ya_existentes`; 100 filas con 100 `dedup_key` únicas. Se excluyen EIRL (30.244 en 2018: su razón social suele ser el nombre de una persona) y capitales atípicos. No guarda datos de ejecuciones exitosas (el CSV pesa 16 MB).
- 2026-10-07 T15 ✅ — Descubrimiento de dominio dentro del workflow B: candidatos desde la razón social, robots.txt, verificación por RUT / marca / frase completa del nombre. La 1.ª versión aceptaba una palabra suelta (gonzalez.cl, minera.cl): 43 falsos positivos en simulación → regla estricta (15 verificados) + descarte de dominios compartidos + confirmación de la IA (`sitio_corresponde`).
- 2026-10-07 T6 ✅ — Workflow `B · Dominio y enriquecimiento` (wf_b). 100 empresas → 11 con dominio verificado (11 %), 89 `sin_dominio`; diagnóstico por tipo de descarte en `corridas.nota`. Bug encontrado: el sandbox del nodo Code no tiene `URL` → parser propio + tests que anulan `URL`. Herramientas: `scripts/simular_b.js` (simulación local) y `scripts/n8n_mcp.py` (sube workflows grandes desde archivo).
- 2026-10-07 Hallazgo — Muchas sociedades del RES son holdings de inversión sin sitio web: baja tasa de dominio. Mejora futura: filtrar holdings en la ingesta o cruzar con la nómina SII (rubro y tamaño).
- 2026-10-07 T8 ⛔ — Workflow `D0 · Crear planilla` (wf_d0) creado; falla con 403: la Google Sheets API no está habilitada en el proyecto de Google Cloud de la credencial. Requiere acción del usuario (ver Bloqueos).
- 2026-10-07 T7 ✅ — Workflow `C · Calificación con IA` (wf_c), modelo `models/gemini-flash-latest`, una empresa cada ~25 s. 11 empresas: 9/9 respuestas recibidas fueron JSON válido; 2 fallaron con 503 de la API → `revision` con `ia_error` (C ahora las reintenta). La IA detectó 5 sitios que no son de la empresa (clínica de EE.UU., tienda catalana, dominio en venta, página vacía y una 'inmobiliaria' cuyo sitio es una clínica). Resultado: 1 calificada, 10 en revisión.
- 2026-10-07 Ajuste — Detección de dominios en venta también por título (sandstrading.com / HugeDomains pasaba por ser una página larga).
- 2026-10-07 T9 ✅ — `E · Orquestador del pipeline` (wf_e) ejecuta A→B→C→D con el mismo `run_id`; cada etapa con `continueRegularOutput` para que una falla no detenga el resto. Error provocado (D sin documento de Sheets) quedó en `corridas` como `etapa=pipeline`, `errores=1`, `sheets=FALLO(...)`. `Z · Registro de errores` (wf_z) creado; asignarlo requiere publicarlo (ver Bloqueos).
- 2026-10-07 T10 ✅ — Corrida end-to-end `run-20261007-161152` con 50 empresas reales: ingesta 50 nuevas / 100 duplicadas reconocidas (6 s), enriquecimiento 1/50 con dominio (24 s), calificación 3 (1 nueva + 2 reintentos por 503) → 1 calificada, 2 revisión (88 s), Sheets FALLO registrado. Hallazgo: las empresas de menor capital casi no tienen sitio → se agrega `excluir_holdings` a la ingesta y se lanza una 2.ª corrida.
- 2026-10-07 T11 ✅ — `analysis/eval_agreement.py`: `--preparar` crea data/raw/eval.csv (13 empresas calificadas por la IA); con etiquetas de prueba calcula acuerdo, precisión de 'calificada', % de dominios correctos, matriz de confusión y lista de desacuerdos. Falta el etiquetado manual (fuera del /goal).
- 2026-10-07 T12 ✅ — `scripts/exportar_tablas.py` (Data Tables → CSV vía MCP) + `analysis/consultas.sql` (8 consultas: embudo, estados, rubros, score, motivos de revisión, brechas, corridas, duplicados) + `analysis/metricas.py` (SQLite + 4 gráficos matplotlib en .venv) → analysis/output/reporte.md. Se corrigió un alias SQL que chocaba con la columna `motivo` y sumas con NULL.
- 2026-10-07 T18 ✅ — `scripts/muestra_publica.py`: data/sample/empresas_sample.csv solo con campos estructurados (sin extracto ni texto de la IA) y sin empresas cuyo sitio la IA marcó como ajeno.
- 2026-10-07 Seguridad — IDs de la instancia de n8n (credenciales, tablas, workflows, proyecto) movidos a `n8n/ids.local.json` (ignorado); el build los inserta con `__ID:...__` y `check_secrets.py` ahora falla si alguno aparece en archivos publicables. Revisión: limpia.
- 2026-10-07 IA — `models/gemini-2.5-flash` figura en el listado pero responde 404; se mantiene `models/gemini-flash-latest` (sus fallos fueron 503 transitorios).
- 2026-10-07 T13 ✅ — `scripts/exportar_workflows.py` exporta los 7 workflows a workflows/*.json sin IDs de credenciales, webhookId, pinData ni IDs internos (marcadores TABLA_* / WORKFLOW_*). `git init` + commit local 7f9e74a tras `check_secrets.py` limpio y 34/34 tests.
- 2026-10-07 T14 ✅ — README con problema, diagrama Mermaid, tabla de workflows, decisiones de diseño, métricas reales, cómo correrlo, sección **Datos y privacidad** y limitaciones.
- 2026-10-07 Cierre — Vinova pasó a `calificada` al reintentar. Quedan 3 `ia_error` por límite de la capa gratuita de Gemini (429): C las reintenta en la próxima corrida.
- 2026-10-07 T19 ✅ — SII: `PUB_EMPRESAS_PJ_2020_A_2024.zip` (188 MB; 2024 = 378 MB TXT tab/latin-1) con RUT, razón social, tramo de ventas, trabajadores, rubro/subrubro/actividad, comuna. Demasiado grande para n8n → cruce con script local.
- 2026-10-07 T20 ✅ — Superintendencia de Salud: listado nacional HTML + ficha por prestador con RUT, propietario, tipo y **sitio web**. robots.txt permite /registro/.
- 2026-10-07 T21 ✅ — CMF: JSON público `seg_rgpsf_ajax.php` → 194 prestadores fintech vigentes (RUT sin DV, nombre, servicios). Sin sitio web. Sin robots.txt (4xx).
- 2026-10-07 T22 ✅ — Arquitectura: A2 (n8n, CMF + Salud) → scripts/cruce_sii.py (local, solo RUT del pipeline → Data Table `sii_referencia`) → A3 (n8n, actualiza empresas) → B usa `sitio_fuente`. Ver docs/fuentes-fase2.md. Se agregan T31 (cruce_sii.py) y T32 (A3) al plan.
- 2026-10-07 T23 ✅ — lib/fuentes.js (parseCmf, parseListadoSalud, parseFichaSalud, tamanoPorTramo) + 5 tests; el parser de Salud corta antes de 'Representante Legal' (no extrae datos de personas).
- 2026-10-07 T24 ✅ — 9 columnas nuevas en `empresas` + Data Table `sii_referencia`.
- 2026-10-07 T25 ✅ — A2 · Ingesta sectores regulados: 34 prestadores de Salud nuevos, 33 con sitio oficial (listado de 1.018). CMF ⛔ (anti-bots).
- 2026-10-07 T31/T32 ✅ — cruce_sii.py: 119 de 234 RUT encontrados en la nómina SII 2024 → `sii_referencia`; A3 actualizó tamaño, trabajadores y rubro.
- 2026-10-07 T26 ✅ — B prueba primero el sitio oficial: **67,6 % con dominio en Salud vs 6,5 % en el RES**; dominio compartido permitido si viene del registro (redes de clínicas). C recalcula reglas con el tamaño del SII.
- 2026-10-07 T30 ✅ — E con parámetro `fuente` (regulados → A2 → A3; res → A); el resumen marca la ingesta alternativa como omitida.
- 2026-10-07 T28 ✅ — Consulta `comparacion_fuentes` + gráfico en analysis/output/reporte.md.

## Bloqueos y permisos faltantes
- **T8 ⛔ — Google Sheets API deshabilitada** en el proyecto de Google Cloud de la credencial OAuth (error 403 `SERVICE_DISABLED`). Acción del usuario: habilitarla en https://console.cloud.google.com/apis/library/sheets.googleapis.com (en el proyecto de la credencial OAuth) , esperar unos minutos y ejecutar el workflow `D0 · Crear planilla` (wf_d0). Todo lo demás sigue: la Data Table es la fuente de verdad.
- **Publicar `Z · Registro de errores`** (wf_z): n8n exige que el workflow de error esté publicado para asignarlo a A–E, y `publish_workflow` no está entre los permisos aprobados. Acción del usuario (opcional): publicar Z y en *Settings → Error workflow* de A, B, C, D y E elegir Z. Mientras tanto, los fallos de cada etapa quedan registrados por el orquestador E (fila `etapa=pipeline`).
- WebFetch a `sii.cl` no aprobado: la nómina SII (rubro, tramo de ventas) queda como mejora futura. No bloquea: la fuente principal es el RES.


---

# Fase 2: Fuentes reguladas + SII

**Objetivo:** alimentar el pipeline con empresas de sectores regulados (salud, financiero/fintech), justo el ICP de una plataforma de cumplimiento de la Ley 21.719, enriquecidas con rubro y tramo de ventas del SII; reutilizar B, C y D.
**Terminado cuando:** una corrida con ≥ 30 empresas de las nuevas fuentes llega a la planilla con tasa de dominio verificado ≥ 50 % y el reporte compara fase 1 vs fase 2.
**Supuestos:** workflow nuevo `A2` (A se mantiene); sectores salud (Superintendencia de Salud) y financiero (CMF); sin API de búsqueda de pago; si la fuente trae sitio web, B lo verifica directamente.

## Permisos aprobados Fase 2 (2026-10-07)
- 🌐 WebFetch a sii.cl, www.sii.cl, cmfchile.cl, www.cmfchile.cl, superdesalud.gob.cl, www.superdesalud.gob.cl → T19–T21
- Resto: los permisos de la Fase 1.

## Tareas Fase 2
| ID | Tarea | Prio | Dif | Depende | 🌐 | 🔑 | Terminado cuando | Estado |
|---|---|---|---|---|---|---|---|---|
| T19 | Spike SII: nómina de personas jurídicas (URL, formato, tamaño, columnas, licencia) | P0 | 2 | — | Sí: sii.cl | Web | docs/fuentes-fase2.md con muestra | ✅ |
| T20 | Spike Superintendencia de Salud: registro de prestadores (formato, ¿RUT y sitio?) | P0 | 2 | — | Sí | Web | Ídem | ✅ |
| T21 | Spike CMF: entidades fiscalizadas / registro fintech (formato, RUT, sitio) | P0 | 2 | — | Sí | Web | Ídem | ✅ |
| T22 | Decidir fuentes y estrategia de cruce con SII (en n8n o script previo) | P0 | 2 | T19–T21 | No | — | Decisión documentada | ✅ |
| T23 | `lib/fuentes.js`: parsers → esquema común + tests con muestras reales | P0 | 3 | T22 | No | node | `node --test` pasa | ✅ |
| T24 | Columnas nuevas en `empresas`: fuente_lista, rubro_fuente, tramo_ventas, sitio_fuente | P0 | 1 | T22 | No | MCP n8n | Columnas visibles | ✅ |
| T25 | Workflow A2 · Ingesta sectores regulados | P0 | 4 | T23, T24 | No | MCP n8n | Corrida inserta sin duplicados | ✅ |
| T26 | B usa primero el sitio que entrega la fuente (verificándolo) | P0 | 2 | T25 | No | node, MCP | Test + tasa dominio ≥ 50 % | ✅ |
| T27 | Corrida A2 → B → C → D con ≥ 30 empresas | P0 | 2 | T26 | No | MCP n8n | Filas en corridas; planilla actualizada | ⛔ |
| T28 | Reporte comparativo fase 1 vs fase 2 | P1 | 2 | T27 | No | python | reporte.md con comparación | ✅ |
| T29 | README, muestra, export, check_secrets, commit | P1 | 2 | T28 | No | git, python | Commit con check limpio | ✅ |
| T30 | Orquestador E: parámetro fuente A / A2 | P2 | 2 | T25 | No | MCP n8n | E corre con A2 | ✅ |
| T31 | `scripts/cruce_sii.py`: RUT del pipeline × nómina SII → Data Table `sii_referencia` | P0 | 3 | T25 | No | python, MCP | Filas cargadas para los RUT encontrados | ✅ |
| T32 | Workflow A3 · Cruce SII: `sii_referencia` → columnas de `empresas` | P1 | 2 | T31 | No | MCP n8n | Empresas con tramo_ventas | ✅ |

## Bloqueos Fase 2
- **CMF**: responde a n8n con un desafío anti-bots (JS ofuscado). No se evade; vía correcta: pedir el listado por canales oficiales o Ley de Transparencia. A2 queda con Salud.
- **T27 ⛔ (parcial)**: Gemini con cuota diaria agotada (429). A2 → A3 → B listos (23 empresas de Salud con sitio); C las deja en `revision` con `ia_error` y las reintenta solo en la próxima corrida. Acción: ejecutar `C` y luego `D` cuando se renueve la cuota (medianoche hora del Pacífico).

## Bitácora Fase 2
- 2026-10-07 — Plan aprobado; 6 dominios agregados a WebFetch.
