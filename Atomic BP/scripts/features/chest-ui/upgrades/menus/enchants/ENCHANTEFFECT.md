# Enchantments — Tareas & Progreso (Sprint Actual)

> **Referencia principal**: [`ENCHANTMENTS.md`](../ENCHANTMENTS.md) — secciones 6.1 (Reglas de Escritura), 7.3 (Efectos Tipo A) y 10 (Desencantamiento).  
> **Última actualización**: Febrero 2026

---

## Contexto

Se completó la primera iteración del sistema de encantamientos vía UI:

- El flujo `enchantsSelectionMenu → enchantsApplicationMenu` funciona.
- La aplicación de encantamiento (insertar token `§9Nombre Romano` en lore, consumir libro, conversión glint) **funciona**.
- El desencantamiento con doble clic de confirmación funciona.
- Los efectos **Tipo A** (modificación de stats en lore) están implementados y validados.

### Notas de admin (Feb 2026)

- **Bypass de requerimientos por tag `SXB`**: cualquier jugador con la tag `SXB` puede encantar sin scoreboards ni libros (y no consume items). Esta tag debe ser administrada por un admin.
- **Fortuna por código del item**: “Fortuna” aplica la stat correcta (Minera/Tala/Cosecha) derivando la categoría desde el dígito #1 del código `§d§d§d§d§d` al final del lore.

---

## 1. ~~Bug: Lore Desordenado al Encantar~~ — ✅ RESUELTO

### 1.1 Descripción del Problema

Al aplicar un encantamiento, el orden de las secciones del lore se corrompe. Líneas de estadísticas se desplazan debajo del bloque de encantamientos y aparecen códigos de color `§9` infiltrados en líneas que no les corresponden (ej: la descripción).

### 1.2 Reproducción

**Lore original** (antes de encantar):

```
§r§7Poder: §c+5

§r§7Daño: §c+40 §c[+20] §6[+8]
§r§7Daño Crítico: §9+20 §9(+10)

§o§8Sin duda esta coraza fue hecha por los más
§r§8grandes herreros antes que eso pasara...

§r§t§lRARO§2§3§1§1§0
```

**Resultado actual (con bug)** — al aplicar "Filo III":

```
§r§7Poder: §c+5

§r§7Daño: §c+40 §c[+20] §6[+8]

§9Filo III
§r§7Daño Crítico: §9+20 §9(+10)     ← DESPLAZADA debajo del encantamiento

§r§9§o§8Sin duda esta coraza fue hecha...  ← CÓDIGO §r§9 infiltrado
§r§8grandes herreros antes que eso pasara...

§r§t§lRARO§2§3§1§1§0
```

**Resultado esperado** (correcto):

```
§r§7Poder: §c+5

§r§7Daño: §c+40 §c[+20] §6[+8]
§r§7Daño Crítico: §9+20 §9(+10)

§r§9Filo III

§o§8Sin duda esta coraza fue hecha por los más
§r§8grandes herreros antes que eso pasara...

§r§t§lRARO§2§3§1§1§0
```

### 1.3 Causa Raíz

El problema está en `findLastStatisticIndex()` de `loreReaders.js` (línea ~355). La función detecta stats buscando prefijos normalizados como `"dano:"`, `"poder:"`, etc., pero **no reconoce** `"Daño Crítico"` porque el texto normalizado es `"dano critico:"` y la heurística solo busca `startsWith("dano:")`. Esto hace que `lastStatisticIndex` apunte a la línea de `Daño` y no a `Daño Crítico`, y el encantamiento se inserta entre ambas.

Adicionalmente, la línea de encantamiento se escribe como `§9Filo III` (sin prefijo `§r`), lo que causa que el color `§9` se "infiltre" en líneas siguientes.

Código actual problemático:

