# Sistema de Minerales Regenerables (Bedrock Script API)

Documento de diseño para implementar con JavaScript + GitHub Copilot en un Behavior Pack (BP) usando Script API.  
El sistema es **event-driven** con `world.beforeEvents.playerBreakBlock` (cancelable) y regeneración con `system.runTimeout`, evitando loops por tick para mejorar rendimiento. [web:449][web:447][web:25]

**Ruta del feature (tu arquitectura):**  
`Atomic BP/scripts/features/mining/regeneration/` (aquí vive este README).  

---

## Objetivo

Implementar minerales “regenerables” dentro de áreas configurables:

- Cuando un jugador en **Survival/Adventure** pica un mineral objetivo, **no se rompe realmente**: se cancela el break y el bloque se reemplaza por un bloque “mined state” (bloque temporal). [web:447]
- Se entrega un drop **custom** con tabla de probabilidades y **modifiers** basados en “encantamientos falsos” leídos desde el lore del pico. [web:271]
- Tras X segundos (ej. 60s) el mineral vuelve a su estado original usando `system.runTimeout`. [web:25][web:37]
- Si un jugador está en **Creative**, se aplica bypass: el bloque se rompe normal (sin sistema). (Cómo obtener gamemode dependerá de la API disponible en tu versión). [web:449]

---

## Principios clave

### 1) Control total de drops (sin loot vanilla)
Se usa `PlayerBreakBlockBeforeEvent.cancel = true` para bloquear el rompimiento “real” y por lo tanto evitar drops vanilla, permitiendo controlar 100% el drop. [web:447]

### 2) Rendimiento (TPS)
- La lógica se ejecuta **solo cuando ocurre un intento de minado** (evento), no por tick. [web:449]
- Para regeneración se usa un timer por bloque (`system.runTimeout`) en lugar de escaneo constante. [web:25][web:37]
- Se recomienda evitar comandos grandes en runtime por rendimiento (sobre todo `/fill`, `/clone`, etc.). [web:408]

### 3) Encantamientos falsos (desde lore)
El pico no usa enchant real: se lee `itemStack.getLore()` y se busca texto como `Fortuna I/II/III`, `Fortune I/II/III` y `Silk Touch I`. [web:271]

---

## Estructura del feature (propuesta)

Dentro de `Atomic BP/scripts/features/mining/regeneration/`:

regeneration/
README.md
index.js # initMiningRegen(config): subscribes y loop de regeneración/timers
config.js # áreas + minerales + modifiers (solo datos)
area.js # isInArea, isInAnyArea
registry.js # registro dinámico de minerales (Map) + builder opcional
drops.js # rollDrop, spawnDropItem, utilidades de ItemStack (name/lore)
modifiers.js # parseFakeEnchantments(toolLore), resolver modifier activo
persistence.js # pending regenerations con world dynamic properties

text

`main.js` (entry) solo importa el init del feature, con rutas relativas:

import { initMiningRegen } from "./features/mining/regeneration/index.js";
import { miningRegenConfig } from "./features/mining/regeneration/config.js";

initMiningRegen(miningRegenConfig);

text

---

## Flujo de ejecución (evento de minado)

1) `world.beforeEvents.playerBreakBlock.subscribe((ev) => {...})` [web:449]  
2) Validaciones:
- `isInAnyArea(ev.dimension, ev.block.location)`
- `block.typeId` existe en el registro de minerales (Map)
- `player` NO está en Creative (bypass)
3) `ev.cancel = true` para cancelar rompimiento vanilla. [web:447]  
4) Cambiar bloque a `minedBlockId` (bloque temporal).  
5) Resolver modifier por lore del pico (Fortune/Silk Touch “fake”).  
6) Calcular drops y dropearlos **en el suelo** con `dimension.spawnItem(ItemStack, location)`. [web:431][web:271]  
7) Registrar la regeneración pendiente (memoria + persistencia) y agendar `system.runTimeout` a `regenTicks`. [web:25][web:37]  

---

## Configuración dinámica

### 1) Áreas (AABB, dinámicas)
Ejemplo:

export const areas = [
{
dimensionId: "minecraft:overworld",
min: { x: 0, y: 0, z: 0 },
max: { x: 100, y: 100, z: 100 }
}
];

text

Regla: “aplica si `min <= pos <= max`”.

### 2) Minerales (dinámico, agregable/quitable)
Registro basado en Map:

- Key: `oreBlockId` (ej. `"minecraft:coal_ore"`)
- Value: `OreDefinition`

Se puede exponer:
- **Opción A (simple):** `config.js` exporta un array de definiciones.
- **Opción B (builder):** `mineralsInit(reg => reg.define(...).drops(...))` para DX.

Ejemplo conceptual estilo builder (no es sintaxis final):

mineralsInit((reg) => {
reg
.define("coal")
.ore("minecraft:coal_ore")
.regenSeconds(60)
.minedBlock("minecraft:black_concrete") // mined state configurable
.drops([
[1, "minecraft:coal", 1, 2, 50, "§jCarbón", ["§fLore ejemplo"]],
[2, "minecraft:iron_block", 1, 1, 25, "Hierro", ["Otro lore"]]
])
.modifiers({ /* ver sección modifiers */ });
});

text

---

## mined state (bloque temporal)

Requisito:
- `mined state` es siempre **un bloque** y nunca un item.
- Debe ser dinámico (configurable): por default `minecraft:black_concrete`, pero puede cambiarse a futuro (global o por mineral).

---

## Drops (tabla base)

Cada mineral tiene un arreglo `drops` con entradas:

`[dropId, itemId, minQty, maxQty, chancePct, nameTag, lore]`

