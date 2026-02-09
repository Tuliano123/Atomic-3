# OnJoinFirstTime (Primera Entrada)

Sistema de bienvenida que se ejecuta **solo cuando el jugador se une por primera vez** y luego realiza **su primera acción/movimiento** (para asegurar que el mundo ya cargó).

## ¿Cuándo se dispara?
1. El jugador entra al realm (join/spawn).
2. El sistema lo marca como **pendiente**.
3. En el **primer movimiento/acción** posterior (o primer cambio de posición detectado), se ejecuta la secuencia.

## Scoreboards requeridos
- **nuevo** (int)
  - **0 o inexistente**: jugador nuevo (se ejecuta la secuencia).
  - **1 o mayor**: jugador ya procesado (no se ejecuta).

## Segunda validación (Tag)
- **NoNuevo** (tag)
  - Si el jugador tiene este tag, el sistema NO se vuelve a ejecutar aunque alguien haga un reset de scoreboards.

> Los scoreboards se inicializan en `scripts/scoreboards/` (no en este sistema).

## Configuración
Archivo: `config.js`

Parámetros clave:
- `objective`: scoreboard que marca primera entrada.
- `movementTrigger`: controla la detección de “mundo cargado”.
- `scoreboardReset`: reset de scoreboards al entrar.
- `tagRemoval`: remueve un tag al entrar.
- `welcomeMessage`: mensaje con `tellraw`.
- `initialTeleport`: teleport inicial.
- `clearInventory`: limpia inventario/ender chest.
- `itemGiven`: item inicial (nombre, lore, canDestroy, keep_on_death).
- `structure`: carga estructura con fallback por comando.
- `titleMessage`: title/subtitle con tiempos.
- `sound`: sonido opcional.

Ejemplo breve:
```js
export default {
  objective: "nuevo",
  movementTrigger: { enabled: true, debounceMs: 100 },
  welcomeMessage: { enabled: true, text: "§a¡Bienvenido!" },
  initialTeleport: { enabled: true, x: 0, y: 30, z: 0, dimension: "minecraft:overworld" }
};
```

## Flujo exacto de acciones (orden)
Cuando se detecta el primer movimiento y `nuevo == 0`:
1. **Reset scoreboards** (si `scoreboardReset.enabled`).
  - Se usa el comando completo: `scoreboard players reset @s *`
  - Inmediatamente después se restaura `nuevo = 1` y se agrega el tag `NoNuevo` para evitar loops.
3. **Remueve tag** (si `tagRemoval.enabled`).
4. **Tellraw** de bienvenida (si `welcomeMessage.enabled`).
5. **Teleport** inicial (si `initialTeleport.enabled`).
6. **Clear inventario/ender chest** (si `clearInventory.enabled`).
7. **Dar ítem inicial** (si `itemGiven.enabled`).
8. **Cargar estructura** (si `structure.enabled`).
9. **Title/Subtitle** (si `titleMessage.enabled`).
10. **Sonido** (si `sound.enabled`).

Al final (o incluso si alguna acción falla), el sistema marca al jugador como procesado:
- `nuevo = 1`
- `tag NoNuevo`

## Estructura Nuevo1
Cómo crear y guardar:
1. Construye la estructura en el mundo.
2. Usa el comando:
   - `/structure save Nuevo1 <x1> <y1> <z1> <x2> <y2> <z2>`
3. El sistema luego la carga con:
   - `structure load Nuevo1 ~ ~ ~`

## Troubleshooting
- **Estructura no existe**: si `gracefulFail: true`, solo se loguea en debug.
- **Inventario lleno**: el ítem inicial se dropea al suelo.
- **Title no aparece**: el sistema hace fallback a comandos `title`.
- **Ender chest no limpiada**: se intenta por API y luego con `replaceitem`.

## Debug
Activa `debug: true` en `config.js` para logs de consola.

## Historias de usuario
- **Jugador nuevo**: recibe limpieza y guía al primer movimiento.
- **Admin evita bugs**: reset de scoreboards y tag SX automáticamente.
- **Inicio guiado**: teleport + title + palo especial.
- **Tutorial opcional**: estructura cargada si existe; si no, continúa.

## Casos de usuario
- **Caso A**: jugador nuevo → `nuevo` no existe → primera acción dispara la secuencia → `nuevo = 1`.
- **Caso B**: admin setea `nuevo = 0` → primera acción vuelve a disparar (útil pruebas).
- **Caso C**: estructura faltante → `gracefulFail: true` → continúa sin romper.
