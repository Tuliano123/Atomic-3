# Skills / Combat

> Minecraft Bedrock 1.21.132 · `@minecraft/server` 2.4.0

Ruta: `Atomic BP/scripts/features/skills/combat`

Módulo central del sistema de combate custom. Agrupa toda la lógica relacionada con **cálculo de estadísticas**, **aplicación de daño**, **vida por scoreboards**, **efectos custom** y **feedback visual** (hologramas de daño).

---

## 1. Arquitectura

### 1.1 Estructura de directorios (estado actual)

```text
skills/
  combat/
    README.md                 ← Este documento (master)
    calc/                      ← Fórmula de daño final (lee *TotalH de lecture/)
      README.md
      config.js
      index.js
      scoreboard.js
      utilMath.js
    health/                   ← Vida custom por scoreboards (players + mobs)
      README.md
      index.js 
      scoreboards.js
      defaults.js
      syncPlayers.js
      syncMobs.js
    damage_dealt/             ← Aplicación de daño real al scoreboard Vida
      README.md
      index.js
      scoreboard.js
      math.js
      cooldown.js
      damage_title_hook.js
      byplayer/
      by_mob/
    damage_title/             ← Hologramas flotantes de daño (feedback visual)
      README.md
      index.js
      config.js
      format.js
      guards.js
      hologramFactory.js
    damageCancel/             ← Cancelación de daño vanilla (HP vanilla intocable)
      README.md
      index.js
      score.js
    effects/                  ← Efectos custom periódicos (veneno, congelamiento, calor)
      EFFECTS.md
      index.js
      config.js
      tick.js
      scoreboard.js
      hologram.js
      particles.js
    defense/                  ← (Pendiente) Reducción de daño por defensa en mobs
      README.md
  lecture/                    ← Centralización de lectura de lore + escritura de *TotalH
  Centralizacion.md           ← Plan de reestructuración de skills/
  farming/
  fishing/
  foraging/
  mining/
  regeneration/
```

### 1.2 Flujo de datos

```text
┌────────────────────────────────────────────────────────────────────┐
│                        LECTURA (cada N ticks)                      │
│                                                                    │
│  Equipment (6 slots)  ──►  lecture  ──►  *TotalH scoreboards      │
│  (Personal/Otros)     ───────────────►  (Total por capa)          │
│                                            │                       │
│                                            ▼                       │
│                                         calc (fórmulas)            │
│                                                          │         │
│                              ┌────────────────────────────┘         │
│                              ▼                                     │
│                     Scoreboards de salida                          │
│                  (DanoFinalSC, DanoFinalCC,                        │
│                   ProbabilidadCriticaTotal,                        │
│                   DtotalH, MtotalH)                               │
└────────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
          damage_dealt    health          effects
          (aplica daño    (sync Vida ↔    (daño periódico
           a Vida)         corazones)      por scoreboard)
                │                            │
                ▼                            ▼
          damage_title                  hologram + partículas
          (holograma visual)
```

### 1.3 Dependencias externas

| Dependencia | Tipo | Uso |
|---|---|---|
| `atomic:hologram` | Entidad BP | Hologramas flotantes de daño (ver `docs/holograms/`) |
| `custom-emojis` | Feature script | Conversión de emoji Unicode a PUA para nametags |
| `scoreboards/catalog.js` | Script | Registro centralizado de objectives |

---

## 2. Gate global

Toda la lógica de este módulo está condicionada por el scoreboard `H`:

- `H == 1` → el sistema está **activo** para esa entidad (player o mob).
- `H != 1` ó ausente → **early-exit**; no se ejecuta ninguna lógica.

Aplica a:
- **calc**: solo recalcula stats para players con `H == 1`.
- **damage_dealt**: requiere `H == 1` en atacante **y** objetivo.
- **health**: solo sincroniza vida para entidades con `H == 1`.
- **damageCancel**: solo cancela daño vanilla si `H == 1`.
- **effects**: solo procesa efectos si el objetivo tiene `H == 1`.

---

## 3. Modelo de estadísticas

### 3.1 Categorías de stats

Cada estadística se descompone en cuatro capas aditivas.

> **Estado actual vs planificado**: hoy se usan scoreboards como `DMGH` (personal) y `DtotalH` (total). La nomenclatura se migrará a la convención `<Stat><Capa>H` descrita aquí. Ver [Centralizacion.md](../Centralizacion.md) para el plan de migración.