```javascript
// loreReaders.js — findLastStatisticIndex()
if (
    normalized.startsWith("dano:") ||
    normalized.startsWith("daño:") ||    // ← No cubre "dano critico:"
    normalized.startsWith("vida:") ||
    normalized.startsWith("poder:") ||
    normalized.startsWith("defensa:")
) {
    last = i;
}
```

### 1.4 Solución Aplicada

1. **`findLastStatisticIndex()`** reescrita con heurística robusta `isStatisticLine()`:
   - Ahora detecta stats verificando que la línea contenga `§7` + `:` (convención de color de stats).
   - Reemplazó los 5 checks hardcodeados (`"dano:"`, `"vida:"`, etc.) por un patrón genérico.
   - Cubre las 16+ stats del pack sin necesidad de enumerarlas.
   - Edge case fix: cuando no hay encantamientos ni rarity, ya no retorna -1 erróneamente (usaba `??` que no cubre `-1`).

2. **`formatEnchantLine()`** en `loreWriters.js`:
   - Las líneas de encantamiento ahora se escriben como `§r§9Nombre Romano` (con `§r` al inicio).
   - Ref: ENCHANTMENTS.md § 6.1.1.

3. **`ensureSingleBlankLineAround()`** fix de index shift:
   - Al insertar una línea en blanco antes, el índice se ajusta correctamente (+1) para las operaciones posteriores.

4. **Limpieza de código muerto**:
   - Removidas llamadas duplicadas a `normalizeLoreSpacing` en `enchantsApplicationMenu.js`.
   - Removida llamada muerta `void analyzeLoreStructure()` en `removeEnchantmentFromLore`.

---

## 2. ~~Efectos Tipo A — Modificación de Stats en Lore~~ — ✅ IMPLEMENTADO

> Ref: ENCHANTMENTS.md § 7.3.1 (Tabla de fórmulas), § 6.1.4 (Segmentos S1/S3).

### 2.1 Objetivo

Los encantamientos de **Tipo A** son aquellos cuyo efecto es determinista y se refleja modificando valores numéricos en el lore del item. Son los únicos que se implementan en esta fase.

Los Tipo B (necesitan sistema de daño/multiplicadores) y Tipo C (necesitan sistema propio + integración) **no se tocan en esta fase**: la UI los muestra informativamente pero no modifican el lore de stats.

### 2.2 Convención de Segmentos

> Ref: ENCHANTMENTS.md § 6.1.4.

Las estadísticas del lore tienen un **Total** y segmentos aditivos que explican de dónde viene cada bonus:

| Segmento | Uso | Formato | Ejemplo |
|----------|-----|---------|---------|
| **Total** | Valor principal visible | `§c+N` (tras el `:`) | `§r§7Daño: §c+55` |
| **S1** | Aditivos de críticos | `§9(+N)` | `§r§7Daño Crítico: §9+60 §9(+40)` |
| **S3** | Aditivos de daño por encantamiento | `§9(+N)` al final de la línea | `§r§7Daño: §c+55 §c[+20] §6[+8] §9(+15)` |

La función `parseDamageSumatoriesFromLore()` en `loreReaders.js` ya lee S1/S2/S3 desde corchetes y paréntesis. Los **corchetes** `[+N]` son segmentos de otras fuentes (ej: runas/mejoras); los **paréntesis** `(+N)` son de encantamientos.

### 2.3 Reglas de Aplicación y Remoción

**Al encantar (Tipo A)**:
1. Insertar/actualizar el token de encantamiento en el bloque `§9`.
2. Sumar el **delta** del encantamiento al **Total** de la estadística correspondiente.
3. Sumar/crear el delta en el segmento (S1 o S3 según aplique).

**Al desencantar**:
1. Remover el token de encantamiento del bloque `§9`.
2. Restar el delta del **Total** correspondiente.
3. Restar el delta del segmento. Si queda < 0 → clamp a 0 y ocultar el paréntesis.

