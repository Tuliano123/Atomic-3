# Client entity: `atomic:hologram`

Este documento describe el *client entity* (render) en el **Resource Pack** para la entidad del Behavior Pack `atomic:hologram`.

## Objetivo

Hacer que `atomic:hologram` sea **lo más liviana e invisible posible**:

- Geometría vacía (no se renderiza ningún modelo).
- Textura base `textures/entity/cape_invisible` (existe en vanilla, evita warnings de textura faltante).
- Render controller mínimo.

Con esto, la entidad queda pensada únicamente como “portador” de `nameTag` (texto flotante).

## Archivos

- [../entity/hologram.entity.json](../entity/hologram.entity.json): client entity para `atomic:hologram`.
- [../models/entity/atomic_hologram.geo.json](../models/entity/atomic_hologram.geo.json): geometría vacía.
- [../render_controllers/atomic.hologram.render_controllers.json](../render_controllers/atomic.hologram.render_controllers.json): render controller mínimo.

## Notas

- El `nameTag` se controla desde Script API (`entity.nameTag = "..."`).
- Aquí solo eliminamos el modelo; el texto (name tag) se renderiza por el juego.
