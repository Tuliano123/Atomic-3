# Sistema de Cálculo de Daño de Skills (Bedrock Script API)

Feature: `Atomic BP/scripts/features/skills/calc`  
Lenguaje: JavaScript (Script API estable, sin APIs experimentales). [web:21][web:389]

Este documento define el diseño del sistema de **cálculo de daño** basado en lore del ítem y estadísticas de jugador, para ser implementado con Script API y asistido por GitHub Copilot.

---

## Condición global de habilitación

Todas las funcionalidades descritas en este documento **solo se aplican** si el jugador cumple:

- Scoreboard `H` igual a `1`.  
- Equivalente en comandos: `/scoreboard players test <Jugador> H 1..` (debe pasar).  

Si `H` es `0` o no existe para el jugador, **no se ejecuta** ninguna lógica de este sistema para ese jugador.

---

## Objetivo del sistema

- Crear un sistema de **daño completamente dinámico**, basado en:
  - Estadísticas del arma (leídas desde el lore).
  - Estadísticas personales del jugador (scoreboards).  
- Calcular continuamente para cada jugador:
    - Daño final **con crítico** (`DanoFinalCC`).
    - Daño final **sin crítico** (`DanoFinalSC`).  
- Guardar estos valores en scoreboards para que otras mecánicas (skills, bosses, etc.) puedan leerlos fácilmente.  
- Preparar el sistema para una futura UI (titles flotantes, displays de daño) sin usar APIs experimentales.

---

## Arquitectura propuesta

Ruta base del feature:

```text
Atomic BP/
  scripts/
    main.js
    features/
      skills/
        calc/
          README.md          # Este documento
                    config.js          # Config (loopTicks, objectives, debug)
          index.js           # initDamageCalc(); suscribe eventos y calcula daño
          loreParser.js      # Parsing de estadísticas desde el lore del item
                    scoreboard.js      # Helpers scoreboard (API preferida + fallback)
          scoreInit.js       # Inicialización de todos los scoreboards requeridos
          utilMath.js        # Utilidades de cálculo, clamp, floor, etc.
```


### `main.js`

El entry del BP inicializa el sistema de daño (idealmente pasando config, sin hardcode):

```js
import { initDamageCalc } from "./features/skills/calc/index.js";
import { initDamageScoreboards } from "./features/skills/calc/scoreInit.js";
import { damageCalcConfig } from "./features/skills/calc/config.js";

initDamageScoreboards(damageCalcConfig);
initDamageCalc(damageCalcConfig);
```

- `initDamageScoreboards()` ejecuta comandos una única vez para crear todos los scoreboards necesarios.
- `initDamageCalc()` registra los listeners (por ejemplo, cambios de ítem en mano mediante eventos periódicos/eventos de inventario) y mantiene actualizados los scoreboards `DanoFinalCC` y `DanoFinalSC` por jugador. [web:21][web:25]

---

## Formato del Lore de las armas

### Estructura general del lore

Ejemplo de lore de espada (con saltos de línea `\n`):

```text
§r§7Poder: §c+1☠\n
\n
§7Daño: §c+21🗡 §8( +14 )\n
§7Daño Crítico: §9+50🎃\n
§7Probabilidad Crítica: §9+10\n
§7Daño Verdadero: §f+10⏳\n
§9Filo VII\n
\n
§o§8Esta cosa fue hecha por y para el flameante,\n
insurgente y decadente imperio...\n
\n
§d§lESPADA MITICA
```

Se distinguen **tres secciones**:

1. **Estadísticas del objeto**
    - Desde `Poder:` hasta `Daño Verdadero:` (incluidos).
    - Cada estadística está en **una línea** (delimitada por `\n` al inicio y al final).
2. **Encantamientos “estéticos”**
    - Una o varias líneas (ej. `§9Filo VII`), opcionales.
    - Después de la última línea de encantamientos hay un `\n\n`.
3. **Descripción y calidad**
    - Texto libre de flavor + rareza (ej. `§d§lESPADA MITICA`).
    - No interviene en el cálculo numérico.

