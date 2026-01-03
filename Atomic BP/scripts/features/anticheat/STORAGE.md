# Storage (Scoreboards)

Este documento describe el **cambio de persistencia** del AntiCheat a **scoreboards** para mejorar escalabilidad y evitar usar el script como "base de datos".

## Objetivo

- Persistir datos por jugador sin Maps permanentes y sin archivos.
- Evitar comandos por tick: usar el API estable de `world.scoreboard`.
- Soportar "data" grande (ej. >10,000 jugadores históricos) sin crecer en memoria del script.

## Qué se guarda en scoreboards

En [anticheat.config.js](anticheat.config.js) se define `storage.scoreboards.*`:

- `playerWarnings`
  - Guarda el contador persistente de advertencias del jugador (equivalente al valor que antes vivía en dynamic properties).
- `banUntil`
  - Guarda el fin del ban como **epoch seconds** (entero).
- `banSanction`
  - Guarda el **id de sanción** que originó el ban (ej. 2/3/6/7).

Formato de cada entrada:

```js
playerWarnings: {
  scoreboard: "advertencias",
  type: "dummy",
  display: "advertencias",
}
```

Notas:
- `type` se conserva por consistencia con comandos, pero el Script API crea objectives tipo dummy.
- El nombre real del objective es `scoreboard`.

## Dónde se usa

- Warnings persistentes: [core/playerStore.js](core/playerStore.js)
- Bans best-effort: [core/sanctions.js](core/sanctions.js)
- Helpers: [core/scoreboardStore.js](core/scoreboardStore.js)

## Migración y fallback

- Migración automática:
  - Si un jugador tiene datos legacy en dynamic properties, se copian al scoreboard cuando sea posible.
  - El legacy solo se limpia si la escritura al scoreboard fue exitosa.
- Fallback:
  - Si por restricciones del entorno no se puede crear/usar un objective, el sistema usa un fallback interno para no romper warnings/bans.

## Buenas prácticas

- Mantener pocos objectives (1 por dato global), nunca 1 objective por jugador o por check.
- Guardar solo enteros pequeños y estables.
- Evitar almacenar texto (motivos) en scoreboards: usar ids/códigos.
