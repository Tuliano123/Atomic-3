# Combat / Skills: Effects (efectos custom por scoreboard)

Ruta: `Atomic BP/scripts/features/skills/combat/effects`

Minecraft Bedrock 1.21.132 · `@minecraft/server` 2.4.0

Este feature implementa **efectos personalizados** que aplican daño real al scoreboard `Vida` de forma periódica. A diferencia de los efectos vanilla (que no interactúan con el sistema de vida custom), estos efectos usan scoreboards como temporizadores y el sistema de `combat/health` como receptor del daño.

---

## Gate global (OBLIGATORIO)

Este sistema SOLO aplica a entidades que cumplan:

- `H == 1` en el objetivo (target).

Si la entidad no tiene `H==1`, el efecto **no se procesa** (early-exit). Esto es consistente con el gate usado en `combat/health` y `combat/damage_dealt`.

---

## Concepto general

### Temporizador por scoreboard

Cada efecto custom usa un scoreboard dedicado cuyo valor representa la **duración restante en segundos**. El sistema decrementa ese valor una vez por segundo (sincronizado con el scoreboard `segundos` o via `system.runInterval` a 20 ticks).

- Ejemplo: si `EffVeneno = 10`, el jugador tiene 10 segundos de veneno restantes.
- Cada segundo, el valor se reduce en 1.
- Cuando llega a `0`, el efecto termina y se limpia.

### Daño periódico al scoreboard `Vida`

Mientras el efecto esté activo (scoreboard > 0), en cada tick de daño del efecto se calcula el daño como un **porcentaje de `VidaMaxTotalH`** del jugador y se sustrae directamente del scoreboard `Vida`.

- `combat/health` detecta el cambio en `Vida` y sincroniza los corazones vanilla automáticamente.
- Si `VidaAbsorcion > 0`, el daño de efectos **NO** se absorbe por absorción. Los efectos custom ignoran `VidaAbsorcion` y restan directamente de `Vida`. La absorción solo protege contra daño de golpes (`damage_dealt`).

### Holograma de daño por efecto

Cada vez que un efecto aplica daño, se spawnea un holograma flotante (`atomic:hologram`) mostrando la cantidad de daño infligido. Esto es similar al sistema de `damage_title/` pero con formato propio por efecto.

**Placeholder**: `<Daño>` (o `<Dano>` para ASCII) se sustituye por el número de daño real aplicado.

Formato del número:

- Separador de miles con coma: `10000` → `10,000` / `17132` → `17,132`.
- Usar la misma función `formatThousands` de `damage_title/format.js` o una equivalente.
- `Math.floor` siempre: el daño de efectos es entero.

Cada efecto define su propio formato de texto (color `§` + emoji). Los emojis se convierten a PUA via `custom-emojis` para que rendericen como glyphs en nametags, igual que en `damage_title`.

---

## Holograma (entidad)

Entidad usada:

- `atomic:hologram` (ver docs generales en `Atomic BP/docs/holograms/hologram.md`).

Spawn:

- Se spawnea cerca del target usando `target.location`.
- Offsets relativos al target, sin salirse de bounds: X/Z dentro de ±0.4 y Y entre −1.7 y −0.5.
- Esto compensa el "cuerpo" del holograma y centra el título incluso en mobs pequeños.
- Se puede reutilizar la lógica de offsets y jitter de `damage_title/config.js` para mantener consistencia visual.

Duración:

- Vive ~`durationMs` (default 1200 ms ≈ 24 ticks) y luego se elimina (kill/remove best-effort).
- Se puede reutilizar `spawnDamageHologram()` de `damage_title/hologramFactory.js` o crear una función análoga.

---

## Efectos vanilla complementarios

Algunos efectos custom aplican adicionalmente un efecto vanilla **solo como decoración visual** (partículas del efecto, tint en pantalla, etc.). El daño real siempre proviene del scoreboard, **nunca** del efecto vanilla.

- El efecto vanilla se aplica via `entity.addEffect(effectType, duration, { amplifier, showParticles })` cada tick de daño o al inicio del efecto.
- La duración del efecto vanilla se sincroniza con el scoreboard (se reaplicaría periódicamente para que no expire antes).
- Si el efecto custom no requiere visual vanilla, se usan partículas manuales con `dimension.spawnParticle(particleId, location)`.

Es imposible agregar efectos vanilla personalizados en Bedrock; por eso este sistema los simula por scoreboard.

---

## Partículas manuales (efectos sin visual vanilla)