### Estadísticas soportadas

Cada arma puede tener estas 4 estadísticas (alguna puede faltar):

- **Daño**
- **Daño Crítico**
- **Probabilidad Crítica**
- **Daño Verdadero**

El formato lógico por línea **se identifica por etiquetas** (por ejemplo `Daño:`, `Daño Crítico:`, etc.).

- Los **colores (§x)** pueden variar y **no deben usarse** como criterio de parsing.
- Los íconos/símbolos (🗡 🎃  ⏳) pueden existir, pero el parser debe ser tolerante: si cambian o faltan, mientras la etiqueta y el número existan, debe funcionar.
- El formato de la etiqueta **no cambiará**: `Daño: +<Daño...>` se mantiene, el ejemplo solo muestra cómo suele verse in-game.

#### Línea de Daño

```text
Daño: +<TotalDañoPlano> ... [ +<DañoSumatorio1> ] [ +<DañoSumatorio2> ] ( +<DañoSumatorio3> )
```

- `TotalDañoPlano` (int): daño total mostrado en el lore (ej. `21`).
- `DañoSumatorio1,2` (opcionales): van entre `[]`; solo se muestran si existen.
- `DañoSumatorio3` (opcional): va entre paréntesis `()` con color §8.
- Si algún sumatorio no existe, **no se muestra** en el lore.
- El **Daño Base** del arma se calcula:

$$
DañoBase = TotalDañoPlano - (DañoSumatorio1 + DañoSumatorio2 + DañoSumatorio3)
$$

Ejemplo:
`§7Daño: §c+21🗡 §8( +14 )` → `Total=21`, `Sum1=0`, `Sum2=0`, `Sum3=14` → `DañoBase=7`.

**Nota:** la fórmula de daño final usará **DañoTotal** (TotalDañoPlano), no DañoBase, pero DañoBase se mantiene porque ciertas mecánicas futuras pueden operar solo sobre la parte “base”.

#### Línea de Daño Crítico

```text
Daño Crítico: +<TotalDañoCriticoPlano> ... ( +<DañoCriticoSumatorio1> )
```

- `TotalDañoCriticoPlano` (float permitido).
- `DañoCriticoSumatorio1` (opcional).
- Cálculo de base:

$$
DañoCriticoBase = TotalDañoCriticoPlano - DañoCriticoSumatorio1
$$

Si no hay sumatorio, `DañoCriticoBase = TotalDañoCriticoPlano`.

#### Línea de Probabilidad Crítica

```text
Probabilidad Crítica: +<TotalProbabilidadCriticaPlano> ... ( +<ProbabilidadCriticaSumatoria1> )
```

- `TotalProbabilidadCriticaPlano` (float permitido, en %).
- `ProbabilidadCriticaSumatoria1` (opcional).

$$
ProbabilidadCriticaBase = TotalProbabilidadCriticaPlano - ProbabilidadCriticaSumatoria1
$$

#### Línea de Daño Verdadero

```text
Daño Verdadero: +<TotalDañoVerdaderoPlano>
```

- `TotalDañoVerdaderoPlano` (int).
- Por ahora **sin modificadores** ni sumatorias; se trata como valor base.
- En el futuro puede extenderse con sumatorios usando la misma idea que daño y crítico.


### Tipos numéricos

- **Daño** y **Daño Verdadero**: **siempre int**.
- **Daño Crítico** y **Probabilidad Crítica**: pueden ser **float** (decimales).

Notas de implementación:

- Los **scoreboards base del jugador** (`DMGH`, `CCH`, `CDH`) se manejarán **como enteros** en la primera versión.
- Aunque el lore permita floats para crítico/probabilidad, el cálculo final que se guarda en scoreboards (`DanoFinalSC`, `DanoFinalCC`) es **int** (floor).
- Aunque el nombre lógico de la estadística sea “DañoFinal…”, los *IDs* de objective usados en scoreboards se mantendrán **ASCII**: `DanoFinalSC`/`DanoFinalCC`.


