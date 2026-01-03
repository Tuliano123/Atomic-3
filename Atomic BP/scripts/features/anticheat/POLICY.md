# AntiCheat Policy (Advertencias y Sanciones)

Este documento define las reglas **obligatorias** del AntiCheat en este proyecto.

## Reglas clave

1) Ningún sistema baneará directamente
- Ningún *check* debe banear al jugador.
- Los checks **solo reportan señales** a través de advertencias internas.

2) Sistema de advertencias internas (anti falsos-positivos)
- Cada detección suma **advertencias internas** al jugador.
- Las advertencias internas **sí se resetean** (por tiempo sin flags).
- Cada cierto número de puntos internos, se otorga una **advertencia al jugador**.
- Las advertencias al jugador **NO se resetean**.
- Al llegar a un umbral configurado (por defecto: **3 advertencias**) se solicita una **sanción temporal**.
  - En este proyecto, **3 advertencias => sanción #2** (configurable en `warnings.player.sanctionId`).

3) Ninguna sanción será permanente
- Todas las sanciones deben tener duración limitada.
- Si se implementa un castigo tipo “ban”, debe ser *temporal* (ej. 10 min / 24h), nunca permanente.

## Reglas de limpieza de advertencias

- Las advertencias al jugador solo se eliminan:
  - Manualmente por staff (buen comportamiento), o
  - Por reporte del jugador (queda registro en logs para auditoría).

4) Si no es posible con precisión una funcionalidad, usar lo más cercano
- Si un check no puede detectar con precisión (ej. aimassist), se implementa la alternativa más robusta:
  - métricas indirectas,
  - tolerancias altas,
  - escalado lento (más advertencias antes de sanción),
  - y registro para revisión del staff.

## Flujo recomendado

- Check detecta una señal -> `ctx.enforce.flag(player, reason, { checkId, severity, details })`
- `warnings` acumula advertencias internas
- Cada `notifyPlayerEvery` advertencias: mensaje al jugador
- Al llegar a `sanctionAt`: se solicita una sanción temporal (sin permanencia)

## Sanciones por ID

- Las sanciones se definen en `anticheat.config.js` en el objeto `sanctions`.
- Al asignar una sanción a un jugador, se aplica inmediatamente.

### Ban (best-effort) y mensajes

- El Script API no permite un ban “real” de manera fiable en todos los entornos.
- Implementación usada: **durante el periodo establecido, el jugador será kickeado cada vez que intente entrar**.
- Para los demás jugadores **no se envía ningún mensaje adicional** (solo se verá lo típico de “Player has joined the world” / “Player has left the world”).
- El único mensaje mostrado es el **motivo del kick** para el jugador baneado, con este formato (respetar saltos de línea):

```text
§cBan de §l<dias>d§r§4 - Motivo:§b <motivo>§c
Tiempo restante:§b 00:00:00:00
§fEn caso de error contactar a antheuss
```

Sanción 4 (scoreboards): se ejecuta como jugador con:

- `scoreboard players reset @s *`

## Configuración

Se define en [anticheat.config.js](anticheat.config.js):

- `logging.console`: mostrar logs en consola
- `logging.bufferSize`: cuántos eventos guardar en memoria
- `warnings.notifyPlayerEvery`: cada cuántas advertencias notificar al jugador
- `warnings.sanctionAt`: umbral para pedir sanción temporal
- `warnings.sanctionType`: tipo de sanción temporal (contrato)
- `warnings.sanctionDurationSeconds`: duración de la sanción temporal
- `warnings.decaySeconds`: resetea contador si pasa tiempo sin flags

## Persistencia (Storage)

- Para escalar a muchos jugadores en "data" (ej. >10,000 no simultáneos), la persistencia se guarda en **scoreboards** (no en memoria del script).
- No se usan comandos por tick para leer/escribir: se usa el API estable de `world.scoreboard`.
- Si por restricciones del entorno no se puede crear/usar un objective, el sistema usa un **fallback** interno para no romper la lógica.
- Los objectives son configurables en `storage.scoreboards.*`:
  - `playerWarnings`
  - `banUntil` (epoch seconds)
  - `banSanction` (id de sanción)

## Gamemode (Creativo/Espectador)

- Creativo y espectador no están permitidos para jugadores normales.
- Excepciones:
  - Operadores (OP), o
  - Jugadores con la tag configurada en `adminAllowlist.exceptionTag`.
- Cuando un jugador no permitido entra a creativo/espectador:
  - Se registra evidencia vía warnings internas.
  - Opcionalmente se fuerza a Survival (según `adminAllowlist.gameModes.action`).

## Notas de implementación

- Evitar sanciones automáticas agresivas cuando el TPS es bajo.
- Cuando el TPS está bajo, el AntiCheat reduce severidad global de flags (para evitar falsos positivos por desync).
- Los hard-flags (ej. stacks imposibles) no dependen de posición y no se ven afectados.
- Priorizar checks con bajo falso positivo primero (items ilegales, stacks anómalos, flood de entidades).

## Stacks anómalos (sección 13)

- Se considera stack anómalo cuando `item.amount > item.maxAmount`.
- Para jugadores NO operadores:
  - Se considera evidencia 100% (hard-flag) y puede escalar a sanción inmediata (temporal).
  - Opcionalmente se corrige automáticamente (clamp a `maxAmount`).

En este proyecto, `abnormalStacks` aplica la sanción **#2 (ban 7d sin wipe)**.
- Contenedores en inventario (shulker/bundle/ender chest):
  - Como inspeccionar contenido no siempre es posible vía Script API, se pueden bloquear/eliminar del inventario para evitar ocultar stacks ilegales.
