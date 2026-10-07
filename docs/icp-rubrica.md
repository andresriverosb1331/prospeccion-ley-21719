# Perfil de cliente ideal (ICP) y rúbrica de calificación

## Contexto regulatorio

- La **Ley 21.719** reemplaza el régimen de la Ley 19.628: nuevas bases de licitud, derechos ARCO + portabilidad, notificación obligatoria de brechas, Modelo de Prevención de Infracciones (reglamentado por el DS 662/2025) y una Agencia de Protección de Datos Personales.
- **Sanciones:** desde amonestación hasta multas de 20.000 UTM en infracciones gravísimas, con escalones para leves y graves.
- **Vigencia:** fijada para el **1 de diciembre de 2026**. En septiembre de 2026 el Gobierno ingresó un proyecto (Boletín 18.623-07) para postergarla un año; mientras no se apruebe y publique, la fecha vigente sigue siendo el 01-12-2026. *(Estado al 2026-10-07.)*

Para un equipo comercial esto es una señal de urgencia: las empresas que tratan muchos datos personales y no muestran señales de preparación son las que más necesitan una plataforma de cumplimiento, ocurra o no la postergación.

## ICP

Empresa chilena (persona jurídica) que:
1. **Trata datos personales a escala**: rubros salud, fintech/seguros, educación, retail/e-commerce, SaaS/tecnología, RRHH/reclutamiento, inmobiliario, marketing.
2. **Recoge datos por canales digitales**: formularios, registro/login, carrito de compra, cookies de seguimiento.
3. **Muestra brechas de cumplimiento visibles**: sin política de privacidad, política desactualizada o que no menciona la nueva ley, sin canal de privacidad.
4. **Tiene capacidad de compra**: sitio activo, cierta antigüedad y capital.

Fuera del ICP: sitios caídos o en construcción, holdings sin operación visible, empresas sin canal digital que trate datos de personas.

## Señales que extrae el enriquecimiento (workflow B)

| Señal | Cómo se detecta |
|---|---|
| `sitio_activo` | HTTP 200 en la home |
| `politica_privacidad` | Página cuyo título/H1 habla de privacidad **y** cuyo cuerpo usa ≥ 3 términos de una política (tratamiento, finalidad, derechos…). Se busca el enlace en la portada o la ruta conocida de la plataforma (Shopify: `/policies/privacy-policy`) |
| `menciona_ley_nueva` | La política menciona "21.719" |
| `menciona_ley_antigua` | La política menciona "19.628" (y no la 21.719) |
| `politica_anio` | Año que acompaña a "última actualización / vigencia" (nunca el "© 2026" del pie) |
| `politica_origen` | `propia`, `plantilla_shopify` o `plantilla_generador` (Termly, iubenda…): una plantilla es válida pero genérica, y la tienda sigue siendo responsable aunque use Shopify |
| `banner_cookies` | Texto o script de consentimiento de cookies |
| `trackers` | Scripts de analítica/publicidad (gtag, GTM, Meta Pixel, Hotjar…) |
| `formularios_datos` | `<form>` con campos email, teléfono, RUT o nombre |
| `login` | Texto **visible** "iniciar sesión" / "mi cuenta" **y** un campo de contraseña o enlace de acceso |
| `tienda_online` | Botón visible de carrito/compra **y** al menos 2 precios, en un sitio que no sea "próximamente" |
| `agenda_online` | "agenda tu hora", "reserva online" visibles |
| `sitio_minimo` | Menos de 150 palabras visibles o "próximamente / en construcción / coming soon" |
| `plataforma_tienda` | Informativo (woocommerce, shopify, vtex en el código): **no suma puntos**, un plugin instalado no prueba una tienda |

Cada señal de interacción guarda en `evidencias` el fragmento de texto que la activó, para auditarla.
| `contacto_privacidad` | Correo genérico tipo `privacidad@`/`datos@`/`dpo@` o mención a un encargado o delegado de datos (solo se registra que existe, no el correo) |

## Rúbrica (0–100)

Puntaje híbrido: **reglas deterministas** (código en n8n, auditable) + **ajuste de la IA** (máx. ±15 puntos, con justificación y evidencia).

### A. Exposición a datos personales (0–40)
| Criterio | Puntos |
|---|---|
| Rubro alto (salud, fintech/seguros, educación, RRHH) | 20 |
| Rubro medio (retail/e-commerce, SaaS, inmobiliario, marketing) | 14 |
| Otro rubro | 5 |
| `formularios_datos` | +6 |
| `login` · `tienda_online` · `agenda_online` | +6 c/u |
| `trackers` | +4 |

### B. Brecha de cumplimiento (0–40)
| Criterio | Puntos |
|---|---|
| Sin política de privacidad | 20 |
| Política existe pero no menciona 21.719 o es anterior a 2025 | 12 |
| … y además es plantilla de plataforma o generador | +4 |
| Política menciona 21.719 | 0 |
| Sin `contacto_privacidad` | +10 |
| `trackers` sin `banner_cookies` | +10 |

### C. Viabilidad comercial (0–20)
| Criterio | Puntos |
|---|---|
| `sitio_activo` y no `sitio_minimo` | 5 |
| Capital ≥ $200.000.000 / ≥ $50.000.000 | 10 / 5 |
| Antigüedad ≥ 5 años | 5 |

Los puntajes de cada bloque se topan en su máximo.

### Umbrales y rutas
| Score final | Estado | Acción |
|---|---|---|
| ≥ 70 | `calificada` | Pestaña "Calificadas" para el equipo comercial |
| 40–69 | `revision` | Pestaña "Revisión humana" |
| < 40 | `descartada` | Queda en la Data Table con su motivo |
| Confianza de la IA < 0,6 | `revision` | Siempre pasa por una persona, sin importar el score |

## Salida que debe producir la IA (JSON)

```json
{
  "rubro": "salud | fintech_seguros | educacion | rrhh | retail_ecommerce | saas_tecnologia | inmobiliario | marketing | otro",
  "ajuste": -15,
  "score": 0,
  "segmento": "alto_riesgo | medio | bajo",
  "motivo": "1-2 frases citando señales concretas",
  "evidencia_url": "URL de la página que respalda el motivo",
  "confianza": 0.0
}
```

Controles de calidad:
- Si `motivo` no cita al menos una señal o falta `evidencia_url` → `revision`.
- El JSON se valida contra el esquema; si es inválido se reintenta una vez y si vuelve a fallar → `revision` + registro de error.
- Una muestra de 20 empresas se etiqueta a mano para medir cuánto coincide la IA con la persona (T11).

## Fuentes

- [Diario Oficial — decreto con vigencia 01-12-2026](https://www.diariooficial.interior.gob.cl/publicaciones/2025/06/17/44176/01/2660255.pdf)
- [Carey — proyecto de postergación](https://www.carey.cl/gobierno-ingresa-proyecto-de-ley-que-posterga-en-un-ano-entrada-en-vigor-de-la-ley-sobre-proteccion-de-datos-personales)
- [Diario Constitucional — "Postergar la ley no es postergar la preparación"](https://www.diarioconstitucional.cl/cartas-al-director/datos-personales-postergar-la-ley-no-es-postergar-la-preparacion/)
- [Prey — Modelo de Prevención de Infracciones](https://preyproject.com/es/blog/modelo-de-prevencion-de-infracciones-ley-21719)
- [Academia Judicial — Ley 21.719](https://academiajudicial.cl/recursos/actualizaciones-normativas/ley-21-719-que-regula-la-proteccion-y-el-tratamiento-de-los-datos-personales-y-crea-la-agencia-de-proteccion-de-datos-personales/)