**Casos ilegales**: si el segmento tiene un valor menor al delta esperado (ej: `(+1)` pero el encantamiento debería dar `+15`), se reduce a 0 sin validación adicional. No se hace chequeo constante por rendimiento; sería imposible alcanzar ese estado en juego normal.

**Nunca mostrar valores negativos** en el lore.

### 2.4 Ejemplo Completo: Filo V (+15 Daño)

```
ANTES:
§r§7Poder: §c+5
                              ← línea vacía (separador de secciones)
§r§7Daño: §c+40 §c[+20] §6[+8]
§r§7Daño Crítico: §9+20 §9(+10)

§o§8Sin duda esta coraza fue hecha por los más
§r§8grandes herreros antes que eso pasara...

§r§t§lRARO§2§3§1§1§0
```

```
DESPUÉS (Filo V aplicado):
§r§7Poder: §c+5

§r§7Daño: §c+55 §c[+20] §6[+8] §9(+15)    ← Total +15, S3 creado con §9(+15)
§r§7Daño Crítico: §9+20 §9(+10)

§r§9Filo V                                   ← Token insertado (con §r)

§o§8Sin duda esta coraza fue hecha por los más
§r§8grandes herreros antes que eso pasara...

§r§t§lRARO§2§3§1§1§0
```

### 2.5 Ejemplo: Desencantar Filo V

```
ANTES (con Filo V):
§r§7Daño: §c+55 §c[+20] §6[+8] §9(+15)

§r§9Filo V
```

```
DESPUÉS (Filo V removido):
§r§7Daño: §c+40 §c[+20] §6[+8]             ← Total -15, S3 removido

                                              ← Línea de encantamiento eliminada
```

Nota: si S3 fuera `(+8)` en vez de `(+15)` (caso ilegal), igualmente se reduce a 0 y se remueve el encantamiento.

### 2.6 Catálogo Completo de los 37 Encantamientos

La siguiente tabla recoge **todos** los encantamientos del pack con su tipo de implementación y efecto. Los marcados como **Tipo A** ya modifican stats del lore.

### Implementación Tipo A — Resumen Técnico

Las siguientes funciones/archivos implementan el sistema Tipo A:

| Archivo | Función / Export | Rol |
|---------|-----------------|-----|
| `loreReaders.js` | `isStatisticLine(line)` | Detecta si una línea es de estadística (§7 + `:`) |
| `loreReaders.js` | `findStatLineIndex(lines, statName)` | Busca la línea de una stat por nombre normalizado |
| `loreReaders.js` | `parseStatLine(line)` | Extrae `{total, brackets, paren}` de una línea de stat |
| `loreWriters.js` | `rebuildStatLine(line, newTotal, newParen, color)` | Reconstruye la línea con nuevos valores |
| `loreWriters.js` | `applyTypeAStatDelta(lines, effect, prevDelta)` | Aplica delta al Total y al segmento paren |
| `loreWriters.js` | `revertTypeAStatDelta(lines, effect)` | Revierte delta del Total y segmento paren |
| `enchantsConfig.js` | `typeAEffects` (registry) | Mapea nombre de encantamiento → `[{stat, deltaPerLevel, segmentColor?}]` |
| `enchantsApplicationMenu.js` | `resolveTypeAEffects(name, level)` | Resuelve efectos Tipo A para un encantamiento |
| `enchantsHelpers.js` | `computeExtraPlaceholders(name, level)` | Genera placeholders `<damage>`, `<percentage>` desde `typeAEffects` |

**Reglas clave implementadas**:
- **Deltas negativos** (ej: Verosimilitud -35): solo modifican el Total, nunca crean/modifican el segmento paren.
- **Upgrades** (Filo I → Filo V): el `previousDelta` se resta del `netDelta` para evitar acumulación doble.
- **Safety logging**: si la stat no se encuentra en el lore, se emite `console.warn` y la operación continúa sin bloquear.
- **Clamp a 0**: ningún valor visible (Total o paren) será negativo.