Algunos efectos (Congelamiento, Calor) no usan un efecto vanilla y en su lugar spawnean partículas manualmente alrededor del jugador.

Reglas de spawn de partículas:

- Posición: relativa al jugador con offsets aleatorios.
  - X/Z: dentro de ±0.9 (bounds más amplios que el holograma para cubrir el cuerpo).
  - Y: entre −1.7 y −0.5 (mismo rango que hologramas).
- Cantidad: entre 1 y 3 partículas por tick de partículas.
- Se spawnean con `dimension.spawnParticle(particleId, location)`.
- La frecuencia de partículas se sincroniza con el tick de daño del efecto.

---

## Scoreboards

### Registro

Todos los scoreboards de efectos se registran en `Atomic BP/scripts/scoreboards/catalog.js` usando `addObjective()`, siguiendo la convención existente.

### Convención de nombres

Prefijo `Eff` + nombre del efecto (sin espacios, sin `ñ`):

| Efecto          | Scoreboard ID      | Display Name        |
| --------------- | ------------------- | ------------------- |
| Veneno          | `EffVeneno`         | Eff Veneno          |
| Congelamiento   | `EffCongelamiento`  | Eff Congelamiento   |
| Calor           | `EffCalor`          | Eff Calor           |

El valor del scoreboard es la duración restante en segundos (int ≥ 0). Un valor de `0` significa que el efecto no está activo.

---

## Clasificación de efectos (tipos)

Los efectos se clasifican en **4 tipos** según su letalidad y resistencia a limpiezas. Esto determina el comportamiento al interactuar con habilidades, armas o ítems que limpien efectos.

| Tipo | Nombre       | Letal | Limpieza                                               | Descripción                                                                |
| ---- | ------------ | ----- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1    | No-letal     | No    | Todas (efectos, armas, habilidades, ítems, etc.)       | No pueden matar. `Vida` se clampa a un mínimo de `1` al aplicar daño.     |
| 2    | Letal menor  | Sí    | Solo las mejores (habilidades o ítems de tier alto)     | Pueden matar. Mitigables por métodos de limpieza avanzados.               |
| 3    | Letal mayor  | Sí    | Ninguna                                                 | Inmunes a cualquier limpieza. Solo terminan al expirar o por muerte.      |
| 4    | Maldición    | Sí    | Ninguna                                                 | Diseñados para matar. Inmunes a toda limpieza. Extremadamente agresivos.  |

### Comportamiento de efectos no-letales (Tipo 1)

Cuando un efecto de Tipo 1 aplica daño:

```
danoEfecto = Math.floor(VidaMaxTotalH * porcentaje)
nuevaVida  = Math.max(1, Vida - danoEfecto)
```

El jugador **nunca** puede morir directamente por un efecto de Tipo 1. Si `Vida - danoEfecto` resultaría en `≤ 0`, se clampa a `1`.

### Comportamiento de efectos letales (Tipos 2, 3, 4)

```
danoEfecto = Math.floor(VidaMaxTotalH * porcentaje)
nuevaVida  = Vida - danoEfecto
```

Si `Vida ≤ 0`, `combat/health` se encarga de matar al jugador (mismo flujo que muerte por golpe).

---

## Limpieza y muerte

### Al morir

Cuando el jugador muere (`HDead=1` o evento `playerSpawn`), **todos** los efectos activos se limpian:

- Todos los scoreboards `Eff*` se ponen a `0`.
- Los efectos vanilla complementarios se remueven (`entity.removeEffect()`).

Ningún efecto persiste después de la muerte, a menos que se indique explícitamente en su especificación.

### Limpieza externa

Cuando un sistema externo (habilidad, arma, ítem) solicita limpiar efectos:

- Se evalúa el **tipo** de cada efecto activo.
- Solo se limpian los efectos cuyo tipo lo permita según la tabla de clasificación.
- Limpiar = poner el scoreboard a `0` y remover el efecto vanilla asociado (si existe).

---

## Ciclo de vida de un efecto

1. **Aplicación**: un sistema externo (habilidad, arma, mob) escribe un valor > 0 en el scoreboard del efecto (ej. `EffVeneno = 10`). Si el efecto tiene visual vanilla, se aplica con `addEffect()`.
2. **Tick de efecto**: cada intervalo de daño del efecto (varía por efecto), si el scoreboard > 0:
    - Calcula el daño como porcentaje de `VidaMaxTotalH`.
   - Resta el daño de `Vida` (con clamp si es Tipo 1).
   - Spawnea el holograma de daño con el formato del efecto.
   - Spawnea partículas si el efecto las requiere.
   - Reaplicar efecto vanilla si corresponde (para mantener sincronía visual).