| Capa | Scoreboard planificado (ej: Daño) | Scoreboard actual (ej: Daño) | Fuente | Mutabilidad |
|---|---|---|---|---|
| **Personal** | `DanoPersonalH` | `DMGH` | Scoreboard editable del jugador | Editable por comandos/scripts |
| **Equipamiento** | `DanoEquipamientoH` | *(calculado en memoria)* | Suma del valor Total del lore de los 6 slots | Recalculado automáticamente |
| **Otros** | `DanoOtrosH` | *(no existe aún)* | Buffs, efectos, habilidades temporales | Escrito por sistemas externos |
| **Total** | `DanoTotalH` | `DanoFinalSC` / `DtotalH` | `Personal + Equipamiento + Otros` | Calculado; solo lectura |

$$
Total = Personal + Equipamiento + Otros
$$

> **Nota**: los IDs de scoreboards usan ASCII (sin acentos ni ñ) por compatibilidad. Ejemplo: `DanoTotalH` en vez de `DañoTotalH`.

### 3.2 Estadísticas soportadas

Todas siguen la convención Personal/Equipamiento/Otros/Total:

| Estadística | Tipo numérico | Etiqueta de lore |
|---|---|---|
| Poder | int | `Poder:` |
| Vida | int | `Vida:` |
| Defensa | int | `Defensa:` |
| Daño | int | `Daño:` |
| Daño Crítico | float | `Daño Crítico:` |
| Probabilidad Crítica | float (%) | `Probabilidad Crítica:` |
| Daño Verdadero | int | `Daño Verdadero:` |
| Mana | int | `Mana:` |
| Fortuna Minera | int | `Fortuna Minera:` |
| Experiencia Minera | int | `Experiencia Minera:` |
| Fortuna de Tala | int | `Fortuna de Tala:` |
| Frenesí de Tala | int | `Frenesí de Tala:` |
| Experiencia de Talado | int | `Experiencia de Talado:` |
| Fortuna de Cosecha | int | `Fortuna de Cosecha:` |
| Mutación Activa | float | `Mutación Activa:` |
| Experiencia de Cosecha | int | `Experiencia de Cosecha:` |

> Las estadísticas de minería, tala y cosecha son consumidas por `skills/mining/`, `skills/foraging/` y `skills/farming/` respectivamente, pero la **lectura del lore** se centraliza en `calc/` (y a futuro en `lecture/`).

### 3.3 Equipamiento leído

Se leen **6 slots** del jugador:

| Slot | API | Nota |
|---|---|---|
| Mainhand | `EquipmentSlot.Mainhand` | Si es armadura wearable, se ignora (aporta 0) |
| Offhand | `EquipmentSlot.Offhand` | — |
| Head | `EquipmentSlot.Head` | — |
| Chest | `EquipmentSlot.Chest` | — |
| Legs | `EquipmentSlot.Legs` | — |
| Feet | `EquipmentSlot.Feet` | — |

La capa **Equipamiento** es la **suma** de los valores Total de cada slot. Los sumatorios internos del lore (S1, S2, S3) se ignoran para este cálculo; solo importa el valor Total por línea.

---

## 4. Sub-features

### 4.1 `calc/` — Motor de cálculo

Responsable de aplicar la **fórmula de daño final** para cada player con `H == 1` consumiendo los **totales** (`*TotalH`) calculados por `lecture/`. Opera en un `system.runInterval` configurable (default: 10 ticks).

Detalles completos en [combat/calc/README.md](calc/README.md).

**Entradas**: `DanoTotalH`, `PoderTotalH`, `DanoCritTotalH`, `ProbCritTotalH`, `MATotalH`, `MMTotalH` (y totales de defensa/mana).
**Salidas**: `DanoFinalSC`, `DanoFinalCC`, `ProbabilidadCriticaTotal`, `DtotalH`, `MtotalH`.

Optimizaciones implementadas:
- **Cache por firma de equipo**: solo recalcula si cambió el item (typeId + nameTag + lore) o las stats base.
- **Escritura condicional**: solo actualiza scoreboards si el valor calculado difiere del anterior.
- **Early-exit**: si `H != 1`, pone salidas a 0 y continúa.