### Ausencia de estadísticas

- Si una línea (por ejemplo `Daño Verdadero`) **no existe** en el lore, se asume que esa estadística del arma es `0`.
- El parser debe ser robusto: si no encuentra patrón, devuelve null/0 sin romper el cálculo.

---

## Estadísticas del jugador (scoreboards base)

Cada jugador tiene estadísticas personales en scoreboards:

- `DMGH` → Daño base del jugador.
- `CDH` → Daño Crítico base del jugador.
- `CCH` → Probabilidad Crítica base del jugador.
- `MAH` → Multiplicador Aditativo (entero escalado x10).
- `MMH` → Multiplicador Multiplicativo (entero escalado x10).

Escalado de multiplicadores:

- Los valores de `MAH` y `MMH` se interpretan como **decimales con escala fija** dividiendo entre 10.
    - `MAH = 10` → $10/10 = 1.0$ (x1)
    - `MMH = 50` → $50/10 = 5.0$ (x5)
- Por seguridad, si el score está en `0` o no existe para el jugador, el sistema lo trata como `10` (x1).
- Al entrar (initial spawn), el sistema setea **automáticamente** `MAH=10` y `MMH=10` si están en 0/no definidos.

**Restricción actual:** por ahora estas estadísticas se consideran **enteros**. Si a futuro se requieren decimales, se definirá un estándar (p. ej. escala fija) y se actualizará esta documentación.

Estas se suman a las del arma para obtener los totales:

- `DañoTotal` = `DMGH_jugador` + `TotalDañoPlano_gear`
- `DañoCriticoTotal` = `CDH_jugador` + `TotalDañoCriticoPlano_gear`
- `ProbabilidadCriticaTotal` = `CCH_jugador` + `TotalProbabilidadCriticaPlano_gear`

Donde `*_gear` es la suma de:

- Mainhand
- Offhand
- Armadura (Head/Chest/Legs/Feet)

Si un slot no tiene item (o el item no tiene lore válido), aporta `0`.

Nota: aunque el lore pueda tener decimales en probabilidad crítica, el output final se guarda como **int** (se usa `Math.floor` y se trunca) porque los scoreboards son enteros.

Si el jugador está sosteniendo **aire** o un ítem sin lore válido, se consideran solo sus estadísticas base (`DMGH`, `CDH`, `CCH`); el arma aporta `0`.

---

## Fórmula de daño final

Variables:

- `DañoTotal` → Daño base+arma total (int).
- `Poder` → futuro stat adicional (por ahora se puede asumir 0, pero dejar hook).
- `MultiplicadorAditativo` → futuro multiplicador (default `1`).
- `MultiplicadorMultiplicativo` → futuro multiplicador (default `1`).
- `Bonus` → futuro bonus plano (default `0`).
- `DañoCriticoTotal` → suma de CDH + daño crítico plano del arma.

Se definen dos valores:

- `DañoFinalSC` = daño final **sin crítico** (se guarda en scoreboard `DanoFinalSC`).
- `DañoFinalCC` = daño final **con crítico** (se guarda en scoreboard `DanoFinalCC`).

Nota: en la implementación, los scoreboards se llaman `DanoFinalSC` y `DanoFinalCC` (IDs ASCII). En este documento se sigue usando “DañoFinal…” como nombre lógico de la variable.


### Versión genérica

Primero se calcula un “DañoBaseFinal” común a ambos:

$$
DañoBaseFinal = (1 + DañoTotal) \times (1 + \frac{Poder}{10}) \times MultiplicadorAditativo \times MultiplicadorMultiplicativo + Bonus
$$

- Para la primera versión se puede usar:
`Poder = 0`, `MultiplicadorAditativo = 1`, `MultiplicadorMultiplicativo = 1`, `Bonus = 0`.
- Queda: `DañoBaseFinal = 1 + DañoTotal`.

Nota de implementación:

