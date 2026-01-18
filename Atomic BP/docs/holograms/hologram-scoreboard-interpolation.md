# Especificación: Hologramas con interpolación de scoreboards

## Objetivo

Permitir que la entidad `atomic:hologram` muestre **texto dinámico** basado en valores de scoreboard, usando un **template** que se define al spawnear la entidad (por ejemplo con `/summon`).

Caso de uso principal:

- Crear un holograma con un template:

  `/summon atomic:hologram ~~~ "Este es un score de test: ${TEST:test}"`

- Actualizar el scoreboard de un participante (jugador real o “falso”) y que el texto del holograma se actualice automáticamente:

  `/scoreboard players add test TEST 1`

Donde:

- `TEST` = nombre del objetivo de scoreboard (objective)
- `test` = participante del scoreboard (jugador real o “falso”) que existe como entrada del scoreboard

---

## Definiciones

- **Template**: string original que contiene texto + placeholders `${...}`.
- **Placeholder**: referencia a un valor dinámico. En esta especificación solo aplica a scoreboards.
- **Render**: string final que se asigna a `entity.nameTag` luego de evaluar los placeholders.

---

## Sintaxis de placeholders

### Scoreboards

Formato:

- `${<OBJECTIVE>:<PARTICIPANT>}`

Reglas:

- `<OBJECTIVE>`: nombre del scoreboard objective. Debe coincidir con el objetivo existente (case-sensitive en comandos; en API puede variar, pero se recomienda tratarlo como case-sensitive).
- `<PARTICIPANT>`: nombre del participante del scoreboard.
  - Puede ser un jugador real (por ejemplo `antheuss`).
  - Puede ser un participante “falso” (por ejemplo `test`).

Ejemplo:

- `"Kills: ${KILLS:antheuss}"`
- `"Dinero banco: §a${MONEY:bank}"`

### Múltiples placeholders

Un template puede contener múltiples placeholders:

- `"§eKills: §f${KILLS:antheuss} §7| §aDinero: §f${MONEY:antheuss}"`

### Colores y multilinea

- Se permiten códigos `§` dentro del template.
- Se permite `\n` para múltiples líneas.

Ejemplo:

`/summon atomic:hologram ~~~ "§aStats\n§7Kills: §f${KILLS:antheuss}\n§7Deaths: §f${DEATHS:antheuss}"`

---

## Reglas de evaluación

### Resolución de scoreboard

Para cada placeholder `${OBJ:participant}` se obtiene el score actual del participante.

Casos:

- Si el objective **no existe**: el placeholder se reemplaza por `0` (configurable; ver sección Configurables).
- Si el participant **no existe** dentro del objective: el placeholder se reemplaza por `0`.
- Si el score existe: se reemplaza por su valor numérico en base 10 (ej. `-3`, `0`, `27`).

### Render final

- El render final se asigna a `entity.nameTag`.
- El sistema debe conservar el template original para poder volver a renderizar cuando cambien los scores.
  - Importante: si se sobreescribe `nameTag` con el render y no se guarda el template, no hay forma confiable de “reconstruir” el template.

---

## Persistencia del template (requerimiento técnico)

Para soportar reinicios y updates, se requiere guardar:

- `template` (string)
- opcional: metadata (frecuencia de actualización, flags, etc.)

Opciones (a decidir en implementación):

1) **Dynamic Properties en la entidad (recomendado)**
   - Guardar `atomic:hologram.template` como string.
   - Ventaja: no depende de tags (límite 256), y es claro.
   - Requiere registrar propiedades al inicializar el mundo.

2) Tags en la entidad (solo si el template es corto)
   - Guardar fragmentos o una key para buscar el template en una tabla global.
   - Desventaja: límite de longitud y parsing más frágil.

---

## Actualización e interpolación (rendimiento)

### Interpolación temporal (suavizado)

Se define **interpolación** como la capacidad de mostrar una transición visual cuando un score cambia abruptamente.

Modo propuesto:

- Si el score cambia de `a` a `b`, el holograma puede animar el número en varios pasos hasta llegar a `b`.

Parámetros recomendados:

- `updateIntervalTicks`: cada cuánto revisar cambios (ej. 10–20 ticks).
- `lerpDurationTicks`: duración del suavizado (ej. 10–40 ticks).
- `lerpStep`: incremental por tick o por frame (dependiendo del interval).

Observación:

- En scoreboards normalmente interesa más “actualización barata” que animación continua.
- La implementación debe evitar actualizar `nameTag` cada tick si no es necesario.

### Estrategia de optimización mínima

- Cachear el último render por entidad.
- Re-renderizar solo si algún placeholder cambió.
- Centralizar el polling en un único `system.runInterval`, no uno por entidad.
- Limitar máximo de hologramas activos por dimensión.

---

## Configurables (propuestos)

- `missingObjectiveValue`: valor si el objective no existe (default: `0`).
- `missingParticipantValue`: valor si el participant no existe (default: `0`).
- `maxTemplateLength`: límite para evitar abuso (ej. 512 o 1024).
- `maxHolograms`: límite de hologramas activos por dimensión (ej. 200).
- `updateIntervalTicks`: frecuencia de evaluación (ej. 10–20).
- `enableInterpolation`: boolean.
- `lerpDurationTicks`: duración del suavizado.

---

## Casos de uso

### 1) Participante “falso” (tu caso)

1. Crear holograma:

   `/summon atomic:hologram ~~~ "Este es un score de test: ${TEST:test}"`

2. Subir score:

   `/scoreboard players add test TEST 1`

3. Resultado esperado:

- El holograma actualiza el texto y refleja el nuevo valor.

### 2) Jugador real

- `/summon atomic:hologram ~~~ "Kills de antheuss: ${KILLS:antheuss}"`

### 3) Múltiples valores

- `/summon atomic:hologram ~~~ "§eK:§f ${KILLS:test} §7D:§f ${DEATHS:test} §7$§f ${MONEY:test}"`

### 4) Valores negativos

- Si el objective puede ser negativo:

  `/summon atomic:hologram ~~~ "Balance: ${BALANCE:test}"`

### 5) Objective o participante inexistente

- `/summon atomic:hologram ~~~ "Inexistente: ${NOEXISTE:abc}"`

Resultado esperado:

- Reemplaza por `0` (o configurable).

---

## Consideraciones de implementación (no código)

- La API de `@minecraft/server` permite `entity.nameTag`.
- Para obtener scores de participantes “falsos” por nombre, la implementación debe decidir entre:
  - Usar API de scoreboard y buscar participants por displayName (si está disponible), o
  - Usar comandos `scoreboard players get` como fallback controlado (cuidado con rendimiento y permisos).

---

## No objetivos (por ahora)

- No se define sintaxis para variables que no sean scoreboards (ej. `{player.name}`) en esta primera iteración.
- No se define “per-player hologram” (texto diferente para cada jugador viendo el mismo holograma).

---

## Preguntas abiertas (para cerrar antes de implementar)

1) ¿Qué valor debe mostrarse si falta objective/participant: `0` o vacío?
2) ¿Interpolación debe ser global o configurable por holograma?
3) ¿Se permite `${OBJ:@p}` / selectors? (recomendación: NO en v1 por seguridad y coste).
4) ¿Límite máximo de longitud del template y número de placeholders?