### 4.2 `health/` — Vida custom

Sistema de vida alternativo basado en los scoreboards `Vida` y `VidaMaxTotalH`, sincronizado con los corazones vanilla como display proporcional.

Scoreboards clave:
- `Vida`: vida actual (clamped a `0..VidaMaxTotalH`).
- `VidaMaxH`: vida máxima base/personal (inicializada a 100 la primera vez).
- `VidaMaxTotalH`: vida máxima total (`VidaMaxH + VidaGear`), calculada por `calc/`.
- `VidaAbsorcion`: escudo temporal (manzanas de oro). Se consume antes que `Vida`.
- `HDead`: flag interno de muerte lógica.

Comportamiento:
- **Players**: la vida vanilla es solo display proporcional. La curación vanilla se convierte a incremento de `Vida`. Las bajadas vanilla se ignoran (el daño real va por `damage_dealt`).
- **Mobs**: se matan cuando `Vida <= 0` y `VidaMaxTotalH > 0`. Si `VidaMaxTotalH == 0`, se tratan como inmortales lógicos.
- **Muerte/respawn**: al morir, `HDead = 1`. Al respawnear con `H == 1`, se resetea `Vida = VidaMaxTotalH`.

Detalles en [health/README.md](health/README.md).

### 4.3 `damage_dealt/` — Aplicación de daño

Aplica el daño calculado al scoreboard `Vida` cuando ocurre un golpe melee. No recalcula stats; **consume** los scoreboards de `calc/`.

Flujos soportados:
- **Player → Entity**: usa `DanoFinalSC`/`DanoFinalCC` + roll de crítico con `ProbabilidadCriticaTotal`. Reduce por defensa enemiga (`DtotalH`).
- **Mob → Player**: usa `DMGH` del mob. Reduce por defensa del jugador (`DtotalH`).

Fórmula de reducción por defensa:

$$
danoReal = \lfloor danoBase \times \frac{75}{defensaEnemigo + 75} \rfloor
$$

Donde `danoReal >= 0` siempre. Si defensa ≤ 0, no hay reducción.

Eventos utilizados:
- Primario: `world.afterEvents.entityHitEntity` (melee inmediato).
- Fallback PvP: `world.afterEvents.entityHurt` (protegido por cooldown para evitar doble-aplicación).

Detalles en [damage_dealt/README.md](damage_dealt/README.md).

### 4.4 `damage_title/` — Hologramas de daño

Renderiza un holograma flotante (`atomic:hologram`) con el daño real aplicado cada vez que `damage_dealt` resuelve un golpe. El holograma vive ~1200 ms.

Formatos:
- **No crítico**: `§7` + número con separador de miles. Ejemplo: `§710,000`.
- **Crítico**: patrón cíclico de colores (`§f → §e → §6 → §c`) por dígito con emojis decorativos (`⚪🟡🟠🔴`).

Detalles en [damage_title/README.md](damage_title/README.md).

### 4.5 `damageCancel/` — Cancelación de daño vanilla

Evita que el HP vanilla baje cuando `H == 1`. Prerrequisito para que el sistema de vida custom funcione sin interferencia.

- Preferido: `world.beforeEvents.entityHurt` con `ev.cancel = true`.
- Fallback: `world.afterEvents.entityHurt` restaurando HP con `ev.damage`.

Detalles en [damageCancel/README.md](damageCancel/README.md).

### 4.6 `effects/` — Efectos custom periódicos

Efectos de daño periódico (veneno, congelamiento, calor) implementados por scoreboards-temporizador. Cada efecto usa un scoreboard (`Eff<Nombre>`) cuyo valor es la duración restante en segundos.

Clasificación por letalidad:
- **Tipo 1** (no-letal): no puede matar (`Vida` clamped a 1). Limpiable por cualquier método.
- **Tipo 2** (letal menor): puede matar. Solo limpiable por habilidades/ítems de tier alto.
- **Tipo 3** (letal mayor): puede matar. Inmune a limpieza; solo expira por tiempo o muerte.
- **Tipo 4** (maldición): diseñado para matar. Inmune a toda limpieza.

El daño de efectos **ignora** `VidaAbsorcion` (bypasea la absorción).

Detalles en [effects/EFFECTS.md](effects/EFFECTS.md).

