# Rework Regeneration (scoreboard-driven)

## 1) Objetivo

Rehacer el sistema de `skills/regeneration` para que **deje de depender del lore del ítem** en la resolución de `modifiers` y use como fuente principal los scoreboards calculados por `skills/lecture`.

Además, definir un contrato estable para:
- Modificadores por rangos/condiciones de score.
- Ganancia de experiencia (minería/tala/cosecha) sin floats.
- Emisión de titles temporales vía `systems/titlesPriority`.

---

## 2) Contexto real del proyecto (estado actual)

### Ya existe
- `regeneration/modifiers.js` selecciona modifier por lore (`Fortuna I/II/III`, `Silk Touch`) y prioridad.
- `regeneration/index.js` ya aplica `scoreboardAddsOnBreak` (global + bloque + modifier).
- `lecture/statRegistry.js` ya define stats clave por skill:
  - Fortuna minera: `FortMinTotalH`
  - Exp minera: `ExpMinTotalH`
  - Fortuna tala: `FortTalTotalH`
  - Exp tala: `ExpTalTotalH`
  - Fortuna cosecha: `FortCosTotalH`
  - Exp cosecha: `ExpCosTotalH`
- `titlesPriority` ya soporta titles temporales (API runtime).

### Problema principal
- El core de modifiers sigue acoplado a lectura de lore en runtime.
- El documento actual es ambiguo en contrato, alcance y orden de implementación.

---

## 3) Alcance de este rework

## Incluye
1. Rediseño de `modifiers` para evaluación por scoreboard + condiciones.
2. Migración gradual lore -> scoreboard (con compatibilidad temporal opcional).
3. Cálculo de XP por skill usando fórmula entera y determinista.
4. Emisión opcional de title temporal por evento de minado/tala/cosecha.
5. Auditoría de hardcodeos en `regeneration/` relacionada al nuevo flujo.

## No incluye (por ahora)
- Rework completo de `mining/` fuera de la integración necesaria de XP.
- UI avanzada adicional (menús, forms, etc.).
- Cambios de diseño en otros sistemas no conectados a este flujo.

---

## 4) Principios de diseño

1. **Fuente única de verdad de stats**: scoreboards `*TotalH` de `lecture`.
2. **Determinismo**: misma entrada => mismo resultado (sin ambigüedad de orden).
3. **Compatibilidad por fases**: no romper producción de golpe.
4. **Sin duplicación de estado**: dynamic properties solo para regeneración pendiente; no guardar copias redundantes de stats.
5. **Bajo acoplamiento**:
   - `regeneration` calcula drops/xp.
   - `lecture` calcula stats.
   - `titlesPriority` muestra actionbar temporal.

---

## 5) Nuevo contrato de modifiers (propuesto)

El `modifiers` de cada bloque pasa de objeto por `match lore` a lista de reglas por score/condiciones.

Regla clave del contrato: los casos por scoreboard son **independientes** y explícitos.
- No existe un rango "global" implícito por objective.
- Si `FortMinTotalH` tiene casos `10..99` y `100..200`, cada uno se declara como regla separada.
- Un caso no obliga comportamiento escalativo de otro; cada caso puede tener drops/efectos distintos.

```js
modifiers: [
  {
    id: "FortunaMinera_A",            // único por bloque
    priority: 20,                      // desempate determinista
    mode: "override",                 // "override" | "add"

    when: {
      all: [                           // AND
        {
          score: {
            objective: "FortMinTotalH",
            range: { min: 10, max: 99 }
          }
        },
        {
          area: { id: "A" }
        }
      ]
    },

    effects: {
      drops: [
        [1, "minecraft:coal", 1, 2, 65, "§jCarbón", ["§7Fortuna Minera"]]
      ],
      scoreboardAddsOnBreak: {
        DINERO: 2
      },
      xp: {
        skill: "mining",             // mining | foraging | farming
        base: 8,                       // base XP del evento
        scalingObjective: "ExpMinTotalH"
      },
      title: {
        enabled: true,
        source: "regen_xp",
        id: "mining_xp_a",
        priority: 40,
        durationTicks: 40,
        content: ["+${xpGain}"]
      }
    }
  },
  {
    id: "FortunaMinera_B",
    priority: 21,
    mode: "override",
    when: {
      all: [
        {
          score: {
            objective: "FortMinTotalH",
            range: { min: 100, max: 200 }
          }
        }
      ]
    },
    effects: {
      drops: [
        [1, "minecraft:coal", 2, 3, 80, "§jCarbón", ["§7Fortuna Minera B"]]
      ]
    }
  }
]
```

