# Fuente de datos

## Decisión

| | Fuente | Estado |
|---|---|---|
| **Principal** | Registro de Empresas y Sociedades (RES) — Subsecretaría de Economía y Empresas de Menor Tamaño, publicado en [datos.gob.cl](https://datos.gob.cl/dataset/363edd60-4919-4ff1-b85f-f8e14d61285a) | ✅ Verificada |
| Respaldo / enriquecimiento futuro | Nómina de Personas Jurídicas y Empresas del SII ([sii.cl](https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html)): trae rubro, tramo de ventas y n° de trabajadores | ⏸️ No evaluada en detalle (dominio fuera de los permisos aprobados) |
| Descartadas por ahora | Directorios gremiales (FinteChile, ACTI, Chiletec): listas de socios no encontradas como dato abierto; API de Mercado Público: requiere ticket con Clave Única y su portal está siendo reemplazado (licitación ago-2026) | — |

## Por qué el RES

- **Oficial y abierto:** licencia **Creative Commons Attribution (CC-BY)** → se puede usar y redistribuir citando la fuente. El README debe incluir la atribución.
- **Solo personas jurídicas:** son sociedades (SpA, SRL, S.A., EIRL…) constituidas bajo la Ley 20.659. Sus RUT están en el rango de empresas (≥ 50.000.000).
- **Actualizado:** un CSV por año de constitución, de 2013 a 2026 (corte 31-08-2026). Última modificación del dataset: 2026-09-28.
- **Tamaño manejable:** ~14–17 MB por año; n8n lo descarga y filtra en memoria sin montar volúmenes.

## Formato

CSV separado por `;`, UTF-8 con BOM. Columnas:

```
ID;RUT;Razon Social;Fecha de actuacion (1era firma);Fecha de registro (ultima firma);
Fecha de aprobacion x SII;Anio;Mes;Comuna Tributaria;Region Tributaria;Codigo de sociedad;
Tipo de actuacion;Capital;Comuna Social;Region Social
```

`Tipo de actuacion` incluye CONSTITUCIÓN, MODIFICACIÓN, DISOLUCIÓN, etc. → filtrar solo `CONSTITUCIÓN` y excluir RUT que luego aparezcan con `DISOLUCIÓN`.

## Limitaciones (y cómo se abordan)

| Limitación | Mitigación en el pipeline |
|---|---|
| **No trae sitio web** | Descubrimiento de dominio (T15): candidatos `<nombre>.cl` / `.com` a partir de la razón social, verificados visitando el sitio y comprobando que el nombre aparezca en el título o el texto |
| **No trae rubro** | El rubro lo infiere la IA a partir del contenido del sitio (T7) |
| **No trae tamaño** | Proxy: capital declarado + antigüedad. Mejora futura: cruzar con la nómina SII (tramo de ventas) |
| Muchas son micro-empresas recién creadas | Filtrar años 2016–2020 (empresas con ≥ 5 años que siguen activas tienen más probabilidad de tener sitio) y capital ≥ $50.000.000 CLP |
| Razones sociales con apellidos ("Sociedad Pérez y Cía") | Son personas jurídicas (dato público), pero no se usan nombres de socios ni se buscan personas |

## Filtros iniciales (configurables en el workflow A)

- Años: 2016–2020
- `Tipo de actuacion = CONSTITUCIÓN`
- Capital ≥ 50.000.000 CLP
- Regiones: 13 (RM), 5 (Valparaíso), 8 (Biobío)
- Muestra por corrida: 50 empresas

## Muestra (5 registros reales, archivo 2026)

| RUT | Razón social | Comuna | Región | Tipo | Capital (CLP) |
|---|---|---|---|---|---|
| 78325619-3 | Branding data spa | San Miguel | 13 | SpA | 1.000.000 |
| 78325512-K | ECS Group SpA | Lo Barnechea | 13 | SpA | 5.000.000 |
| 78325623-1 | Club Exponencial SpA | Lo Barnechea | 13 | SpA | 10.000.000 |
| 78325595-2 | ActivOzono SpA | La Florida | 13 | SpA | 5.300.000 |
| 78325516-2 | Transportes Finetrans Internacional SpA | La Florida | 13 | SpA | 50.000.000 |

## Fuentes consultadas

- [Dataset RES en datos.gob.cl (API CKAN)](https://datos.gob.cl/api/3/action/package_show?id=363edd60-4919-4ff1-b85f-f8e14d61285a)
- [SII — Personas Jurídicas y Empresas](https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html)
- [ChileCompra — API Mercado Público](https://www.chilecompra.cl/api/) y [licitación del nuevo portal API (ago-2026)](https://www.chilecompra.cl/2026/08/participa-de-la-licitacion-para-el-servicio-de-diseno-y-desarrollo-del-nuevo-portal-api-de-mercado-publico/)
