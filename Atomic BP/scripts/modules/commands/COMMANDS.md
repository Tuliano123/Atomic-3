# Orden de comandos (Custom Commands)

Este proyecto centraliza **todo el registro** de comandos en un solo archivo y deja la **lógica** de cada comando en su script correspondiente.

## Regla principal

- **Todos los `event.customCommandRegistry.registerCommand(...)` viven únicamente en** `scripts/modules/commands/index.js`.
- Los archivos dentro de `scripts/modules/commands/handlers/` **NO registran comandos**. Solo exportan la funcionalidad (handlers y helpers).

Motivo: evitar duplicados, facilitar habilitar/deshabilitar comandos, y mantener una fuente única de verdad para nombres/descripciones.

## Estructura

- `scripts/modules/commands/index.js`
  - Contiene `commandConfig` (config dinámica) y `initCommands()`.
  - Suscribe `system.beforeEvents.startup` **una sola vez** (idempotente).
  - Registra *todos* los comandos en un bloque centralizado.

- `scripts/modules/commands/handlers/<comando>.js`
  - Contiene la lógica del comando.
  - Exporta un handler del estilo `handle<Comando>Command(origin)`.
  - Puede mantener estado interno (cooldowns, caches, etc.) si aplica.

- `scripts/main.js`
  - Debe llamar **solo** a `initCommands()` para inicializar los comandos.

## Config dinámica obligatoria (5 campos)

Cada comando debe tener estos 5 aspectos **dinámicos** en `commandConfig`:

- `namespace`: string (ej: `"atomic3"`)
- `enabled`: boolean (`true/false`)
- `name`: string (ej: `"show"`)
- `description`: string
- `permission`: string

Valores recomendados para `permission`:

- `"Any"`
- `"GameDirectors"` (operadores, incluye command blocks)
- `"Admin"` (operadores, NO incluye command blocks)
- `"Host"`
- `"Owner"`

Ejemplo:

```js
export const commandConfig = {
  show: {
    namespace: "atomic3",
    enabled: true,
    name: "show",
    description: "Muestra el item sostenido en la mano primaria.",
    permission: "Any",
  },
};
```

## Registro centralizado (patrón)
 
En `initCommands()`:

- Validar `enabled`.
- Construir el nombre completo como `${namespace}:${name}`.
- Llamar a `registerCommand` y delegar la lógica al handler importado.

Ejemplo:

```js
import { handleShowCommand } from "./handlers/show.js";


if (commandConfig.show.enabled) {
  const fullName = `${commandConfig.show.namespace}:${commandConfig.show.name}`;
  event.customCommandRegistry.registerCommand(
    {
      name: fullName,
      description: commandConfig.show.description,
      permissionLevel: CommandPermissionLevel.Any,
    },
    (origin) => handleShowCommand(origin)
  );
}
```

## Handlers (contrato)

- Firma recomendada:

```js
export function handleShowCommand(origin) {
  // origin.sourceEntity suele ser el jugador
}
```

- El handler **no debe** asumir que siempre hay jugador (comando podría venir de consola/command block). Debe validar:
  - `const player = origin.sourceEntity; if (!player) return;`

## Buenas prácticas

- **Idempotencia**: `initCommands()` debe evitar doble suscripción/registro.
- **Sin duplicados**: no registrar comandos en archivos individuales.
- **Nombres claros**: `commandConfig`, `initCommands`, `handleXCommand`, `toNamespacedCommandName`.
- **Fallos seguros**: si `namespace` o `name` están vacíos, no registrar.
- **Compatibilidad**: los comandos **deben** registrarse con namespace (`namespace:name`).
  - El cliente puede permitir ejecutar `/name` (forma corta), pero el registro siempre es namespaced.

## Cómo agregar un nuevo comando

1. Crear `scripts/modules/commands/handlers/<nuevo>.js` y exportar `handle<Nuevo>Command(origin)`.
2. Agregar config en `commandConfig` con los 5 campos.
3. Importar el handler en `scripts/modules/commands/index.js`.
4. Registrar el comando dentro de `initCommands()`.

Con esto, el proyecto mantiene orden, evita registros duplicados y facilita administrar comandos.
