# Sistema de Spawnpoints (BP)

Ruta: `Atomic BP/scripts/systems/spawnpoints/`

## Objetivo
Asignar spawnpoints individuales por jugador según un scoreboard `spawnpoint`, sin modificar el worldspawn. Debe funcionar especialmente al respawn.

## Scoreboards requeridos
> No se inicializan aquí. Deben existir desde el init central.

- `spawnpoint` (id numérico del punto de respawn)

## Configuración
Archivo: [Atomic BP/scripts/systems/spawnpoints/config.js](../../scripts/systems/spawnpoints/config.js)

### Ejemplo
```js
export default {
  debug: false,
  objective: "spawnpoint",
  spawnpoints: {
    "1": { dimension: "minecraft:overworld", x: 0, y: 100, z: 0 }
  },
  defaultSpawnpointId: "1",
  assignDefaultOnJoin: true,
  applyEveryTicks: 40
};
```

## Reglas
- `spawnpoint == 1` → aplica el spawnpoint "1" del config.
- `spawnpoint == 2` y no existe en config → limpia spawnpoint (respawn en worldspawn).
- `spawnpoint == 0` o inexistente → limpia spawnpoint o asigna default si `assignDefaultOnJoin` está activo.

## Cuándo se aplica
- En `playerSpawn` (evento nativo).
- También en un loop cada `applyEveryTicks` para cambios dinámicos.

## Entrypoint
- [Atomic BP/scripts/main.js](../../scripts/main.js)
