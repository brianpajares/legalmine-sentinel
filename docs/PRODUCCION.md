# Puesta en producción

Guía operativa para dejar LegalMine Sentinel funcionando con datos reales.

El orden importa: cada fase deja la aplicación en un estado usable, y ninguna
depende de que la siguiente esté lista.

---

## Fase 0 — Lo que ya funciona sin configurar nada

Un despliegue sin variables de entorno **arranca y es honesto**: cada fuente
reporta `NOT_CONFIGURED`, la evaluación sale como `PARTIAL`, y el dossier dice
qué conclusiones no están disponibles y por qué.

Eso es correcto, pero no es una demo que gane un concurso. Las fases siguientes
lo convierten en producto.

---

## Fase 1 — Almacenamiento durable (15 min)

Sin esto, todo vive en memoria del proceso y se pierde en cada reinicio. La
aplicación lo dice en `/api/health/sources` y en las advertencias del corpus, en
lugar de aparentar durabilidad que no tiene.

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito
   alcanza para el piloto).
2. Aplica las dos migraciones, en orden, desde el SQL Editor:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_corpus.sql`
3. En Vercel → Settings → Environment Variables:

   | Variable | Dónde sale |
   |---|---|
   | `SUPABASE_URL` | Project Settings → API → Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` |

> La `service_role` key salta RLS. Va **solo** en variables de servidor de
> Vercel, nunca en un `NEXT_PUBLIC_*` ni en el cliente.

Verifica: `GET /api/corpus` debe responder `"durable": true`.

---

## Fase 2 — Conectar las fuentes oficiales (30–60 min)

Este es el único paso que no se puede automatizar desde fuera: hay que
**confirmar el índice de capa** de cada servicio, porque las instituciones los
reorganizan sin aviso y una capa equivocada devolvería datos que no son los que
el dossier afirma.

### Cómo encontrar la capa correcta

1. Abre el directorio REST del servicio en el navegador:
   - INGEMMET: `https://geocatmin.ingemmet.gob.pe/arcgis/rest/services`
   - SERNANP: `https://geo.sernanp.gob.pe/arcgis/rest/services`
2. Navega hasta el `MapServer` del catastro minero / de las ANP.
3. Identifica la capa por su nombre y sus campos. La URL termina en el índice:
   `.../MapServer/0`
4. Confirma con el probador incluido:

   ```bash
   INGEMMET_LAYER_URL="https://.../MapServer/0" npm run sources:probe
   ```

   Responde con el nombre real de la capa si es alcanzable, o con el error
   exacto si no.

### Variables

| Variable | Obligatoria | Para qué |
|---|---|---|
| `INGEMMET_LAYER_URL` | **Sí (P0)** | Catastro minero |
| `SERNANP_LAYER_URL` | **Sí (P0)** | Áreas naturales protegidas |
| `ANA_LAYER_URL` | No | Recursos hídricos |
| `BDPI_LAYER_URL` | No | Contexto de pueblos indígenas |
| `COPERNICUS_ENABLED` | No | Escenas Sentinel-2 (`true` para activarlo) |
| `REINFO_API_URL` | No | Solo si confirmas una interfaz oficial estable |
| `SOURCE_TIMEOUT_MS` | No | Timeout por fuente (12000 por defecto) |

Si los nombres de campo de una capa no coinciden con los valores por defecto
(`CODIGOU`, `CONCESION`, `ESTADO`, `TITULAR`, `SUSTANCIA`, `HECTA` para
INGEMMET), se remapean sin tocar código con `INGEMMET_FIELD_CODE`,
`INGEMMET_FIELD_NAME`, etc. Lo mismo para `SERNANP_FIELD_*`.

> **Sobre REINFO:** no configures `REINFO_API_URL` con un scraper. El adaptador
> reporta `MANUAL_VERIFICATION_REQUIRED` a propósito mientras no exista una
> interfaz oficial estable. Es más defendible ante un comprador que un dato
> extraído de forma frágil que puede romperse en silencio.