**Enchantments con Type A implementado**:

| Encantamiento | Stat(s) | Delta/Nivel |
|---------------|---------|-------------|
| Filo | Daño | +3 |
| Crítico | Daño Crítico, Probabilidad Crítica | +5, +2 |
| Verosimilitud | Daño | -35 |
| Poder | Daño | +15 |
| Tormenta | Daño | +24 |
| Fortuna | Fortuna Minera | +50 |
| Convicción | Fortuna Minera, Fortuna de Tala, Fortuna de Cosecha | +5 cada |
| Cultivador | Fortuna de Cosecha | +20 |

**Tipo A\* pendientes** (requieren lectura de stats para delta variable):
- **Sobrecarga** (id 19): Por cada umbral de Daño Crítico, +5 Daño.
- **Obliteración** (id 21): Por Prob. Crítica > 100%, +DC variable.
- **Linaje** (id 35): Convierte Defensa existente en Fortuna Minera.

#### Espada (`sword`)

| ID | Nombre | Niv. Máx | Tipo | Efecto | Delta por Nivel |
|----|--------|----------|------|--------|-----------------|
| 1 | Filo | VII | **A** | +Daño → S3 | +3 |
| 2 | Primer Golpe | IV | B | Multiplicador primer golpe | — |
| 3 | Crítico | VIII | **A** | +Daño Crítico → S1 y +Prob. Crítica → S1 | +5 DC, +2 PC |
| 4 | Aspecto Ígneo | III | C | Quemaduras 5s/10s/15s al golpear | — |
| 5 | Castigo | V | B | ×0.1 multiplicador a no-muertos/nivel | — |
| 6 | Perdición de los Artrópodos | VIII | B | ×0.1 multiplicador a artrópodos/nivel | — |
| 7 | Discordancia | III | B | ×0.05 multiplicador a no-muertos/nivel | — |
| 8 | Corte Veloz | II | C | 5%/nivel de infligir 50% del daño extra | — |
| 9 | Oxidación | III | C | 60% veneno I/II/III, reduce Daño -1/-2/-3 | — |
| 10 | Asesino del Fin | VII | B | ×0.1 multiplicador a criaturas del End | — |
| 11 | Saqueo | V | C | +3% drops de mobs por nivel | — |
| 12 | Lux | III | B | ×0.1 multiplicador de día/nivel | — |
| 13 | Nux | III | B | ×0.1 multiplicador de noche/nivel | — |
| 14 | Verosimilitud | I | **A** | ×0.5 mult. pero **-35 Daño** → S3 (resta) | -35 |

#### Arco (`bow`)

| ID | Nombre | Niv. Máx | Tipo | Efecto | Delta por Nivel |
|----|--------|----------|------|--------|-----------------|
| 15 | Poder | X | **A** | +Daño → S3 | +15 |
| 16 | Llama | II | C | Quemaduras con flechas | — |
| 17 | Golpe | III | C | Retroceso al impactar | — |
| 18 | Salvación | IV | C | Curación propia | — |
| 19 | Sobrecarga | V | **A\*** | Por cada umbral de DC, +5 Daño → S3 | Tabla de umbrales |
| 20 | Caprificación | I | C | 50% convertir a cabra (5 min CD) | — |
| 21 | Obliteración | V | **A\*** | Por PC > 100%, +2/4/6/8/10 DC → S1 | Variable |
| 22 | Terminación | I | C | +1 flecha extra | — |
| 23 | Artigeno | III | C | 4%/nivel de infligir veneno I | — |
| 24 | Magmatismo | IV | B | Ignora 5% Defensa/nivel | — |
| 25 | Tormenta | III | **A** | +Daño → S3 | +24 |

#### Armadura (`armor` / `helmet` / `boots`)