### 4.7 `defense/` — Defensa de mobs (pendiente)

Planificado para documentar estadísticas defensivas de mobs (resistencias, inmunidades, reducciones especiales).

---

## 5. Catálogo de scoreboards

### 5.1 Gate y control

| Scoreboard | Tipo | Descripción |
|---|---|---|
| `H` | dummy | Habilita el sistema (1 = activo) |
| `HDead` | dummy | Flag de muerte lógica |

### 5.2 Estadísticas base del jugador (Personal)

| Scoreboard | Descripción | Default |
|---|---|---|
| `DMGH` | Daño base personal | 0 |
| `CDH` | Daño Crítico base personal | 0 |
| `CCH` | Probabilidad Crítica base personal | 0 |
| `DH` | Defensa base personal | 0 |
| `MH` | Mana base personal | 0 |
| `VidaMaxH` | Vida máxima base personal | 100 (init automático) |
| `MAH` | Multiplicador Aditivo (escala ×10) | 10 (= ×1.0) |
| `MMH` | Multiplicador Multiplicativo (escala ×10) | 10 (= ×1.0) |

### 5.3 Salidas del calculador (Total)

| Scoreboard | Descripción |
|---|---|
| `DanoFinalSC` | Daño final teórico sin crítico (int) |
| `DanoFinalCC` | Daño final teórico con crítico (int) |
| `ProbabilidadCriticaTotal` | Probabilidad crítica total en % (int) |
| `DtotalH` | Defensa total (int) |
| `MtotalH` | Mana total (int) |
| `VidaMaxTotalH` | Vida máxima total (int) |

### 5.4 Vida y absorción

| Scoreboard | Descripción |
|---|---|
| `Vida` | Vida actual de la entidad |
| `VidaAbsorcion` | Vida extra temporal (absorción) |

### 5.5 Efectos custom

| Scoreboard | Descripción |
|---|---|
| `EffVeneno` | Duración restante (segundos) |
| `EffCongelamiento` | Duración restante (segundos) |
| `EffCalor` | Duración restante (segundos) |

### 5.6 Mobs (MVP)

| Scoreboard | Descripción |
|---|---|
| `DMGH` (en mob) | Daño base del mob (mínimo forzado: 1 si `H == 1`) |

---

## 6. Fórmula de daño final

### 6.1 Cálculo del DañoBaseFinal

$$
DañoBaseFinal = (1 + DañoTotal) \times (1 + \frac{Poder}{10}) \times MA \times MM + Bonus
$$

Donde:
- `DañoTotal` = stat base del jugador + suma de daño del equipamiento.
- `Poder` = stat de poder del equipamiento (default 0).
- `MA` = `MAH / 10` (Multiplicador Aditivo; default 1.0).
- `MM` = `MMH / 10` (Multiplicador Multiplicativo; default 1.0).
- `Bonus` = bonus plano (default 0).

Protecciones: si `MA` o `MM` son 0, `NaN` o `undefined`, se tratan como 1.

### 6.2 Sin crítico

$$
DanoFinalSC = \lfloor \max(0,\ DañoBaseFinal) \rfloor
$$

### 6.3 Con crítico

$$
DanoFinalCC = \lfloor \max(0,\ DañoBaseFinal \times (1 + \frac{DañoCríticoTotal}{100})) \rfloor
$$

`DanoFinalCC` se almacena como valor **teórico** (asumiendo que el golpe es crítico). La decisión de si un golpe fue crítico la toma `damage_dealt` en el momento del impacto.

### 6.4 Probabilidad de crítico

`ProbabilidadCriticaTotal` se interpreta como porcentaje (0–100):
- `0` → nunca crítico.
- `100` → crítico garantizado.
- El roll se hace en `damage_dealt`, no en `calc/`.

---

## 7. Principios de diseño