- Los valores se pueden exponer vía `damageCalcConfig.formula`.
- Por seguridad, si `MultiplicadorAditativo` o `MultiplicadorMultiplicativo` llegan como `0`, `undefined` o `NaN`, el sistema los trata como `1` (nunca se permite multiplicar por 0).
- En la implementación actual, `MultiplicadorAditativo` y `MultiplicadorMultiplicativo` vienen de scoreboards `MAH` y `MMH` (escala x10, se divide entre 10).

Luego:

- **Sin crítico**
    - `DañoFinalSC = floor(DañoBaseFinal)` (clamp >= 0)
- **Con crítico**
    - Si el golpe **es crítico**:

$$
DañoFinalCC = DañoBaseFinal \times (1 + \frac{DañoCriticoTotal}{100})
$$

- Si **no es crítico**, es equivalente a `DañoFinalSC`.
- Para el scoreboard `DañoFinalCC` se guarda el valor **asumiendo que SÍ acierta crítico** (valor teórico máximo).
- El resultado **siempre se redondea hacia abajo**:
    - Ej: `9.99 → 9`, `12.0 → 12`.


### Probabilidad de crítico

- `ProbabilidadCriticaTotal` se interpreta como porcentaje:
    - `0` → nunca crítico
    - `100` → crítico garantizado en la lógica de golpe
- El cálculo de “si el golpe fue crítico” no se hace en este feature (aquí solo se calcula el valor teórico con y sin crítico).
- Otros sistemas (combate real, skills) pueden usar `ProbabilidadCriticaTotal` para decidir si aplican `DañoFinalCC` o `DañoFinalSC`.

---

## Scoreboards de salida (dinámicos)

El sistema debe mantener actualizados, por jugador:

- `DanoFinalSC` → Daño final teórico **sin crítico** (int).
- `DanoFinalCC` → Daño final teórico **con crítico** (int).
- `ProbabilidadCriticaTotal` → Probabilidad crítica total **en %** (int).

Ejemplo de comandos equivalentes:

```text
/scoreboard players set <Jugador> DanoFinalSC <DanoFinalSinCritico:Int>
/scoreboard players set <Jugador> DanoFinalCC <DanoFinalConCritico:Int>
```

Estos valores deben actualizarse **dinámicamente** cada vez que:

- El jugador cambia el item en la mano (slot seleccionado).
- El jugador cambia de `H` (0 ↔ 1).
- Futuro: si cambian sus stats base (`DMGH`, `CCH`, `CDH`).

Si el ítem en mano:

- No tiene lore válido → se usan solo stats de jugador.
- Es aire → idem, solo stats de jugador.

---

## Inicialización de scoreboards

Crear un archivo `scoreInit.js` que exponga `initDamageScoreboards()`.

Recomendación:

- **Preferir API de scoreboard** (`world.scoreboard`) para crear/consultar objectives cuando sea posible.
- Si se decide usar `runCommandAsync`, hacerlo como fallback best-effort y manejando errores silenciosamente.

Scoreboards necesarios:

1. Habilitación / stats base:
    - `H` (ya existente, pero se puede asegurar su creación).
    - `DMGH`
    - `CCH`
    - `CDH`
    - `MAH` (Multiplicador Aditativo x10)
    - `MMH` (Multiplicador Multiplicativo x10)
2. Salidas del calculador:
    - `DanoFinalSC`
    - `DanoFinalCC`

Compatibilidad / naming:

- Los *IDs* de objectives se mantendrán ASCII (sin acentos/ñ) por compatibilidad con herramientas/hosting.
    - Se usa: `DanoFinalSC` y `DanoFinalCC`.

Ejemplo orientativo (pseudo):