Verifica: `GET /api/health/sources` debe mostrar las capas alcanzables.

---

## Fase 3 — Construir la base mensual (1–3 h la primera vez)

La primera cosecha lee la capa completa. Es la única que tarda; las siguientes
solo procesan el mes nuevo.

1. Genera un secreto y ponlo en Vercel como `CRON_SECRET`:

   ```bash
   openssl rand -hex 32
   ```

   Sin esta variable el endpoint **se niega a ejecutarse**. Un endpoint de
   cosecha abierto es un problema de costo y de integridad de datos a la vez.

2. Dispara la primera cosecha:

   ```bash
   curl -X POST "https://<tu-dominio>/api/cron/corpus" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

3. La respuesta trae `complete: false` mientras queden páginas. **Vuelve a
   llamar al mismo endpoint** hasta que responda `complete: true`: la cosecha
   retoma desde su cursor, no reinicia.

4. Confirma: `GET /api/corpus` → `"corpusReady": true`.

A partir de ahí, `vercel.json` ya programa el refresco: día 1 de cada mes a las
06:00 UTC, más los días 2 al 5 para que una cosecha que se haya cortado termine
sola.

### Cuánto tarda y por qué es resumible

Un catastro nacional no cabe en una invocación serverless. Cada corrida trabaja
contra un presupuesto de tiempo (`CORPUS_BUDGET_MS`, 45 s por defecto), guarda
hasta dónde llegó y la siguiente continúa. Un snapshot solo pasa a `ACTIVE`
cuando la capa se leyó hasta el final: un mes leído a medias reportaría menos
superposiciones de las reales, que es exactamente el error que este producto no
puede cometer.

Ajustables si hace falta: `CORPUS_PAGE_SIZE` (1000), `CORPUS_BUDGET_MS` (45000),
`CORPUS_WRITE_CHUNK` (500).

---

## Fase 4 — Cobro (20 min)

| Variable | Para qué |
|---|---|
| `STRIPE_SECRET_KEY` | Habilita el checkout |
| `STRIPE_PRICE_PROFESSIONAL` | Price ID del plan Professional |
| `STRIPE_PRICE_TEAM` | Price ID del plan Team |

Sin `STRIPE_SECRET_KEY` la página de precios sigue funcionando y todos los
planes enrutan a una conversación. Con la clave puesta, solo los planes que
tengan su price ID configurado muestran botón de pago; el resto sigue enrutando
a contacto. Nada aparenta un cobro que no está conectado.

---

## Fase 5 — Verificación final

```bash
# ¿Almacenamiento durable?
curl -s https://<dominio>/api/corpus | jq '.durable, .corpusReady'

# ¿Fuentes vivas?
curl -s https://<dominio>/api/health/sources | jq '.sources[] | {sourceKey, status}'

# Evaluación de punta a punta
curl -s -X POST https://<dominio>/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"Prueba","country":"PE","geometry":{...}}'
```

El dossier debe mostrar, en el bloque **Reproducibility basis**, el período y el
checksum de cada snapshot usado.

---

## Modos de operación

| `CORPUS_MODE` | Comportamiento |
|---|---|
| sin definir (por defecto) | Corpus si hay snapshot; si no, consulta viva |
| `live` | Siempre consulta viva |

El informe **siempre** declara cuál de los dos produjo el resultado. "Según el
snapshot de agosto" y "según este minuto" son afirmaciones distintas, y quien
compra tiene derecho a saber cuál tiene en la mano.

---

## Notas de despliegue

- **Cron en plan Hobby:** Vercel limita a 2 cron jobs y una ejecución diaria.
  `vercel.json` usa exactamente 2 y respeta esa cadencia.
- **`maxDuration`:** la ruta de cosecha declara 300 s. En Hobby el techo real es
  menor; por eso la cosecha es resumible y los días 2–5 existen.
- **Retención de snapshots:** no borres snapshots `SUPERSEDED`. Son la base de
  reproducibilidad de todos los dossiers ya emitidos. La base de datos rechaza
  editarlos por trigger.