3. **Decremento**: una vez por segundo, el scoreboard se reduce en 1.
4. **Expiración**: cuando el scoreboard llega a `0`:
   - Se remueve el efecto vanilla asociado (si existe) con `entity.removeEffect()`.
   - Se dejan de spawnear partículas y hologramas.
5. **Limpieza forzada**: si el jugador muere o un sistema externo limpia el efecto, se fuerza el scoreboard a `0` y se ejecuta el paso 4.

---

## Dependencias

### `combat/health` (vida custom)

- Proporciona los scoreboards `Vida`, `VidaMaxTotalH`, `VidaAbsorcion`, `HDead`.
- Este feature **solo modifica** `Vida`. La sincronización con corazones vanilla y la lógica de muerte la maneja `combat/health`.
- `Effects` no interactúa con `VidaAbsorcion`: el daño de efectos bypasea la absorción.

### `combat/damage_title` (hologramas de daño)

- Se reutiliza el patrón de holograma flotante (spawn, offset, duración, best-effort cleanup).
- Se puede reutilizar `spawnDamageHologram()` de `hologramFactory.js`.
- Se puede reutilizar `formatThousands()` de `format.js` para el separador de miles.
- Los emojis custom se convierten via `custom-emojis/index.js` (`applyCustomEmojisToText()`).

### `combat/damage_dealt` (NO se usa directamente)

- `damage_dealt` maneja daño por golpe. `effects` maneja daño periódico. Son independientes.
- Ambos modifican `Vida`, pero en momentos diferentes y con lógica diferente.

### `custom-emojis` (conversión de emojis)

- Los emojis Unicode en el formato del holograma (`🧪`, `❄`, `🔥`, etc.) se convierten a caracteres PUA para renderizar como glyphs custom en Bedrock.

### Scoreboards globales

- `H` — gate global del sistema.
- `Vida` — vida actual del objetivo.
- `VidaMaxTotalH` — vida máxima total (base para el cálculo de daño por porcentaje en efectos).
- `segundos` / `ticksegundos` — para sincronizar decrementos (alternativa a `system.runInterval`).

---

## Lista de efectos — Especificaciones

---

### 1. Veneno — Tipo 1 (no-letal)

| Propiedad              | Valor                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Scoreboard             | `EffVeneno`                                                |
| Tipo                   | 1 (no-letal, limpiable por cualquier método)               |
| Efecto vanilla         | `poison` (solo visual; el daño lo maneja el scoreboard)    |
| Daño por tick          | 5% de `VidaMaxTotalH`                                      |
| Intervalo de daño      | Sincronizado con los ticks de daño del efecto poison vanilla (cada ~1.25s = 25 ticks a amplifier 0) |
| Partículas manuales    | No (las provee el efecto vanilla de poison)                |
| Formato del holograma  | `§r§2<Daño>🧪`                                            |

**Notas de implementación**:

- El efecto vanilla `poison` se aplica con `entity.addEffect("poison", duration, { amplifier: 0, showParticles: true })`.
- La duración del `addEffect` debe coincidir o exceder ligeramente el tiempo restante del scoreboard para que no se desincronice. Reaplicar periódicamente es aceptable.
- El daño del poison vanilla se ignora porque `combat/damageCancel` previene cambios en HP vanilla. El daño real proviene únicamente de la resta al scoreboard `Vida`.
- Sincronización: el tick de daño del efecto custom debe coincidir con el ritmo del poison vanilla (~25 ticks para amplifier 0) para que visualmente sea coherente. Si la sincronización exacta con el evento vanilla es compleja, usar un intervalo fijo de 25 ticks es aceptable.
- Al ser Tipo 1: `Vida` se clampa a mínimo `1` tras aplicar daño.

---

### 2. Congelamiento — Tipo 1 (no-letal)

| Propiedad              | Valor                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Scoreboard             | `EffCongelamiento`                                         |
| Tipo                   | 1 (no-letal, limpiable por cualquier método)               |
| Efecto vanilla         | Ninguno                                                    |
| Daño por tick          | 10% de `VidaMaxTotalH`                                     |
| Intervalo de daño      | Cada 0.9 s (18 ticks)                                      |
| Partículas manuales    | Sí                                                         |
| Formato del holograma  | `§r§b<Daño>❄`                                             |

**Partículas**:

- Tipo: `minecraft:snowflake_particle`.
- Posición: relativa al jugador. X/Z dentro de ±0.9, Y entre −1.7 y −0.5.
- Cantidad: entre 1 y 3 por tick de daño (aleatorio, `Math.floor(Math.random() * 3) + 1`).
- Frecuencia: sincronizada con el intervalo de daño (cada 18 ticks).
- Se spawnean con `dimension.spawnParticle("minecraft:snowflake_particle", location)`.

**Notas de implementación**:

- Sin efecto vanilla: todo el feedback visual es manual (partículas + holograma).
- Las partículas y el daño se procesan en el mismo tick para que la experiencia sea coherente.
- Al ser Tipo 1: `Vida` se clampa a mínimo `1` tras aplicar daño.

---

### 3. Calor — Tipo 1 (no-letal)

| Propiedad              | Valor                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Scoreboard             | `EffCalor`                                                 |
| Tipo                   | 1 (no-letal, limpiable por cualquier método)               |
| Efecto vanilla         | Ninguno                                                    |
| Daño por tick          | 15% de `VidaMaxTotalH`                                     |
| Intervalo de daño      | Cada 0.9 s (18 ticks)                                      |
| Partículas manuales    | Sí                                                         |
| Formato del holograma  | `§r§6<Daño>🔥`                                            |

> **Nota sobre `§v`**: el documento original especificaba `§r§v<Daño>🔥`, pero `§v` no es un código de formato válido en Minecraft Bedrock. Los códigos válidos van de `§0`–`§9`, `§a`–`§g`, y `§k`–`§r`. Se sugiere `§6` (dorado/naranja) como alternativa visual para el efecto de calor. Si se desea un color custom, se necesitaría `§g` (gold en Bedrock) o implementar un color via Material Instances (fuera de scope). **Confirmar el código de color deseado antes de implementar.**

**Partículas**:

- Tipo: `minecraft:basic_flame_particle`.
- Posición: relativa al jugador. X/Z dentro de ±0.9, Y entre −1.7 y −0.5.
- Cantidad: entre 1 y 3 por tick de daño (aleatorio).
- Frecuencia: sincronizada con el intervalo de daño (cada 18 ticks).

**Notas de implementación**:

- Mismo patrón que Congelamiento pero con partícula de fuego y mayor porcentaje de daño.
- Al ser Tipo 1: `Vida` se clampa a mínimo `1` tras aplicar daño.

---

## Fórmula general de daño por efecto

```
vidaActual    = getScore(entity, "Vida")
vidaMax       = getScore(entity, "VidaMaxTotalH")
danoEfecto    = Math.floor(vidaMax * porcentajeEfecto)
danoEfecto    = Math.max(0, danoEfecto)

if (tipo === 1) {
    nuevaVida = Math.max(1, vidaActual - danoEfecto)
} else {
    nuevaVida = vidaActual - danoEfecto
}

// Solo escribir si hubo cambio real
if (nuevaVida !== vidaActual) {
    setScore(entity, "Vida", nuevaVida)
    danoRealAplicado = vidaActual - nuevaVida
    spawnHologramaEfecto(entity, danoRealAplicado, formatoEfecto)
}
```

**Importante**: el valor mostrado en el holograma debe ser `danoRealAplicado` (la diferencia real entre la vida anterior y la nueva), no `danoEfecto` crudo. Esto es relevante para efectos de Tipo 1 donde el clamp puede reducir el daño efectivo.

---

## Arquitectura sugerida

```
effects/
    EFFECTS.md              # Este documento
    index.js                # initEffects(config?) — entry-point, registra el interval central
    config.js               # Configuración por defecto de todos los efectos
    effectTypes.js           # Definición de tipos (1-4) y reglas de limpieza
    effectRegistry.js        # Registro de efectos disponibles con sus propiedades
    tick.js                 # Lógica del tick central (decremento, daño, partículas, hologramas)
    scoreboard.js           # Helpers de scoreboard (getScore/setScore) o re-export de damage_dealt/scoreboard.js
    hologram.js             # Wrapper sobre hologramFactory para hologramas de efecto
    cleanse.js              # API pública de limpieza de efectos por tipo
```

---

## Integración

### Entry-point

Desde `Atomic BP/scripts/main.js`:

```js
import { initEffects } from "./features/skills/combat/effects/index.js";
initEffects({ debug: false });
```

### Aplicación de un efecto (API pública)

Un sistema externo aplica un efecto escribiendo directamente en el scoreboard:

```js
setScore(entity, "EffVeneno", 10); // 10 segundos de veneno
```

O se podría exponer una función helper:

```js
applyEffect(entity, "Veneno", 10); // Aplica Veneno por 10 segundos
```

Si el efecto ya estaba activo, se sobrescribe (o se suma, según diseño a definir).

### Registro en `catalog.js`

Agregar en `Atomic BP/scripts/scoreboards/catalog.js`:

```js
// --- Combat / Effects ---
addObjective(list, seen, "EffVeneno", "Eff Veneno");
addObjective(list, seen, "EffCongelamiento", "Eff Congelamiento");
addObjective(list, seen, "EffCalor", "Eff Calor");
```

---

## Consideraciones de rendimiento

- Usar un **único** `system.runInterval` central para procesar todos los efectos, no uno por efecto ni uno por entidad.
- En cada tick del interval, iterar sobre los jugadores con `H==1` y verificar si tienen algún scoreboard de efecto > 0.
- Early-exit agresivo: si el jugador no tiene ningún efecto activo, saltar inmediatamente.
- Evitar escrituras redundantes: si `danoRealAplicado === 0`, no spawnear holograma ni escribir `Vida`.
- Limitar hologramas: si el jugador tiene múltiples efectos activos simultáneos tickeando al mismo tiempo, considerar un rate-limit o stagger para no saturar de entidades.

---

## Casos de uso (aceptación)

### Caso 1: Veneno aplicado por 10 segundos

- Jugador: `H=1`, `Vida=100`, `VidaMaxTotalH=100`, `EffVeneno=10`.
- Tick de veneno (~25 ticks): `danoEfecto = floor(100 * 0.05) = 5`.
- Tipo 1 → `nuevaVida = max(1, 100 - 5) = 95`.
- Holograma: `§r§25🧪`.
- Siguiente tick: `danoEfecto = floor(100 * 0.05) = 5`, `nuevaVida = 90`.
- Tras 10 segundos: `EffVeneno = 0`, se remueve poison vanilla.

### Caso 2: Efecto no-letal con vida baja

- Jugador: `H=1`, `Vida=3`, `VidaMaxTotalH=100`, `EffCalor=5`.
- Tick de calor: `danoEfecto = floor(100 * 0.15) = 15`.
- Tipo 1 → `nuevaVida = max(1, 3 - 15) = 1`.
- `danoRealAplicado = 2` → se spawnea holograma y se escribe `Vida=1`.
- Siguiente tick: `nuevaVida` vuelve a clamping en `1` → `danoRealAplicado = 0` y ya no se spawnea holograma.

### Caso 3: Muerte durante efecto

- Jugador muere por golpe (`Vida ≤ 0` vía `damage_dealt`).
- `combat/health` mata al jugador y setea `HDead=1`.
- `effects` detecta la muerte (via `playerSpawn` o check de `HDead`) y limpia todos los scoreboards `Eff*`.

### Caso 4: Múltiples efectos simultáneos

- Jugador: `H=1`, `Vida=200`, `EffVeneno=5`, `EffCongelamiento=3`.
- Ambos efectos corren independientemente en sus propios intervalos.
- Cada uno resta su porcentaje de `VidaMaxTotalH` al momento de su tick.
- Se generan hologramas separados para cada efecto (con su formato propio).

---

## Pendientes / Decisiones abiertas

- [ ] **Confirmar código de color para Calor** (`§v` no es válido; se propone `§6`).
- [ ] **Stacking**: ¿sobrescribir duración o sumar? (ej. si el jugador ya tiene `EffVeneno=5` y recibe otro de `EffVeneno=8`, ¿queda en 8 o en 13?).
- [ ] **Efectos de Tipo 2, 3 y 4**: definir efectos concretos para estas categorías (Veneno, Congelamiento y Calor son todos Tipo 1 actualmente).
- [ ] **Interacción con absorción**: confirmado que se bypasea `VidaAbsorcion`, pero documentar si algún efecto futuro debería respetarla.
- [ ] **Amplificadores**: ¿los efectos tienen niveles (amplifier)? Ej. Veneno II = 10% en vez de 5%.
- [ ] **Nombre de partícula de fuego**: verificar si el ID correcto en Bedrock 1.21.80+ es `minecraft:basic_flame_particle` o `minecraft:basic_flame`. Validar en runtime.
- [ ] **Inmunidad temporal**: ¿debería existir un período de inmunidad tras limpiar un efecto para evitar re-aplicación inmediata?