### 5.1 Reglas de evaluación
- `modifiers` se evalúa en orden de prioridad descendente.
- Si empate, gana el primero definido en config.
- `when`:
  - `all`: AND
  - `any`: OR
  - `not`: NOT
- Límite de anidación: máximo 3 niveles.

### 5.2 Tipos de condición (MVP)
- `score`: objective + `range` (`min/max` inclusivo) o comparador (`>=`, `<=`, etc.).
- `area`: por `id` de área ya definida o por AABB inline.
- `skill`: coincide con `blockDef.skill`.

---

## 6) Fórmula de experiencia (sin floats)

Requerimiento explícito: nunca usar floats en output.

## Definición propuesta
- `baseXp`: valor base configurable por bloque/regla.
- `stat`: valor del objective de experiencia de skill (ej: `ExpMinTotalH`).
- `multiplier = max(1, floor(stat / 10))`
- `xpGain = baseXp * multiplier`

$$
multiplier = \max(1, \lfloor stat / 10 \rfloor), \quad xpGain = baseXp \cdot multiplier
$$

### Ejemplo solicitado
- `baseXp = 8`
- `stat = 100`
- `multiplier = 10`
- `xpGain = 80`

### Nota
Si luego se decide otro escalado, cambiará solo la función `resolveXpGain(...)` sin romper contrato externo.

### Alcance explícito de progress (`xpCurrent/xpNext`)
- La visualización de progreso `(${xpCurrent}/${xpNext})` **no corresponde a regeneration** en este rework.
- `regeneration` solo calcula y emite `xpGain` del evento.
- `xpCurrent/xpNext` se resolverá posteriormente desde el sistema de skills (o desde un objeto de configuración dedicado), en una fase aparte.

---

## 7) Integración con titles temporales

Cuando una regla tenga `effects.title.enabled === true`, `regeneration` puede emitir un title temporal para el jugador usando `upsertTemporaryTitle`.

Payload sugerido:
```js
upsertTemporaryTitle({
  source: "regen_xp",
  id: `xp_${skill}`,
  target: player,
  priority: 40,
  durationTicks: 40,
  content: ["+${xpGain}"]
});
```

Si más adelante se requiere mostrar progreso (`xpCurrent/xpNext`), ese dato vendrá de la capa de skills y no del pipeline base de regeneration.

## Regla de acoplamiento
- `regeneration` **no** hace `titleraw` directo.
- Solo usa API de `titlesPriority`.

---

## 8) Plan de implementación por fases

## Fase 0 — Preparación
1. Documentar contrato nuevo (`modifiers[]`, `when`, `effects`).
2. Definir tabla de objectives por skill:
   - mining: `FortMinTotalH`, `ExpMinTotalH`
   - foraging: `FortTalTotalH`, `ExpTalTotalH`
   - farming: `FortCosTotalH`, `ExpCosTotalH`

## Fase 1 — Motor de resolución nuevo
1. Crear resolver de condiciones por scoreboard/área.
2. Crear selector de modifier por prioridad usando `when`.
3. Mantener fallback legacy opcional (feature flag) para no romper runtime.

## Fase 2 — XP skill-aware
1. Implementar `resolveXpGain(baseXp, stat)` con fórmula entera.
2. Integrar ganancia en `scoreboardAddsOnBreak` o canal dedicado de XP.
3. Exponer datos mínimos para title (`xpGain`).
4. Dejar preparado el hook para progreso (`xpCurrent/xpNext`) en fase posterior fuera de este rework.

