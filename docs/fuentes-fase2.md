# Fase 2: fuentes de sectores regulados + SII

En la fase 1, el Registro de Empresas y Sociedades (RES) entregó solo 6,5 % de empresas con sitio web: son sobre todo sociedades nuevas y holdings. En la fase 2 se parte del **perfil de cliente ideal** (salud y servicios financieros, que tratan datos sensibles y financieros) usando registros oficiales, y se enriquece con la nómina del SII.

## Fuentes evaluadas (2026-10-07)

| Fuente | Qué trae | Formato y acceso | robots.txt | Decisión |
|---|---|---|---|---|
| **Superintendencia de Salud**: Registro de Prestadores Institucionales Acreditados | Por prestador: nombre, **RUT**, propietario, dirección, tipo de establecimiento, **sitio web**, teléfono, acreditaciones | HTML: listado nacional con enlaces (`/tax-registros/registro-de-prestadores-acreditados-4329/nacional-4258/`) y una ficha por prestador (`/registro/<slug>/`) | Permite `/registro/` y `/tax-registros/` | ✅ Fuente principal (salud) |
| **CMF**: Registro de Prestadores de Servicios Financieros (Ley Fintec 21.521) | Por entidad: **RUT** (sin DV), nombre, servicios autorizados, estado | JSON público que usa la propia página (`seg_rgpsf_ajax.php?f=servFiltrosPLSQL&tipo=J&estado=VI`): 194 personas jurídicas vigentes | Sin robots.txt (responde 403 "página no encontrada"); según RFC 9309, un 4xx permite el acceso. Se hace **una** consulta | ✅ Fuente principal (fintech). No trae sitio web |
| **SII**: Nómina de personas jurídicas | RUT, DV, razón social, **tramo según ventas**, **n.º de trabajadores**, fechas, **rubro / subrubro / actividad**, región, comuna | ZIP de TXT separados por tabulador (latin-1). `PUB_EMPRESAS_PJ_2020_A_2024.zip`: 188 MB comprimido, ~378 MB el año 2024 | — | ✅ Enriquecimiento por RUT, **fuera de n8n** (demasiado grande para un nodo Code) |
| Mineduc y gremios | — | No evaluadas en esta fase | — | Próxima fase |

## Cómo se combinan

```
A2 · Ingesta sectores regulados (n8n)
   ├─ CMF: 1 consulta JSON → RUT + nombre + servicios
   └─ Salud: listado nacional → fichas (con pausa entre solicitudes) → RUT + nombre + sitio web
        ↓ normaliza (lib/fuentes.js), excluye personas naturales, deduplica por RUT
   empresas (estado `nueva`, `fuente_lista`, `rubro_fuente`, `sitio_fuente`, `ref_fuente`)

scripts/cruce_sii.py (local)
   lee los RUT de `empresas` → recorre el TXT del SII una vez → carga solo esos RUT en la Data Table `sii_referencia`

A3 · Cruce SII (n8n)
   `sii_referencia` → actualiza `tramo_ventas`, `trabajadores`, `rubro_sii` en `empresas`

B · Enriquecimiento: si hay `sitio_fuente`, lo prueba primero (y lo verifica igual); si no, candidatos por nombre
C · Calificación y D · Sheets: sin cambios
```

## Tramo según ventas del SII

| Código | Tamaño |
|---|---|
| 1 | Sin ventas o sin información |
| 2–4 | Micro |
| 5–7 | Pequeña |
| 8–9 | Mediana |
| 10–13 | Grande |

## Privacidad

- Solo **personas jurídicas**: la CMF se consulta con `tipo=J`, y en Salud se descartan los RUT menores a 50.000.000 y las "sociedades de hecho" del SII cuyo nombre es el de personas.
- De las fichas de Salud **no se guardan** teléfono, dirección exacta ni nombres de personas: solo RUT, nombre del prestador, tipo de establecimiento y sitio web.
- El archivo del SII queda en `data/raw/` (ignorado por git). En n8n solo se cargan los RUT que ya están en el pipeline.