1. **Separación de responsabilidades**: `calc/` calcula, `damage_dealt/` aplica, `health/` sincroniza, `damage_title/` renderiza. Ningún módulo invade la responsabilidad de otro.
2. **Consumo, no recálculo**: los sub-features de combate **consumen** scoreboards calculados por `calc/`. No parsean lore ni recalculan fórmulas.
3. **Early-exit agresivo**: toda función verifica `H == 1` lo antes posible y sale sin trabajo adicional si no aplica.
4. **Escrituras mínimas**: solo se actualizan scoreboards cuando el valor realmente cambió.
5. **Rendimiento**: un solo `system.runInterval` central (no uno por jugador ni por entidad). Rate-limit y pooling donde corresponda.
6. **Robustez defensiva**: todo parsing es best-effort; valores faltantes se tratan como 0. Errores se silencian (`void e`) para no romper el loop.
7. **API nativa primero**: preferir `world.scoreboard` para leer/escribir scores. Usar `runCommandAsync` solo como fallback.
8. **Sin APIs experimentales**: solo Script API estable de `@minecraft/server` 2.4.0.
9. **Sin dynamic properties**: todo va en scoreboards + cache en memoria volátil (`Map` por player ID).
10. **IDs ASCII**: todos los nombres de scoreboards y archivos evitan caracteres especiales (ñ, acentos).

---

## 8. Integración (entry-point)

Desde `Atomic BP/scripts/main.js` (rutas actuales):

```js
import { initLecture } from "./features/skills/lecture/index.js";
import { initDamageCalc } from "./features/skills/combat/calc/index.js";
import { initCombatHealth } from "./features/skills/combat/health/index.js";
import { initDamageDealt } from "./features/skills/combat/damage_dealt/index.js";
import { initDamageTitle } from "./features/skills/combat/damage_title/index.js";
import { initVanillaDamageCancel } from "./features/skills/combat/damageCancel/index.js";
import { initEffects } from "./features/skills/combat/effects/index.js";

// Orden recomendado de inicialización
initLecture();
initDamageCalc();
initVanillaDamageCancel();
initCombatHealth();
initDamageDealt({ debug: false });
initDamageTitle({ durationMs: 1200, debug: false });
initEffects({ debug: false });
```

---

## 9. Cambios estructurales (implementados)

### 9.1 `lecture/` (lectura centralizada)

Existe `skills/lecture/` como módulo dedicado exclusivamente a la **lectura centralizada de lore** y su traducción a scoreboards por capa.

Responsabilidades de `lecture/`:
- Lectura de los 6 slots de equipamiento.
- Parsing de todas las estadísticas del lore (las 16 listadas en §3.2).
- Escritura de los scoreboards de capa **Equipamiento** (ej. `DanoEquipamientoH`) y los **Totales** `*TotalH`.

Responsabilidades que **permanecen** en `combat/calc/`:
- Fórmulas de daño final (`DanoFinalSC`, `DanoFinalCC`).
- Publicación de outputs legacy consumidos por combat (`ProbabilidadCriticaTotal`, `DtotalH`, `MtotalH`).

> Nota: `VidaMaxTotalH` lo escribe `lecture/` para evitar múltiples writers.

### 9.3 Nuevo modelo de scoreboards por capa

Se adoptará la convención `<Stat><Capa>H` para todas las estadísticas:

```text
DanoPersonalH       ← Editable por comandos
DanoEquipamientoH   ← Calculado por lecture/
DanoOtrosH          ← Escrito por efectos, buffs, etc.
DanoTotalH          ← Suma de las tres capas anteriores
```

Esto reemplazará gradualmente los scoreboards actuales (`DMGH`, `DanoFinalSC`, etc.) con una nomenclatura uniforme.

---

## 10. Recomendaciones técnicas para el desarrollo

### 10.1 Estructuras de datos

- **Registry Pattern para estadísticas**: definir un catálogo (`statRegistry`) que mapee cada estadística a su etiqueta de lore, tipo numérico, scoreboards por capa y reglas de parsing. Esto reemplaza los bloques repetitivos en `loreParser.js` por iteración sobre el catálogo.

```js
// Ejemplo conceptual
const STAT_REGISTRY = [
  { id: "Dano",     label: "Daño:",              type: "int",   hasS1: true,  hasS2: true,  hasS3: true  },
  { id: "Vida",     label: "Vida:",              type: "int",   hasS1: true,  hasS2: true,  hasS3: true  },
  { id: "DanoCrit", label: "Daño Crítico:",      type: "float", hasS1: false, hasS2: false, hasS3: true  },
  { id: "ProbCrit", label: "Probabilidad Crítica:", type: "float", hasS1: false, hasS2: false, hasS3: true },
  // ...
];
```

