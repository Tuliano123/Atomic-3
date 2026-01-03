# TPS Scaling (Anti Falsos-Positivos)

Este documento describe el mecanismo que reduce la estrictitud del AntiCheat cuando el servidor está bajo de TPS.

## Objetivo

- Bajo TPS hay desync (posiciones/rotación/velocidad) y aumenta el riesgo de falsos positivos.
- La estrategia es **reducir la severidad** de los flags cuando el TPS cae, sin desactivar el AntiCheat.

## Cómo funciona

1) Un monitor calcula TPS estimado (EMA)
- Implementación: [checks/tpsMonitor.js](checks/tpsMonitor.js)
- Guarda en `ctx.state.checks["tps"]`:
  - `tps`: TPS suavizado
  - `multiplier`: 0..1 (factor de strictness)

2) El enforcement global escala la severidad
- Implementación: [core/context.js](core/context.js)
- Para cada `ctx.enforce.flag(...)`:
  - Si `meta.tpsSensitive !== false`, se aplica:
    - `severity = floor(severity * multiplier)`
  - Si `severity` llega a `0`, se ignora el flag (no suma puntos internos).

3) Hard-flags no se tocan
- Si `meta.immediateSanction === true`, no se aplica scaling.

## Configuración

En [anticheat.config.js](anticheat.config.js) → `tps`:

- `checkEveryTicks`: muestreo
- `emaAlpha`: suavizado
- `severityScalingRules`: reglas (minTps → multiplier)

Ejemplo:

```js
severityScalingRules: [
  { minTps: 18, multiplier: 1 },
  { minTps: 14, multiplier: 0.75 },
  { minTps: 10, multiplier: 0.5 },
  { minTps: 0, multiplier: 0.25 },
]
```

## Buenas prácticas

- Marcar checks no dependientes de posición como `tpsSensitive: false`.
- Evitar cambiar umbrales de sanción con TPS (solo severidad/cadencia).
- Ajustar rules por servidor (TPS real, plugins, rendimiento, etc.).