- `dropId`: ID interno (para debug/logs y referencia posterior).
- `itemId`: por ejemplo `"minecraft:coal"`.
- `minQty`, `maxQty`: rango inclusivo.
- `chancePct`: 0..100. Si falla, ese drop no se genera.
- `nameTag`: se asigna a `ItemStack.nameTag`. [web:271]
- `lore`: string o `string[]`; se asigna con `ItemStack.setLore(...)`. [web:271]

### Regla de cantidades (uniforme)
Si el drop “cae” (pasa el chance), la cantidad se elige con distribución uniforme entre `minQty..maxQty`.  
Ejemplo: `min=1, max=2, chance=50%`:
- 50%: nada
- 25%: 1
- 25%: 2

### Drop “en el suelo”
Requisito:
- El drop se debe spawnear como entidad item: `dimension.spawnItem(new ItemStack(itemId, qty), location)`. [web:431][web:271]

---

## Modifiers (Fortune/Silk Touch fake por lore)

### Detección (desde el lore del pico)
- `const lore = ev.itemStack?.getLore() ?? []` [web:447][web:271]
- Buscar (case-insensitive y tolerante a variantes):
  - Fortune: `Fortuna I/II/III`, `Fortune I/II/III`
  - Silk Touch: `Silk Touch I`

### Diseño recomendado de modifiers (por mineral)
Se recomienda que cada mineral pueda definir “tablas alternativas” por modifier, porque:
- pueden agregarse nuevos drops para Fortune III,
- Silk Touch normalmente reemplaza por completo el drop.

Propuesta:

modifiers: {
silk_touch_1: {
match: ["silk touch i", "toque de seda i"],
priority: 100,
mode: "override",
drops: [ /* drops para silk / ]
},
fortune_1: { match: ["fortuna i", "fortune i"], priority: 10, mode: "override", drops: [/.../] },
fortune_2: { match: ["fortuna ii", "fortune ii"], priority: 20, mode: "override", drops: [/.../] },
fortune_3: { match: ["fortuna iii", "fortune iii"], priority: 30, mode: "override", drops: [/...*/] }
}

text

Regla sugerida:
- Elegir el modifier con mayor `priority` que matchee.
- Si en el futuro quieres combinaciones: soportar `mode: "add"` para sumar drops extra.

---

## Reglas de colocación/uso

### Colocación manual en creativo
- Los minerales se colocan a mano en creativo.
- No se “registran” por coordenadas previamente: el sistema detecta por `block.typeId` al romperlo dentro del área.

### Bypass creativo
- Si el jugador está en Creative, el sistema NO cancela ni regenera.
- Esto permite a builders/admins editar la mina sin fricción.

---

## Regeneración: cancelación por cambios externos

Requisito:
- Si durante el cooldown el bloque fue reemplazado por otra cosa, **NO** se restaura el mineral.

Implementación recomendada (alto rendimiento):
- Guardar al minar: `{ oreBlockId, minedBlockId, dimensionId, x,y,z, restoreAt }`.
- Cuando llegue el timer (60s), hacer **solo 1 verificación**:
  - Si el bloque actual sigue siendo `minedBlockId` ⇒ restaurar a `oreBlockId`.
  - Si ya no coincide ⇒ cancelar restore (no hacer nada).

Esto evita “polling” constante y prioriza rendimiento. [web:25][web:37]

---

## Persistencia (si el mundo se cierra)

Requisito:
- Nunca dejar bloques permanentemente en `minedBlockId` tras reinicios.

Solución:
- Guardar pendientes en `world.setDynamicProperty(...)` (persistente) como JSON. [web:130][web:21]
- En `world.afterEvents.worldLoad`:
  - Leer `world.getDynamicProperty(...)` (puede ser undefined al inicio). [web:130][web:21]
  - Procesar pendientes:
    - si el bloque actual es minedBlockId, restaurar o reprogramar según tiempo restante,
    - si fue cambiado por otra cosa, descartar.
  - Guardar lista actualizada (o vaciarla). [web:21][web:130]

Sugerencia para rendimiento al cargar:
- Procesar en batches (ej. 50 por tick) usando `system.runTimeout`/`system.run` si la lista creciera. [web:25]

---

## XP (considerarlo, implementación aparte)
- No se implementa en la primera versión, pero diseñar un hook:
  - `resolveDrops(...)` devuelva también `xpToGive` o un evento `onOreMined(context)`.
- La XP se agregará después como módulo separado.

---

## Funciones pequeñas (Copilot-friendly)

Recomendadas para dividir y que Copilot complete:

- `isInAnyArea(dimensionId, pos)`
- `getOreDefinition(blockTypeId)`
- `getMinedBlockId(oreDef, config)` (global o por mineral)
- `parseFakeEnchantments(toolItemStack)` (lee lore) [web:271]
- `selectActiveModifier(oreDef, enchantState)`
- `resolveDrops(oreDef, modifier)` -> `DropEntry[]`
- `rollDrop(dropEntry)` -> `{ itemId, qty, nameTag, lore } | null`
- `spawnDropItem(dimension, pos, rolledDrop)` (usa `spawnItem`) [web:431]
- `markPendingRegen(...)` (memoria + persistence)
- `scheduleRegen(...)` (usa `system.runTimeout`) [web:25][web:37]
- `tryRestoreBlock(...)` (check final: minedBlockId)  

---

## Referencias de API (para buscar rápido)
- `WorldBeforeEvents.playerBreakBlock` y cancelación (`cancel: boolean`). [web:449][web:447]
- `system.runTimeout` para ejecutar a futuro en ticks. [web:25][web:37]
- `world.setDynamicProperty` / `world.getDynamicProperty` para persistencia. [web:130][web:21]
- `ItemStack.nameTag`, `ItemStack.getLore`, `ItemStack.setLore` para personalizar drops. [web:271]