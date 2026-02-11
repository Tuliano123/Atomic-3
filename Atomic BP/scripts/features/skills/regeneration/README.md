# Sistema de Regeneración de Bloques (Skills) — Bedrock Script API
## Outdated ----------------------------

Guía del sistema de regeneración por bloques (multi-skill) usando Bedrock Script API.

**Ruta del feature (tu arquitectura):**  
`Atomic BP/scripts/features/skills/regeneration/` (aquí vive este README).  

---

## Objetivo

- Interceptar `world.beforeEvents.playerBreakBlock` (cancelable).
- Reemplazar el bloque por un `minedBlockId` temporal.
- Dar drops custom (con modifiers por lore).
- Regenerar el bloque con timer.
- Bypass Creative.

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

## Archivos

Dentro de `Atomic BP/scripts/features/skills/regeneration/`:

index.js — runtime/eventos + timers + persistencia
config.js — datos (áreas + blocks + modifiers)
area.js — AABB helpers
registry.js — normalización + match (exact/prefix/glob/any)
drops.js — spawn de drops
modifiers.js — selección de modifier por lore
persistence.js — dynamic properties (lista de pendientes)

text

`main.js` (entry) solo importa el init del feature, con rutas relativas:

import { initSkillRegeneration } from "./features/skills/regeneration/index.js";
import { skillRegenConfig } from "./features/skills/regeneration/config.js";

initSkillRegeneration(skillRegenConfig);

text

---

## Flujo (alto nivel)

1) `world.beforeEvents.playerBreakBlock.subscribe((ev) => {...})` [web:449]  
2) Validaciones:
- `isInAnyArea(ev.dimension, ev.block.location)`
- `block.typeId` existe en el registro de bloques
- `player` NO está en Creative (bypass)
3) `ev.cancel = true` para cancelar rompimiento vanilla. [web:447]  
4) Cambiar bloque a `minedBlockId` (bloque temporal).  
5) Resolver modifier por lore del pico (Fortune/Silk Touch “fake”).  
6) Calcular drops y dropearlos **en el suelo** con `dimension.spawnItem(ItemStack, location)`. [web:431][web:271]  
7) Registrar la regeneración pendiente (memoria + persistencia) y agendar `system.runTimeout` a `regenTicks`. [web:25][web:37]  

### Comportamiento al reiniciar el mundo

- Si el mundo se cierra con bloques en `minedBlockId`, al volver a entrar el sistema **restaura todos los pendientes inmediatamente** (si el bloque aún está en mined-state).
- Esto evita casos donde un bloque quede “pegado” en mined-state y reduce la acumulación de datos guardados.

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

### 2) Bloques (dinámico, agregable/quitable)
Registro por `blockId` con soporte de match flexible:

- Exacto: `"minecraft:coal_ore"`
- Prefijo: `"minecraft:log*"` (match prefix)
- Glob: `"minecraft:*_log"` (match por patrón)
- Todos: `"*"` (match any)

Cada entrada requiere `skill` para poder contabilizarlo/expandir a futuro (XP real, etc.).

Se puede exponer:
- **Opción A (simple):** `config.js` exporta un array de definiciones.
- **Opción B (builder, opcional):** `blocksInit(reg => reg.define(...).drops(...))` para DX.

Ejemplo conceptual estilo builder (no es sintaxis final):

blocksInit((reg) => {
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
- Debe ser dinámico (configurable): por default `minecraft:black_concrete`, pero puede cambiarse a futuro (global o por bloque).

---

## Drops (tabla base)

Cada bloque tiene un arreglo `drops` con entradas:

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

### Diseño recomendado de modifiers (por bloque)
Se recomienda que cada bloque pueda definir “tablas alternativas” por modifier, porque:
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
- Los bloques se colocan a mano en creativo.
- No se “registran” por coordenadas previamente: el sistema detecta por `block.typeId` al romperlo dentro del área.

### Bypass creativo
- Si el jugador está en Creative, el sistema NO cancela ni regenera.
- Esto permite a builders/admins editar la mina sin fricción.

---

## Regeneración: cancelación por cambios externos

Requisito:
- Si durante el cooldown el bloque fue reemplazado por otra cosa, **NO** se restaura.

Implementación recomendada (alto rendimiento):
- Guardar al minar: `{ blockId, minedBlockId, dimensionId, x,y,z, restoreAt }`.
- Cuando llegue el timer (60s), hacer **solo 1 verificación**:
  - Si el bloque actual sigue siendo `minedBlockId` ⇒ restaurar a `blockId`.
  - Si ya no coincide ⇒ cancelar restore (no hacer nada).

Nota: el sistema persiste `blockId` como el **typeId real** del bloque minado; esto es importante cuando una definición usa `blockId: "minecraft:*"` o prefijos.

Esto evita “polling” constante y prioriza rendimiento. [web:25][web:37]

---

## Persistencia

Se guardan pendientes en `world dynamic properties` como JSON.

En el arranque (primer tick) el sistema carga la lista y **restaura inmediatamente** todos los bloques que sigan en `minedBlockId`, luego guarda la lista ya limpiada.

Sugerencia para rendimiento al cargar:
- Procesar en batches (ej. 50 por tick) usando `system.runTimeout`/`system.run` si la lista creciera. [web:25]

---

## XP (considerarlo, implementación aparte)
- No se implementa en la primera versión, pero diseñar un hook:
  - `resolveDrops(...)` devuelva también `xpToGive` o un evento `onBlockMined(context)`.
- La XP se agregará después como módulo separado.

---

## Funciones pequeñas (Copilot-friendly)

Recomendadas para dividir y que Copilot complete:

- `isInAnyArea(dimensionId, pos)`
- `getBlockDefinition(blockTypeId)`
- `getMinedBlockId(blockDef, config)` (global o por bloque)
- `parseFakeEnchantments(toolItemStack)` (lee lore) [web:271]
- `selectActiveModifier(blockDef, enchantState)`
- `resolveDrops(blockDef, modifier)` -> `DropEntry[]`
- `rollDrop(dropEntry)` -> `{ itemId, qty, nameTag, lore } | null`
- `spawnDropItem(dimension, pos, rolledDrop)` (usa `spawnItem`) [web:431]
- `markPendingRegen(...)` (memoria + persistence)
- `scheduleRegen(...)` (usa `system.runTimeout`) [web:25][web:37]
- `tryRestoreBlock(...)` (check final: minedBlockId)  

---

## Notas
- Los scoreboards se actualizan preferiblemente via API (`world.scoreboard`) y si falla, cae a comandos (best-effort).