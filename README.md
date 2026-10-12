# prospeccion-ley-21719

Pipeline de prospección en frío con n8n + IA. Demo que construye en **n8n** un pipeline que toma empresas chilenas de **fuentes públicas**, las normaliza y deduplica, busca su sitio web, detecta **señales de cumplimiento de la Ley 21.719** de protección de datos personales y las **califica con IA (Gemini) con revisión humana**, dejando el resultado en una Data Table y en Google Sheets, con métricas de cada corrida.

> **Datos públicos.** Todo el repositorio usa solo información pública de **personas jurídicas** (Registro de Empresas y Sociedades con licencia CC-BY, registro de prestadores de la Superintendencia de Salud y nómina de personas jurídicas del SII) y de sus sitios web. No contiene datos personales, credenciales ni datos completos de la corrida. Ver [Datos y privacidad](#datos-y-privacidad).

## El problema

La Ley 21.719 entra en vigencia el **1 de diciembre de 2026** (hay un proyecto de postergación en trámite, Boletín 18.623-07). Un equipo comercial que vende cumplimiento necesita encontrar empresas que **tratan muchos datos personales** y **no muestran señales de estar preparadas**, sin revisar sitios a mano.

## Arquitectura

```mermaid
flowchart LR
    RES[(Registro de Empresas<br/>y Sociedades<br/>datos.gob.cl)] --> A
    SS[(Superintendencia<br/>de Salud)] --> A2
    SII[(Nómina SII)] --> PY[cruce_sii.py] --> A3
    subgraph n8n
      A[A · Ingesta<br/>valida RUT, excluye<br/>personas naturales,<br/>deduplica] --> T1[(Data Table<br/>empresas)]
      A2[A2 · Ingesta<br/>sectores regulados] --> T1
      A3[A3 · Cruce SII<br/>tamaño y rubro] --> T1
      T1 --> B[B · Dominio y<br/>enriquecimiento<br/>robots.txt, verificación,<br/>señales]
      B --> T1
      T1 --> C[C · Calificación IA<br/>Gemini + rúbrica +<br/>controles de calidad]
      C --> T1
      T1 --> D[D · Google Sheets<br/>Calificadas /<br/>Revisión humana]
      E[E · Orquestador] -.-> A & B & C & D
      A & B & C & E -.métricas.-> T2[(Data Table<br/>corridas)]
      Z[Z · Registro de errores] -.-> T2
    end
    T1 -. exportar .-> AN[analysis/<br/>SQLite + SQL + Python]
```

| Workflow | Qué hace | Archivo |
|---|---|---|
| **A · Ingesta RES** | Descarga el CSV oficial, valida el RUT (módulo 11), excluye personas naturales, EIRL y holdings, filtra por región y capital y deduplica contra la tabla | [`workflows/A_ingesta.json`](workflows/A_ingesta.json) |
| **B · Dominio y enriquecimiento** | Genera dominios candidatos desde la razón social, respeta `robots.txt`, verifica que el sitio sea de la empresa y extrae señales de cumplimiento | [`workflows/B_enriquecimiento.json`](workflows/B_enriquecimiento.json) |
| **C · Calificación con IA** | Gemini clasifica rubro, propone un ajuste con evidencia y confirma el sitio; el código aplica la rúbrica y deriva lo dudoso a revisión humana | [`workflows/C_calificacion.json`](workflows/C_calificacion.json) |
| **D · Exportar a Sheets** | Reescribe la planilla desde la Data Table (fuente de verdad) | [`workflows/D_exportar_sheets.json`](workflows/D_exportar_sheets.json) |
| **E · Orquestador** | Ejecuta A→B→C→D con un mismo `run_id` y registra el estado de cada etapa | [`workflows/E_orquestador.json`](workflows/E_orquestador.json) |
| **Z · Registro de errores** | Workflow de error: guarda workflow, nodo y mensaje en `corridas` | [`workflows/Z_errores.json`](workflows/Z_errores.json) |

## Fase 2: fuentes de sectores regulados

La fase 1 partía del Registro de Empresas y Sociedades y solo 6,5 % de las empresas tenía sitio web. La fase 2 parte del **perfil de cliente ideal** usando registros oficiales de sectores que tratan datos sensibles. Detalle en [`docs/fuentes-fase2.md`](docs/fuentes-fase2.md).

| Workflow / script | Qué hace |
|---|---|
| **A2 · Ingesta sectores regulados** | Descarga el listado de **prestadores de salud acreditados** (Superintendencia de Salud, 1.018 prestadores) y toma de cada ficha el RUT, el propietario, el tipo de establecimiento y el **sitio web oficial**. No guarda teléfono, dirección ni datos del representante legal |
| `scripts/cruce_sii.py` | Recorre la **nómina de personas jurídicas del SII** (378 MB, fuera de n8n) y carga en la tabla `sii_referencia` solo los RUT del pipeline: tramo de ventas, trabajadores y rubro |
| **A3 · Cruce SII** | Pasa a `empresas` el tamaño, los trabajadores y el rubro del SII; C los usa en la rúbrica y en la ficha para la IA |
| **B** (ajustado) | Si la fuente oficial informó el sitio, prueba solo ese (y acepta que una red de clínicas comparta la web) |
| **E** (ajustado) | Parámetro `fuente`: `regulados` (A2 → A3) o `res` (A) |

**Resultado del cambio de fuente** (misma lógica de B, C y D):

| Fuente | Empresas | Con sitio verificado | Medianas o grandes según el SII | Calificadas (score ≥ 70) |
|---|---|---|---|---|
| Registro de Empresas y Sociedades (fase 1) | 200 | 13 (**6,5 %**) | 7 | 1 |
| Superintendencia de Salud (fase 2) | 34 | 23 (**67,6 %**) | 31 | **22** |

Con la fuente correcta, 10 veces más empresas llegan a la etapa de IA, casi todas tienen un tamaño que justifica un contacto comercial y 22 de 23 terminan calificadas (con motivo y URL de evidencia citados por la IA). La lección: en prospección, elegir bien la fuente rinde más que afinar el modelo.

**CMF (registro fintech):** el listado público funciona desde un navegador, pero a las solicitudes automatizadas de n8n la CMF responde con un desafío anti-bots. No se intentó evadirlo; la vía correcta es pedir el listado por sus canales oficiales o por Ley de Transparencia.

## Decisiones de diseño

- **Lógica testeable fuera de n8n.** La lógica de cada nodo Code vive en [`n8n/code/`](n8n/code) y [`lib/`](lib); [`scripts/build_code.py`](scripts/build_code.py) la inserta en el workflow. Así se prueba con `node --test` antes de subirla (59 tests). El arnés de tests anula `URL` porque el sandbox de n8n no la tiene: así se encontró un bug real.
- **Puntaje híbrido.** Las reglas deterministas (auditables) dan el puntaje base; la IA solo puede ajustarlo ±15 y debe citar evidencia. Ver [`docs/icp-rubrica.md`](docs/icp-rubrica.md).
- **Revisión humana por defecto ante la duda.** Va a revisión todo lo que tenga JSON inválido, evidencia que no sea una URL visitada, confianza < 0,6, error de la API o un sitio que la IA considera ajeno.
- **Verificación estricta del dominio.** Una primera versión aceptaba coincidencias de una sola palabra (`gonzalez.cl`, `minera.cl`): 43 falsos positivos en una simulación. La versión actual exige RUT, marca de una palabra en el título o la frase completa del nombre, y descarta dominios en venta o compartidos.
- **Señales solo de lo que ve un visitante, con evidencia.** La primera versión buscaba palabras como `login` o `woocommerce` en todo el HTML: landings simples aparecían como "e-commerce con login" porque tenían un plugin instalado sin usar. Al revisar los resultados, 4 de 8 señales eran falsas. Ahora login, tienda online y agenda son señales separadas que exigen texto visible y evidencia estructural (campo de contraseña, botón de carrito y precios), los sitios mínimos ("coming soon", menos de 150 palabras) no suman viabilidad ni pasan directo a ventas, y cada señal guarda el fragmento que la activó. La IA recibe esa evidencia y debe listar las señales que el texto no respalda.
- **Políticas de privacidad: dónde están y de quién son.** Las tiendas Shopify publican la política en `/policies/privacy-policy`, así que se busca la ruta conocida de cada plataforma. Una página solo cuenta como política si su título lo dice y su cuerpo usa términos propios de una (tratamiento, finalidad, derechos): antes bastaba la palabra "Privacidad" en el pie, y hasta un 404 contaba. Se distingue entre política **propia** y **plantilla** (la que genera Shopify o un generador externo): la plantilla es válida pero genérica y no traslada la responsabilidad, porque la tienda sigue siendo responsable de los datos de sus clientes aunque use Shopify. El año se toma de "última actualización", no del "© 2026" del pie.
- **Un bug que los tests locales no veían.** El nodo HTTP de n8n a veces entrega el cuerpo de la respuesta en `data` en vez de `body`. Mis nodos leían solo `body`, así que dentro de n8n la política de privacidad nunca se analizaba y **las reglas de `robots.txt` tampoco se aplicaban** (aunque en la práctica solo se visitaba la portada y una ruta de política por sitio). Lo detecté al ver que una tienda con política en local salía "sin política" en n8n; agregué a cada empresa un diagnóstico de la descarga (código HTTP, bytes, error), unifiqué la lectura en `cuerpoRespuesta()` y sumé un test con la respuesta en `data`.
- **Resistencia a prompt injection.** El texto del sitio se entrega como dato, con instrucción explícita de ignorar instrucciones contenidas en él (hay un test con un sitio que intenta manipular el puntaje).
- **Idempotencia.** Ejecutar la ingesta dos veces no duplica empresas (clave `rut:`); la planilla se regenera completa desde la Data Table.
- **Observabilidad.** Cada etapa escribe una fila en `corridas` (procesadas, nuevas, duplicadas, con/sin dominio, calificadas, errores y un diagnóstico de por qué se descartó cada candidato).

## Métricas

Resultados reales del 7 al 11 de octubre de 2026: 3 corridas de la fase 1 (archivo RES 2018) y 1 de la fase 2 (Superintendencia de Salud), más reintentos de calificación cuando la cuota gratuita de Gemini se agotó. Reporte completo y gráficos en [`analysis/output/reporte.md`](analysis/output/reporte.md).

**Embudo total**

| Etapa | Empresas |
|---|---|
| Ingresadas (únicas, sin duplicados en la tabla) | 234 |
| Con sitio web verificado | 36 |
| Evaluadas por la IA | 35 (las 35 con motivo y URL de evidencia) |
| **Calificadas** (score ≥ 70) | **23** |
| A revisión humana | 12 |

![Embudo](analysis/output/embudo.png)

**Por fuente**

| Métrica | Fase 1 · Registro de Empresas | Fase 2 · Superintendencia de Salud |
|---|---|---|
| Empresas ingresadas | 200 (de 101.998 filas; 30.245 excluidas por ser personas naturales, EIRL o capital atípico) | 34 (de 1.018 prestadores acreditados) |
| Con sitio verificado | 13 (6,5 %) | 23 (**67,6 %**) |
| Medianas o grandes según el SII | 7 | 31 |
| Calificadas | 1 | **22** |
| Sitios que la IA detectó como ajenos a la empresa | 5 | 1 |

Las 23 calificadas son 22 prestadores de salud (clínicas oftalmológicas, centros de diálisis, laboratorios, un centro oncológico) y una tienda online de insumos médicos; 20 son medianas o grandes según el SII y su score promedio es 92.

**Calidad y operación**

| Métrica | Valor |
|---|---|
| Motivos de revisión humana | 5 sitios ajenos según la IA · 3 sitios mínimos · 4 con score entre 40 y 69 |
| Respuestas de la IA con JSON válido | 100 % de las recibidas |
| Errores de la API (429 cuota / 503 saturación) | Quedaron en revisión y se recalificaron solos en corridas posteriores; 0 pendientes al cierre |
| Duplicados detectados y evitados en re-ejecuciones | 272 |
| Tiempo de ingesta | 6–15 s por corrida (RES, 102 mil filas) · 40 s (Salud, 40 fichas) |
| Tiempo de calificación | ~25–35 s por empresa (pausa para respetar el límite gratuito de la API) |

**Brechas de cumplimiento observadas** (36 sitios verificados): 31 sin política de privacidad, **ninguno cita la Ley 21.719**, 12 con formularios que piden datos personales y 15 con trackers publicitarios sin banner de cookies.

**Lectura:** el pipeline es conservador por diseño: prefiere mandar a revisión humana antes que entregar al equipo comercial una cuenta mal identificada. La mayor mejora no vino del modelo sino de la fuente: con el registro de prestadores de salud, 10 veces más empresas llegan a la IA y casi todas terminan calificadas.

## Cómo correrlo

Requisitos: n8n (probado en Docker), Node 20+, Python 3.11+, una API key de Google Gemini y (opcional) una credencial OAuth de Google Sheets con la **Google Sheets API habilitada**.

1. En n8n, crea las Data Tables `empresas` y `corridas` con las columnas de [`docs/tablas.md`](docs/tablas.md).
2. Importa los JSON de [`workflows/`](workflows). Reemplaza los marcadores `TABLA_EMPRESAS`, `TABLA_CORRIDAS` y `WORKFLOW_*` por los IDs de tu instancia y asigna tus credenciales (`<tu credencial ...>`).
3. Ejecuta `D0 · Crear planilla` una vez y reemplaza `ID_PLANILLA` en el workflow `D` por el ID de la planilla creada.
4. Ejecuta `E · Orquestador del pipeline`.

Desarrollo local:

```bash
node --test
python scripts/build_code.py n8n/sdk/B_enriquecimiento.sdk.ts --out data/raw/build/B.ts
node scripts/simular_b.js data/raw/empresas.json 50     # simula el workflow B contra sitios reales
python scripts/exportar_tablas.py && python analysis/metricas.py
python scripts/check_secrets.py .                       # antes de cada commit
```

## Datos y privacidad

Este repositorio es público, así que se diseñó para no exponer nada que no lo sea:

- **Fuente:** [Registro de Empresas y Sociedades](https://datos.gob.cl/dataset/363edd60-4919-4ff1-b85f-f8e14d61285a) (Subsecretaría de Economía y Empresas de Menor Tamaño), publicado en datos.gob.cl con licencia **Creative Commons Attribution (CC-BY)**. Se usan razón social, RUT de la sociedad, región, año y capital.
- **Fase 2:** [registro de prestadores acreditados](https://www.superdesalud.gob.cl/) de la Superintendencia de Salud (de cada ficha solo RUT, razón social, tipo de establecimiento y sitio oficial; se corta antes de los datos del representante legal) y [nómina de personas jurídicas del SII](https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html) (tramo de ventas, trabajadores y rubro, solo para los RUT del pipeline).
- **Solo personas jurídicas.** Se descartan RUT bajo 50.000.000 (personas naturales) y las **EIRL**, porque su razón social suele ser el nombre de una persona (30.244 excluidas en el archivo 2018).
- **Sin datos personales de terceros.** No se buscan ni guardan nombres, correos o teléfonos de personas. Del sitio solo se registran **señales** (¿tiene política de privacidad?, ¿usa cookies?) y se anota *si existe* un canal de privacidad, no cuál es.
- **Rastreo respetuoso.** Se consulta `robots.txt` antes de visitar cada sitio, con un User-Agent que se identifica, timeouts y pausas entre solicitudes. Solo se visitan la portada y la política de privacidad.
- **Nadie fue contactado.** El pipeline no envía correos ni formularios.
- **Lo que está en el repo:** código, workflows sin credenciales, métricas agregadas y una **muestra de hasta 20 empresas** ([`data/sample/`](data/sample)) con campos estructurados de dominio público. Se excluyen de la muestra las empresas cuyo sitio la IA marcó como ajeno, para no asociar una empresa a un sitio que no es suyo.
- **Lo que NO está:** los datos completos, el texto extraído de los sitios y las credenciales viven solo en la instancia local de n8n (`data/raw/` está en `.gitignore`). [`scripts/check_secrets.py`](scripts/check_secrets.py) revisa JWT, API keys, tokens, correos y RUT de personas naturales antes de cada commit.

## Limitaciones y próximos pasos

- **Pocas empresas del RES tienen sitio web** (6,5 %): el registro está dominado por sociedades nuevas y holdings. Se resolvió en la fase 2 partiendo de registros de sectores regulados; falta sumar otros sectores (fintech vía CMF, educación).
- **Cuota gratuita de Gemini.** Con el plan gratuito se califican pocas empresas por día; los errores 429/503 quedan en revisión y se reintentan solos en la siguiente corrida, pero una corrida grande necesita una API con facturación o un modelo con más cuota.
- La verificación por nombre es conservadora: prefiere perder empresas a asociar sitios equivocados.
- La rúbrica asigna puntajes parecidos a sitios sin política de privacidad; con más datos etiquetados (ver [`analysis/eval_agreement.py`](analysis/eval_agreement.py)) se pueden recalibrar los pesos.
- Integración con un CRM (HubSpot) y secuencias de contacto quedan fuera de este alcance.

## Estructura

```
docs/        fuente de datos, ICP y rúbrica, tablas
lib/         normalización de empresas y extracción de señales (JS, sin dependencias)
n8n/code/    código de cada nodo Code      n8n/sdk/   workflows en el SDK de n8n
workflows/   workflows exportados (JSON, sin credenciales)
scripts/     build, simulación local, exportación y revisión de secretos
analysis/    SQL + Python de métricas y evaluación de la IA
test/        tests (node --test)
data/sample/ muestra pública
```

## Licencia

© 2026 Andrés Riveros. **Todos los derechos reservados.** El código se publica solo para que pueda ser revisado como muestra de trabajo; no se concede permiso para usarlo, copiarlo, modificarlo ni distribuirlo, total o parcialmente, sin autorización escrita del autor. Ver [`LICENSE`](LICENSE).