## Fase 3 — Titles temporales
1. Integrar `upsertTemporaryTitle` desde `regeneration`.
2. Plantillas de contenido para mining/foraging/farming.
3. Validar convivencia de prioridad con otros titles.

## Fase 4 — Limpieza y deprecación
1. Marcar `modifiers` por lore como deprecated.
2. Eliminar paths legacy al finalizar ventana de compatibilidad.
3. Actualizar `README.md` de regeneration y ejemplos de config.

---

## 9) Auditoría técnica (hardcodeos a revisar)

Checklist mínimo en `regeneration/`:
1. Literales repetidos de objectives (`"DINERO"`, `"CARBON"`, etc.) -> mover a config.
2. Dependencias implícitas de `silk_touch_1` en runtime -> eliminar y usar condición declarativa.
3. Lógica de parsing lore (`getLore`) -> aislar en modo legacy temporal.
4. Mensajes debug rígidos -> centralizar helper o flags.
5. Límites de persistencia (`maxEntries`, `maxStringLength`) -> mantener configurables y documentados.

---

## 10) Dynamic properties (restricción operativa)

Se mantiene política conservadora:
- Usar dynamic properties **solo** para pendientes de regeneración.
- No guardar estado derivado que ya existe en scoreboards.
- No duplicar entradas por key de bloque (`dimension:x:y:z`).
- Garantizar limpieza de entradas huérfanas al cargar mundo.

---

## 11) Criterios de aceptación (DoD)

1. `regeneration` puede operar sin leer lore para resolver modifiers.
2. Un bloque con reglas por rango de score aplica drops correctos de forma determinista.
3. XP por skill se calcula con fórmula entera y coincide con casos de prueba.
4. Title temporal se emite vía `titlesPriority` sin comandos directos de actionbar, usando `xpGain` como payload mínimo.
5. No hay duplicación de registros en persistencia.
6. Config inválida se degrada con `skip` seguro (sin crash del servidor).

---

## 12) Casos de prueba mínimos

1. **Fortuna minera por rango**
   - `FortMinTotalH = 5` => regla A
   - `FortMinTotalH = 50` => regla B
   - `FortMinTotalH = 200` => regla C
2. **Conjunción de condiciones**
   - score válido + fuera de área => no aplica
3. **XP sin floats**
   - `base=8`, `ExpMinTotalH=100` => `xpGain=80`
4. **Title temporal**
   - se ve en actionbar con prioridad definida y expira en tiempo esperado
5. **Persistencia**
   - reinicio con pendientes: restaura/limpia sin duplicar

---

## 13) Riesgos y mitigaciones

- Riesgo: reglas demasiado complejas => costo por evento.
  - Mitigación: límite de anidación (3), validación de config y corto circuito.

- Riesgo: objectives faltantes.
  - Mitigación: resolver score con `null => condición false`, log debug opcional.

- Riesgo: ruptura de contenido legacy.
  - Mitigación: flag de compatibilidad temporal y migración por fases.

---

## 14) Tareas inmediatas (siguiente paso de implementación)

1. Diseñar `types`/shape final de `modifiers[]` en `config.js`.
2. Implementar `conditionResolver` desacoplado.
3. Reemplazar llamada a `selectActiveModifier(...lore...)` por selector scoreboard-driven.
4. Integrar módulo de XP + payload para title temporal.
5. Actualizar `README.md` de regeneration con contrato final.

---

## 15) Decisión de compatibilidad

Para reducir riesgo en producción, usar una bandera temporal:

```js
compat: {
  legacyLoreModifiers: true
}
```

- `true`: si no hay reglas nuevas, permite fallback de lore.
- `false`: fuerza solo contrato nuevo por scoreboard.

Objetivo final: dejarla en `false` y retirar código legacy.