- **`Map<string, PlayerCalcCache>`**: ya implementado en `calc/index.js`. Mantener para evitar recálculos innecesarios. Considerar usar `WeakRef` o limpiar periódicamente entries de jugadores desconectados (ya se hace con el `Set<active>`).

- **Resultados de parsing como objetos planos inmutables**: `parseItemStatsFromLore()` ya devuelve un objeto plano. Mantener esta convención; evitar clases para datos de transferencia.

### 10.2 Patrones recomendados

- **Strategy Pattern para efectos**: cada efecto (veneno, congelamiento, calor) puede ser un objeto de configuración en vez de lógica hardcodeada. Esto facilita agregar efectos nuevos sin modificar el tick central.

```js
// Ejemplo conceptual
const EFFECT_DEFINITIONS = {
  Veneno:        { scoreId: "EffVeneno",        pct: 0.05, intervalTicks: 25, type: 1, format: "§r§2<Dano>🧪" },
  Congelamiento: { scoreId: "EffCongelamiento", pct: 0.10, intervalTicks: 18, type: 1, format: "§r§b<Dano>❄"  },
  Calor:         { scoreId: "EffCalor",         pct: 0.15, intervalTicks: 18, type: 1, format: "§r§6<Dano>🔥" },
};
```

- **Pipeline / Chain para el cálculo de daño**: estructurar las fórmulas como una cadena de transformaciones (`baseDamage → multiply → addBonus → floor → clamp`). Cada paso es una función pura, testeable independientemente.

- **Observer Pattern para hooks**: `damage_dealt` emite un evento que `damage_title` consume (ya implementado con `emitDamageTitle`). Extender este patrón para futuros consumidores (loggers, achievements, etc.) sin acoplar módulos.

- **Null Object Pattern para items vacíos**: cuando un slot está vacío, devolver un objeto de stats con todos los valores en 0 (ya se hace implícitamente). Esto evita verificaciones `if (item != null)` dispersas.

### 10.3 Buenas prácticas

- **Funciones puras y pequeñas**: mantener las funciones de parsing y cálculo sin side-effects. Los side-effects (escribir scoreboards, spawnear hologramas) se concentran en las funciones de integración.
- **Normalización antes de parsing**: strip de `§.`, colapso de espacios, trim. Ya implementado en `loreParser.js`; mantener como paso obligatorio.
- **Clamp a `int32`** (`-2147483648..2147483647`): antes de cualquier `setScore`. Ya implementado en `utilMath.js`.
- **Throttle para debug**: el debug por chat debe estar rate-limited (ya implementado con `throttleMs`). Nunca imprimir en cada tick sin throttle.
- **Config externalizada**: toda constante configurable (intervalos, defaults, nombres de objectives) debe vivir en `config.js`, no hardcodeada en la lógica.
- **Naming sin caracteres especiales**: archivos, variables y scoreboards en ASCII. Etiquetas display pueden usar Unicode.
- **Manejo de errores silencioso en loops**: los `try/catch` con `void e` en el loop principal son correctos para Bedrock Script API, donde un error no capturado puede matar el loop.
- **Preferir `Math.trunc` sobre `parseInt`**: para conversión a entero, `Math.trunc(Number(v))` es más predecible que `parseInt` con strings que contienen caracteres no numéricos.

### 10.4 Rendimiento

- **Un solo interval para cálculo** (ya implementado). No crear intervals por jugador.
- **Firma de equipamiento para cache** (`typeId|nameTag|lore.join`): recalcular solo cuando la firma cambie.
- **Evitar `getPlayers()` repetido**: llamar una vez por tick y reutilizar el array.
- **Batch de escrituras**: si se implementa `lecture/` como módulo separado, estructurar el pipeline para que una sola pasada por jugador lea todo y escriba todo, en vez de múltiples pasadas.
- **No spawnear entidades en loops de alta frecuencia**: los hologramas solo se crean en eventos puntuales (golpes, ticks de efecto), nunca en el loop de cálculo.

### 10.5 Testabilidad

- Las funciones de `loreParser.js` y `utilMath.js` son **puras** y pueden testearse offline (fuera de Bedrock) con un test runner como Node.js + cualquier framework de testing.
- Considerar un archivo `__tests__/` o un script de validación que importe los parsers y verifique contra strings de lore conocidos.
- El modo `debug` en cada sub-feature permite validación en runtime via chat.
