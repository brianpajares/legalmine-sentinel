# Monetización

Cómo este producto genera ingresos, en qué orden, y por qué esa secuencia.

---

## La idea central

**El tamizaje se compra una vez. El monitoreo se paga todos los meses.**

Un informe de riesgo responde *qué es cierto hoy*. Es valioso, pero es una
compra puntual: el cliente lo necesita cuando evalúa un activo, y después no
vuelve hasta el siguiente. Vender solo eso te condena a buscar clientes nuevos
cada mes.

La base mensual cambia la ecuación. Al comparar el snapshot de este mes contra
el del anterior, el producto responde *qué se movió desde la última vez* — una
pregunta que el mismo cliente tiene que hacerse **todos los meses, para siempre,
sobre las mismas áreas**.

Ese es el producto recurrente. Todo lo demás es la puerta de entrada.

```
Tamizaje gratuito  →  Dossier pagado  →  Monitoreo mensual  →  Portafolio/API
   (adquisición)      (primer ingreso)     (ingreso recurrente)   (expansión)
```

---

## Estructura de precios

### Lo que ya está implementado

| Plan | Precio | Para quién |
|---|---|---|
| **Pilot** | Gratis | Prueba sobre un activo real, a cambio de feedback estructurado |
| **Professional** | $299 / usuario / mes | Consultor o analista que tamiza activos continuamente |
| **Team** | $1,200 / mes (10 asientos) | Equipos de tierras, legal y sostenibilidad sobre un portafolio |
| **Enterprise** | Desde $18,000 / año | Multi-jurisdicción, API, SSO |

El código ya declara estos precios como **introductorios y sujetos a revisión
según el feedback de los pilotos** (`PRICING_NOTE`), no como una lista validada
de mercado. Mantén esa honestidad hasta tener datos: un precio inventado
presentado como validado es la primera cosa que un inversionista serio detecta.

### El cambio que recomiendo hacer

**Cobrar el monitoreo por área vigilada, no por asiento.**

El valor no escala con cuánta gente mira la pantalla; escala con **cuántas
hectáreas tienes en riesgo**. Un fondo con 40 concesiones bajo observación
obtiene 40 veces más valor que uno con una, y hoy pagaría lo mismo.

Estructura sugerida:

| Componente | Precio sugerido | Lógica |
|---|---|---|
| Plataforma (acceso, tamizajes ilimitados) | $299 / mes | Cubre el uso y la adquisición |
| Monitoreo mensual por área | $49 / área / mes | Escala con el valor real |
| Dossier certificado (PDF sellado) | $199 / unidad | Compra puntual de alto margen |
| Histórico y reproducibilidad (retención >24 meses) | +20% | Diferencial defendible |

Un cliente con 20 áreas: $299 + $980 = **$1,279/mes**. Hoy pagaría $299.

> No cambies los precios en el código hasta cerrar los primeros pilotos. La
> estructura importa más que el número, y el número solo se valida vendiendo.

---

## Camino al primer ingreso (90 días)

### Días 1–30: pilotos que producen evidencia, no aplausos

**Meta: 5 pilotos, cada uno sobre un activo real que el cliente ya está
evaluando.** No demos sobre polígonos inventados.

Qué medir en cada piloto — la app ya lo captura en `/api/feedback`:

- Cuánto tardaban antes (`manualBaselineMinutes`) vs. con esto
  (`legalmineMinutes`)
- Utilidad y confianza, 1–5
- **Disposición a pagar** (`wtpHypothesis`)
- Si lo volverían a usar
- Permiso para citar

Esas cinco respuestas son tu caso de negocio. `/api/metrics` las agrega:
mediana de tiempo ahorrado, % que volvería a usarlo, confianza promedio.

**El error a evitar:** un piloto que termina en "qué interesante" no es un
piloto, es una demo. Cierra cada uno con la pregunta directa: *¿qué tendría que
ser cierto para que pagaras por esto el mes que viene?*

### Días 31–60: convertir 2 de los 5

Ofrece a los pilotos con mejor señal:

> Tres meses de monitoreo sobre tus áreas, a mitad de precio, a cambio de un
> caso de estudio citable.

Esto te da: ingreso real (aunque descontado), retención medible, y la prueba
social que necesitas para vender al siguiente sin descuento.

### Días 61–90: cerrar el ciclo del producto recurrente

Al tercer mes existen **dos snapshots consecutivos**, es decir el primer reporte
de cambios real. Ese es el momento en que el cliente ve por primera vez por qué
paga todos los meses.

Prepara ese momento: cuando llegue el primer reporte con un cambio relevante
—una concesión nueva superponiéndose, un cambio de estado— eso es tu mejor
material de venta, y es real.

---

## Por qué esto se puede vender a nivel mundial

**La arquitectura no está atada a Perú.** Los adaptadores de fuentes viven
detrás de una interfaz común y las reglas están versionadas por jurisdicción.
Añadir un país es configurar capas y calibrar pesos, no reescribir el producto.

Orden de expansión sugerido, por facilidad de datos y tamaño de mercado:

1. **Chile** — catastro minero digitalizado y accesible, mercado grande
2. **Colombia** — ANM con servicios geográficos públicos
3. **México** — volumen alto, datos más fragmentados
4. **Brasil** — ANM, mercado enorme, mayor esfuerzo de adaptación

El argumento para un comprador internacional no es "cubrimos Perú". Es: *el
mismo motor de trazabilidad, aplicado a la jurisdicción donde tú inviertes.*

---

## Qué hace defendible el precio

Tres cosas que un competidor no puede copiar rápido:

1. **Reproducibilidad fechada.** Un dossier re-derivable meses después, con
   checksum del snapshot. Un consultor que entrega un PDF no puede ofrecer eso.

2. **Trazabilidad total.** Cada número apunta a una fuente, una fecha y un
   enlace verificable. Cuando el dato falta, se dice — no se rellena.

3. **El histórico acumulado.** Cada mes que pasa, la base de snapshots vale más
   y es más difícil de replicar. Un competidor que arranque hoy tarda dos años
   en tener dos años de historia.

El tercero es el foso real. Empieza a cosechar cuanto antes, aunque todavía no
tengas clientes: **el corpus se aprecia con el tiempo y no se puede comprar.**

---

## Errores que hundirían esto

| Error | Por qué mata el producto |
|---|---|
| Rellenar un dato faltante con una estimación | Un comprador verifica un dato, lo encuentra inventado y descarta todo lo demás |
| Presentar `NOT_ASSESSED` como riesgo bajo | Alguien invierte creyendo que está limpio. Fin del negocio |
| Vender como "asesoría legal" | Responsabilidad profesional que no puedes cubrir. El disclaimer existe por algo |
| Scrapear REINFO de forma frágil | Se rompe en silencio y el informe miente sin que nadie lo note |
| Publicar precios "validados" sin haber vendido | El primer inversionista serio lo detecta y pierdes credibilidad |

---

## Métricas que importan

Las que ya se capturan (`/api/metrics`):

| Métrica | Qué te dice |
|---|---|
| Mediana de tiempo ahorrado | El argumento de ROI, en minutos concretos |
| % que volvería a usarlo | Señal de retención antes de tener retención |
| Confianza promedio de evaluaciones | Salud de los conectores |
| Dossiers generados / evaluaciones | Si el producto llega hasta el entregable |

La que hay que añadir cuando existan suscripciones: **% de reportes mensuales
con al menos un cambio relevante.** Si es muy bajo, el monitoreo no justifica su
precio y hay que ampliar qué se vigila.
