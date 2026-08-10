# Guía de uso

Para quién es esto y cómo se usa, paso a paso.

---

## Quién usa esto

| Perfil | Qué pregunta trae | Qué se lleva |
|---|---|---|
| **Analista de inversión minera** | ¿Vale la pena mirar este activo? | Descarte o priorización en minutos, no en semanas |
| **Consultor legal / de tierras** | ¿Qué me va a saltar en el due diligence? | Lista de hallazgos con la fuente de cada uno |
| **Equipo de sostenibilidad** | ¿Tocamos un ANP o territorio sensible? | Superposición medida en hectáreas, con norma legal citada |
| **Operador con portafolio** | ¿Qué se movió este mes en mis áreas? | Reporte mensual de cambios |

**Lo que NO es:** no establece legalidad, título, viabilidad ni cumplimiento.
Es un tamizaje preliminar que indica **dónde mirar**. El dossier lo dice en su
primera página, y esa honestidad es lo que lo hace utilizable como insumo real
de decisión.

---

## El flujo, en 4 pasos

### 1. Cargar el área de interés

En `/app` → **New assessment**. Se acepta:

- **GeoJSON** (`.geojson`, `.json`) — polígono o multipolígono
- **KML** (`.kml`) — el que exporta Google Earth
- **Coordenadas pegadas** — lista de pares lat/lon

El sistema valida la geometría antes de aceptarla: si el polígono no cierra, se
auto-intersecta o cae fuera del país configurado, lo dice y no continúa. Un área
mal cargada produciría un informe con números correctos sobre el terreno
equivocado, que es peor que no producir nada.

Al aceptarla verás el **área en hectáreas**, el **centroide** y un **hash de
geometría**. Ese hash es el que permite comprobar después que dos evaluaciones
hablan exactamente del mismo polígono.

### 2. Ejecutar la evaluación

El motor consulta las fuentes, calcula y devuelve:

- **Riesgo general 0–100** con nivel (`LOW` → `CRITICAL`)
- **Confianza 0–100** — qué tan completa fue la evidencia
- **5 dimensiones**: tenencia legal, ambiental, territorial, hídrico/físico,
  sensores remotos
- **Factores individuales**, cada uno con su regla, su peso y su evidencia

> **Riesgo y confianza son cosas distintas.** Riesgo alto con confianza baja
> significa "hay señales preocupantes y datos incompletos" — no es lo mismo que
> riesgo alto con confianza alta. La interfaz nunca los mezcla en un solo número.

**El caso que más importa entender:** si ninguna dimensión pudo evaluarse, el
resultado es `NOT_ASSESSED`, **no** `LOW`. Un cero porque no se midió nada
presentado como "riesgo bajo" sería la cosa más peligrosa que este producto
podría decir.

### 3. Revisar la evidencia

Cada factor tiene un enlace a la evidencia que lo sustenta. En el cajón de
evidencia se ve, por cada hallazgo:

- Qué fuente respondió y **cuándo se le preguntó**
- El registro concreto (código catastral, nombre del ANP, norma legal)
- La **geometría de la superposición** dibujada en el mapa
- Un **enlace al portal oficial** para verificarlo a mano

**Un factor sin evidencia es un bug, no una decisión de diseño.** Si algo no se
pudo verificar, aparece en *Missing checks* con la conclusión que queda
bloqueada por ese vacío.

### 4. Emitir el dossier

**Generate dossier** produce un documento imprimible con: resumen ejecutivo,
desglose por dimensión, tabla de hallazgos, apéndice de evidencia con fuentes y
fechas, y el bloque de **base de reproducibilidad**.

El dossier **congela** la evidencia tal como estaba. Reabrirlo no vuelve a
consultar las fuentes: reproduce lo que se supo ese día. Por eso sirve como
respaldo de una decisión tomada en una fecha concreta.

---

## La base mensual: por qué el informe dice "según el snapshot de agosto"

Las fuentes oficiales se cosechan una vez al mes en un **snapshot fechado e
inmutable**. Una evaluación declara contra qué snapshot se calculó.

Esto resuelve un problema concreto: si INGEMMET edita un registro en octubre, un
dossier emitido en agosto **seguiría siendo re-derivable** con exactitud. Sin
esto, "determinista" solo significaría "estable dentro de la misma sesión", y el
documento perdería valor probatorio con el tiempo.

En el dossier verás:

| Campo | Qué significa |
|---|---|
| **Evidence basis** | `Monthly snapshot — 2026-08` o `Live query at assessment time` |
| **Period** | El mes que representa esa base |
| **Records** | Cuántos registros tenía la capa completa |
| **Snapshot checksum** | Huella del contenido. Dos meses con el mismo checksum son datos idénticos |

Si no hay snapshot construido todavía, la evaluación consulta en vivo y **lo
dice**. Nunca se presenta un dato vivo como si fuera una base fechada.

---

## Monitoreo mensual

Un tamizaje responde *qué es cierto hoy*. El monitoreo responde *qué se movió
desde la última vez*, que es la pregunta que un operador tiene que hacerse todos
los meses.

**Activarlo:** en un proyecto → **Monitor this area**.

Cada mes, cuando se construye el snapshot nuevo, se compara contra el anterior y
se reporta lo que toca tu área:

- **Concesiones nuevas** que se superponen
- **Cambios de estado** (p. ej. de `EN TRAMITE` a `TITULADO`)
- **Concesiones retiradas** o extinguidas
- **Cambios en límites** de áreas protegidas

**Un mes sin cambios también genera reporte.** "No cambió nada" es un hallazgo
sobre el que se puede actuar; callarlo dejaría el silencio ambiguo entre "no hubo
cambios" y "no miramos".

> El primer reporte de cambios existe cuando hay **dos snapshots mensuales
> consecutivos** del área. Antes de eso no hay contra qué comparar, y la
> suscripción lo dice al activarse en lugar de aparentar actividad.

---

## Cómo leer un resultado sin equivocarse

| Ves esto | Significa | Qué hacer |
|---|---|---|
| `COMPLETED` + confianza alta | Todas las fuentes P0 respondieron | Úsalo como insumo de decisión |
| `PARTIAL` | Alguna fuente P0 no respondió | Mira *Missing checks* antes de concluir |
| `NOT_ASSESSED` | Nada se pudo evaluar | **No** es riesgo bajo. No concluyas nada |
| `STALE` en una fuente | El snapshot tiene más de un mes | El refresco mensual no corrió; revisa `/api/corpus` |
| `MANUAL_VERIFICATION_REQUIRED` | No hay interfaz oficial estable | Verifica a mano en el portal enlazado |
| Marca de agua fucsia | Datos de demostración, ficticios | Nunca lo uses para decidir |

---

## Preguntas frecuentes

**¿Puedo confiar en el número de riesgo?**
Puedes confiar en que es reproducible y en que cada punto es atribuible a una
regla y a una evidencia. Los pesos de las reglas son un juicio de dominio: están
versionados y a la vista precisamente para que un experto los discuta.

**¿Por qué a veces una fuente dice `NOT_CONFIGURED`?**
Porque esa capa no está conectada en este despliegue. No significa "sin
hallazgos" — significa que no se preguntó. La diferencia es la razón de ser del
producto.

**¿El dossier cambia si lo abro dentro de seis meses?**
No. Congela la evidencia del día en que se generó.

**¿Sirve fuera de Perú?**
La arquitectura es agnóstica: los adaptadores y las reglas se configuran por
jurisdicción. Hoy las fuentes conectadas son peruanas.