| ID | Nombre | Niv. Máx | Tipo | Compatible | Efecto |
|----|--------|----------|------|------------|--------|
| 26 | Protección | VI | B | armor, helmet, boots | Reducción % daño recibido |
| 27 | Rejuvenecimiento | V | C | armor, helmet, boots | Regeneración pasiva |
| 28 | Afinidad acuática | I | C | helmet | Mejora minería acuática |
| 29 | Respiración | III | C | helmet | Respiración extendida |
| 30 | Caída de pluma | XII | C | boots | Reducción daño de caída |
| 31 | Lijereza | II | C | boots | Velocidad de movimiento |

#### Herramientas (`pickaxe` / `axe` / `hoe`)

| ID | Nombre | Niv. Máx | Tipo | Compatible | Efecto | Delta por Nivel |
|----|--------|----------|------|------------|--------|-----------------|
| 32 | Eficiencia | V | **Especial** | pickaxe, axe, hoe | Encantamiento vanilla real | — |
| 33 | Fortuna | V | **A** | pickaxe, axe, hoe | +Fortuna minera | +50 |
| 34 | Prisa espontánea | III | C | pickaxe, axe | 0.1% acumulable de prisa II | — |
| 35 | Linaje | II | **A\*** | pickaxe | Convierte Defensa → Fortuna minera | 20/10 Def = +5 FM |
| 36 | Convicción | XII | **A** | pickaxe, axe, hoe | +Todas las fortunas | +5 |
| 37 | Cultivador | X | **A** | hoe | +Fortuna de cultivos | +20 |

> **A\***: Tipo A con matices — requiere lectura de stats o scoreboards existentes para calcular el delta, pero el resultado final sí es una escritura numérica en lore.
>
> **Especial**: Eficiencia es el único encantamiento que se aplica como encantamiento vanilla real al item (usando el componente `Enchantable`), además de la línea cosmética.

---

## 3. Mejoras a `enchantsConfig.js` — Parcialmente Pendiente

### 3.1 Estado Actual

Los encantamientos de id 1 (`Filo`) y id 2 (`Primer Golpe`) tienen descripciones detalladas con colores y niveles de rareza diferenciados por tramos. Los ids 3–37 usan la función genérica `baseMainDescription()` con texto placeholder genérico y la mayoría tiene `rarity: "common"` para todos los niveles.

### 3.2 Progreso

- ✅ **Placeholder `<damage>`**: `computeExtraPlaceholders()` en `enchantsHelpers.js` ahora lee del registro `typeAEffects` en `enchantsConfig.js` para calcular el delta por nivel. Los botones de cada nivel muestran el valor real (ej: `+15 Daño` para Filo V).
- ✅ **Placeholder `<percentage>`**: Protección usa 4% por nivel, hardcoded en `computeExtraPlaceholders()`.

### 3.3 Tareas Restantes

1. **Descripciones narrativas** (`mainDescription`): mejorar al menos los Tipo A con texto descriptivo y temático, similar a id 1 (Filo).
2. **Rangos de rareza** por nivel (`levelsMenu`): definir colores/rarezas escalonados por tramos — usar la progresión del pack (common → rare → epic → legendary → mythic) según el nivel del encantamiento.
3. ~~**Placeholder `<damage>`**: conectar el cálculo del delta numérico del encantamiento para que los botones de cada nivel muestren el valor real (ej: `+15 Daño` para Filo V).~~ → ✅ Implementado.
4. **Eficiencia (id 32)**: este es el único encantamiento "real" (vanilla). Necesita una rama especial en `executeEnchantmentTransaction()` para aplicar el encantamiento real al item via el componente `Enchantable`, además de la línea de lore cosmética.

### 3.3 Estructura Recomendada de `levelsMenu`

Basándose en la configuración exitosa de id 1 (Filo), los encantamientos deberían tener tramos de rareza diferenciados:

```javascript
// Ejemplo: Tormenta (id 25), +24 Daño por nivel, 3 niveles
{
    id: 25,
    name: "Tormenta",
    colorName: "§r§a",
    mainDescription: [
        "",
        "§8Un rayo atraviesa la flecha",
        "§8otorgándole un poder devastador",
        "§8que electrifica a los enemigos.",
        "",
        "§r§8Compatible: Arcos",
        "",
        "§r§eClic para ver niveles",
    ],
    maxLevel: 3,
    compatible: ["bow"],
    levelsMenu: [
        {
            level: [1],
            color: "§t",           // color de este tramo
            rarity: "rare",        // rareza del tramo
            levelDescription: [
                "",
                "§r§8Aumenta el daño del arco",
                "§r§8en §t+<damage>§8 puntos.",
                "",
                "§r<rarity>",      // se resuelve a "§t§lRARO" o similar
                "",
                "<action>",        // se resuelve a "Disponible" / "No cumples..." / etc.
            ],
            requirement: {
                items: [{ name: "§r§eTormenta I", quantity: 1 }],
            },
        },
        {
            level: [2, 3],
            color: "§5",
            rarity: "epic",
            levelDescription: [
                "",
                "§r§8Aumenta el daño del arco",
                "§r§8en §5+<damage>§8 puntos.",
                "",
                "§r<rarity>",
                "",
                "<action>",
            ],
            requirement: {
                items: [{ name: "§r§eTormenta <roman>", quantity: 1 }],
            },
        },
    ],
}
```

---

## 4. Custom Emojis en UI y Lore

### 4.1 Contexto

El pack usa emojis personalizados (glyph sheets E4) que ya funcionan en el chat y nombres de items. Los scripts de generación y validación están en `tools/custom-emojis/`.

### 4.2 Tarea

Incluir soporte para referenciar emojis personalizados dentro de:
- `mainDescription` y `levelDescription` de los encantamientos.
- Líneas de stats cuando se modifiquen por Tipo A (ej: el emoji de espada `🗡` que ya aparece junto al daño).
- Nombres de items en el mirror del menú.

Se necesita:
1. Determinar qué emojis están disponibles actualmente (revisar glyph sheets / output del generador).
2. Documentar convención de uso (ej: `🗡` para daño, `☠` para poder, etc.) para mantener consistencia.

---

## 5. Resumen de Prioridades

| # | Tarea | Estado | Archivos Afectados |
|---|-------|--------|--------------------|
| 1 | ~~Corregir bug de lore desordenado~~ | ✅ Resuelto | `loreReaders.js`, `loreWriters.js` |
| 2 | ~~Implementar escritura de stats Tipo A~~ | ✅ Implementado | `loreReaders.js`, `loreWriters.js`, `enchantsConfig.js`, `enchantsApplicationMenu.js`, `enchantsHelpers.js` |
| 2b | Implementar Tipo A* (Sobrecarga, Obliteración, Linaje) | Pendiente | `enchantsConfig.js`, `loreWriters.js` |
| 3 | Mejorar descripciones en `enchantsConfig.js` | Pendiente (Medio) | `enchantsConfig.js` |
| 4 | Custom emojis en UI/lore | Pendiente (Bajo) | `enchantsConfig.js`, helpers |
| 5 | Eficiencia — encantamiento vanilla real | Pendiente (Medio) | `enchantsApplicationMenu.js` |

> Los bloqueantes (1 y 2) están resueltos. Las tareas restantes son mejoras de calidad y funcionalidad adicional.

"§r§8Poder de Tala 5\n\n

§r§8§7Daño: §c+15\n§r§6§7Frenesí de Tala: §e+1\n§r§e§7Experiencia de Talado: §3+10\n\n§r§9Convicción X, Eficiencia V\n\n§r§9§o§8Un hacha de este tamaño deberia ser mejor\n§r§8un pedazo de piedra gigante y no un hacha.\n\n§r§d§lMÍTICO§6§1§1§1§0"