```js
function ensureObjective(cmdRunner, name, criteria, displayName) {
  // Ejecutar add solo si no existe (manejar error silenciosamente)
}

export function initDamageScoreboards() {
  const overworld = world.getDimension("minecraft:overworld");
  const cmd = (c) => overworld.runCommandAsync(c);

  ensureObjective(cmd, "H", "dummy", "Habilitado Skills");
  ensureObjective(cmd, "DMGH", "dummy", "Daño Base");
  ensureObjective(cmd, "CCH", "dummy", "Prob Crítica Base");
  ensureObjective(cmd, "CDH", "dummy", "Daño Crítico Base");
	ensureObjective(cmd, "MAH", "dummy", "Multiplicador Aditativo (x10)");
	ensureObjective(cmd, "MMH", "dummy", "Multiplicador Multiplicativo (x10)");
    ensureObjective(cmd, "DanoFinalSC", "dummy", "Daño Final Sin Crit");
    ensureObjective(cmd, "DanoFinalCC", "dummy", "Daño Final Con Crit");
}
```


---

## Actualización dinámica por jugador

### Evento / bucle recomendado

No hay evento directo “item en mano cambió”, pero se pueden usar:

- Un `system.runInterval` con un tick-rate razonable (ej. cada 5–10 ticks) y **configurable** para revisar:
    - Jugadores con `H == 1`.
    - Item actualmente en mano.
      - Recomendado: `equippable.getEquipment(EquipmentSlot.Mainhand)`.
      - Alternativa: inventario + `player.selectedSlotIndex`.
- Comparar con el estado anterior (cache en memoria por jugador ID):
    - Si cambió el item ID o el lore, recalcular.
    - Si no cambió, no hacer nada.

Esto mantiene el sistema reactivo sin consumos exagerados. [web:25][web:408]

Recomendaciones extra de rendimiento:

- **Early exit agresivo:** si `H != 1`, no parsear lore ni calcular; opcionalmente setear outputs a `0` solo si antes no estaban en `0`.
- **Evitar escrituras redundantes:** solo actualizar `DañoFinalSC`/`DañoFinalCC` si el valor cambió.
- En implementación: se actualiza `DanoFinalSC`/`DanoFinalCC`.
- **Firma de cache:** usar una firma barata y estable, por ejemplo: `item.typeId | nameTag | lore.join("\n")`.

### Pasos por jugador (cuando se recalcula)

1. Verificar scoreboard `H == 1`; si no, setear `DanoFinalSC` y `DanoFinalCC` a 0 y salir.
2. Leer:
    - `DMGH`, `CCH`, `CDH` del jugador (via `getScore`). [web:21]
3. Obtener el item en mano:
	- Si no hay item → stats del arma = 0.
	- Si lo hay → parsear lore con `loreParser.js` y obtener:
        - `TotalDañoPlano`
        - `TotalDañoCriticoPlano`
        - `TotalProbabilidadCriticaPlano`
        - `TotalDañoVerdaderoPlano` (aunque por ahora no entra en la fórmula principal, se guarda por posible uso futuro).

Nota (corrección):

- Si el item en mano es una **armadura wearable** (helmet/chestplate/leggings/boots), se ignora y se trata como si no hubiera item (stats = 0).
- Aplica tanto a armaduras vanilla como a armaduras custom (por ejemplo `atomic:copper_helmet_plain`).
4. Sumar stats de arma + jugador para obtener:
    - `DañoTotal`, `DañoCriticoTotal`, `ProbabilidadCriticaTotal`.
5. Aplicar la fórmula de daño para obtener:
    - `DañoFinalSC`
    - `DañoFinalCC`
6. Redondear hacia abajo y asegurarse de que son enteros ≥ 0.
7. Actualizar scoreboards correspondientes con `runCommandAsync` o API de scoreboard. [web:21]

Nota: aunque aquí se listan como variables lógicas `DañoFinal*`, los objectives reales actualizados por el sistema son `DanoFinalSC` y `DanoFinalCC`.

Recomendación: **preferir la API de scoreboard** (`objective.getScore(identity)` / `objective.setScore(identity, value)`) y usar `runCommandAsync` únicamente como fallback best-effort.

---

## Requisitos técnicos y buenas prácticas

- Usar solo Script API **estable** (`@minecraft/server` en versión apropiada para tu build) y evitar módulos/flags experimentales. [web:21][web:389]
- Mantener funciones puras y pequeñas:
    - `parseDamageFromLore(loreLines)`
    - `parseCritDamageFromLore(loreLines)`
    - `parseCritChanceFromLore(loreLines)`
    - `parseTrueDamageFromLore(loreLines)`
    - `getPlayerBaseStats(player)` (lee scoreboards)
    - `computeFinalDamageTotals(...)`
    - `updateDamageScoreboards(player, finalSC, finalCC)`
- No usar dynamic properties para este feature (diseño explícito: todo va en scoreboards + memoria volátil). [web:21][web:204]
- Manejar errores de parsing de forma defensiva: si un valor no se puede parsear, usar 0 para no romper el flujo.

Parsing (robustez):

- Normalizar líneas antes de parsear (sugerido):
    - Remover códigos de color/format (`§.`)
    - Colapsar espacios múltiples
    - Aceptar `,` o `.` como separador decimal (si aplica)
- Parsear por **etiqueta**, no por color ni por posición fija del símbolo.

Scoreboards (seguridad/estabilidad):

- Aplicar clamp a rango `int32` antes de setear scores para evitar overflow.
- Evitar `runCommandAsync` en loops de alta frecuencia cuando la API nativa sea suficiente.

---

## Notas clave de diseño

- La fórmula de `DañoFinal` **usa el daño total del arma**, no el daño base.
    - Si el lore muestra: `§7Daño: §c+21🗡 §8( +14 )`, se toma `21` como daño del arma y se suma a `DMGH` del jugador.
- Incluso si el jugador sostiene aire, los scoreboards deben reflejar el daño que realmente haría con sus stats base (sin arma).
- El sistema debe estar preparado para stats altas (`DMGH`, `CCH`, `CDH`) sin overflow ni recortes indebidos (aplicar clamps razonables en la implementación si es necesario).

---

## IDs finales de scoreboards (implementación)

Para evitar caracteres especiales en objectives, la implementación usa estos IDs:

- `DanoFinalSC`
- `DanoFinalCC`

---

## Armadura + Offhand (nuevos totales)

Además de mainhand, el calculador ahora lee **todo el equipamiento** del jugador (solo si `H==1`):

- Mainhand
- Offhand
- Armadura: Head / Chest / Legs / Feet

Cada item aporta stats por lore (si existen). Si el slot está vacío o el item no tiene lore, aporta `0`.

### Nuevas etiquetas de lore soportadas

El parser sigue siendo tolerante y **no depende de colores ni emojis**. Identifica por etiqueta:

- `Vida:`
- `Defensa:`
- `Mana:`

Para `Vida:` y `Defensa:` soporta el mismo estilo de sumatorias que `Daño:` (brackets y paréntesis), pero para los totales se usa siempre el valor **Total...Plano**.

## Nuevos scoreboards

Stats personales (no dependen del gear):

- `DH` (defensa base del jugador)
- `MH` (mana base del jugador)

Totales (base + gear):

- `DtotalH = DH + DefensaGearTotal`
- `MtotalH = MH + ManaGearTotal`

## Vida máxima (base + gear)

Este feature **no controla la vida actual**. Solo calcula una vida máxima total separada, sin sobrescribir la vida base del jugador.

- `VidaMaxH`: vida base/personal (editable por comandos). **Este feature nunca la sobrescribe.**
- `VidaMaxTotalH`: vida máxima total calculada ( `VidaMaxH + VidaGearTotal` ). **Este feature sí la escribe.**

Nota: si el jugador no tiene score en `VidaMaxH`, se usa `0` (configurable).

Recomendación: el feature `skills/combat/health` puede inicializar `VidaMaxH=100` automáticamente la primera vez que un jugador entra al sistema (`H==1`).

## MVP examples

Caso C (armadura con vida/defensa/mana):

- VidaGearTotal = 270
- DefensaGearTotal = 68
- ManaGearTotal = 25
- Si `DH=100` y `MH=10`:
    - `DtotalH = 168`
    - `MtotalH = 35`
- Si `VidaMaxH = 100`:
    - `VidaMaxTotalH = 370`

