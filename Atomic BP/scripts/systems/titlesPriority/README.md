# Sistema `titlesPriority` (BP)

Ruta: `Atomic BP/scripts/systems/titlesPriority/`

## Objetivo
Resolver **un único** `titleraw actionbar` por jugador usando prioridad numérica, combinando:

- Titles **estáticos** definidos en `config.js`.
- Titles **temporales** inyectados por otras features en runtime.

## Contexto técnico
- BP en desarrollo para servidor/realm Bedrock.
- Especificación base en `Atomic BP/manifest.json`:
  - `min_engine_version`: `[1, 21, 93]`
  - `@minecraft/server`: `2.4.0`

## Auditoría de hardcodeos (estado actual)
Se revisó el sistema para reducir valores rígidos en runtime:

- `loopTicks` ahora es configurable en `config.runtime.loopTicks`.
- `defaultDurationMs` de temporales ahora es configurable en `config.runtime.temporary.defaultDurationMs`.
- `defaultSource` de temporales ahora es configurable en `config.runtime.temporary.defaultSource`.

Hardcodeos que se mantienen por contrato/engine:
- `minecraft:overworld` para condición `display_if.area` (decisión funcional documentada).
- `ticks -> ms` usando `50ms` por tick Bedrock.
- key global interna `"*"` para store temporal (detalle interno, no parte del contrato público).

## Regla de resolución
- Solo se muestra **1** actionbar por jugador por ciclo.
- Gana el candidate con mayor `priority`.
- Si hay empate de `priority`, gana el primero en orden estable de evaluación.
  - Estáticos: orden en `config.js`.
  - Temporales: orden de inserción.

## Contrato de config estático
Archivo: `Atomic BP/scripts/systems/titlesPriority/config.js`

```js
export default {
	debug: false,
	runtime: {
		loopTicks: 10,
		temporary: {
			defaultDurationMs: 3000,
			defaultSource: "anonymous",
		},
	},
	emojis: { enabled: true },
	titles: [
		{
			id: "Lobby",
			content: [
				"§aLobby",
				"Dinero: ${D:@s}",
			],
			priority: 10,
			display_if: {
				area: {
					at: { x: 0, y: 0, z: 0 },
					to: { x: 100, y: 100, z: 100 },
				},
				score: {
					objective: "D",
					condition: ">=",
					int: 100,
				},
			},
		},
	],
};
```

### Config runtime
- `runtime.loopTicks`: frecuencia del loop principal del resolver.
- `runtime.temporary.defaultDurationMs`: duración fallback para temporales.
- `runtime.temporary.defaultSource`: fuente fallback para temporales.

Recomendado:
- Realm con pocos jugadores: `loopTicks` entre `8` y `12`.
- Realm más cargado: empezar en `10` y ajustar por TPS/percepción visual.

### Condiciones soportadas (`display_if`)
- `area`: AABB en `minecraft:overworld`.
- `score`: comparación con operadores `==`, `!=`, `>=`, `<=`, `>`, `<`.

Evaluación: todas las condiciones son `AND`.

## API runtime para titles temporales
Archivo: `Atomic BP/scripts/systems/titlesPriority/index.js`

### `upsertTemporaryTitle(request)`
Inserta o actualiza (`upsert`) un title temporal.

`request`:
- `id?: string` (si no se envía, se autogenera)
- `source?: string` (default: `"anonymous"`)
- `target?: Player | string` (si se omite, aplica global)
- `content: string | string[]`
- `priority?: number` (default: `0`)
- `display_if?: { area?, score? }`
- `durationMs?: number`
- `durationTicks?: number`
- `expiresAtMs?: number`

Duración efectiva:
- `expiresAtMs` (si se envía) tiene prioridad.
- Si no, usa `durationMs`.
- Si no, usa `durationTicks` (`ticks * 50`).
- Si no se envía nada, usa `config.runtime.temporary.defaultDurationMs`.

Retorna:
```js
{
	handle: "<target>::<source:id>",
	target: "...",
	id: "...",
	source: "...",
	expiresAtMs: 0,
}
```

### `removeTemporaryTitle(input)`
Elimina un title temporal por:
- `handle` (string retornado por `upsertTemporaryTitle`), o
- objeto `{ id, source?, target? }`.

Notas:
- Si `source` no se envía, usa `config.runtime.temporary.defaultSource`.
- Si tu feature gestiona múltiples ids iguales, siempre envía `source` explícito.

Retorna `boolean`.

### `clearTemporaryTitles(filter?)`
Limpia titles temporales.
- Sin filtro: elimina todos.
- Filtro opcional: `{ source?, target? }`.

Retorna `number` (cantidad eliminada).

### `getTemporaryTitlesDebugSnapshot()`
Snapshot debug best-effort del estado temporal activo.

## Flujo recomendado para features externas
1. Definir un `source` fijo por feature (ej: `"skills_regen"`).
2. En eventos efímeros, usar `upsertTemporaryTitle` con `id` semántico y duración corta.
3. Si el evento termina antes del timeout, llamar `removeTemporaryTitle`.
4. En `shutdown/reset` de feature, limpiar por `source` con `clearTemporaryTitles({ source })`.

## Patrones de uso
### Patrón A: evento puntual
```js
upsertTemporaryTitle({
	source: "feature_x",
	id: "buff_aplicado",
	target: player,
	priority: 80,
	durationMs: 1200,
	content: "§aBuff aplicado",
});
```

### Patrón B: estado refrescado (upsert repetido)
```js
upsertTemporaryTitle({
	source: "feature_x",
	id: "estado_canalizando",
	target: player,
	priority: 95,
	durationTicks: 20,
	content: ["§eCanalizando...", "§7No te muevas"],
});
```

### Patrón C: limpieza masiva por feature
```js
clearTemporaryTitles({ source: "feature_x" });
```

## Ejemplo de acoplamiento desde otra feature
```js
import { upsertTemporaryTitle } from "../../systems/titlesPriority/index.js";

function notifyCooldown(player) {
	upsertTemporaryTitle({
		source: "feature_x",
		id: "cooldown_ready",
		target: player,
		priority: 90,
		durationTicks: 40,
		content: ["§eHabilidad lista", "§7Pulsa click derecho"],
	});
}
```

## Decisiones de diseño
- Se mantiene una única autoridad de `actionbar` en este sistema.
- Los temporales no requieren editar `config.js`.
- `display_if` se comparte entre estáticos y temporales (contrato homogéneo).
- El contrato temporal usa `source + id` como clave lógica por target.

## Consideraciones operativas
- El loop re-emite `titleraw` periódicamente porque actionbar se desvanece.
- Si un `objective` no existe o el jugador no tiene score, la condición de score evalúa `false`.
- Recomendado: usar `source` consistente por feature para limpieza masiva (`clearTemporaryTitles({ source })`).
- En empates de prioridad, el orden de evaluación es estable (estáticos definidos primero, luego temporales por inserción).

## Checklist de integración
- Definir `source` único de la feature.
- Evitar ids genéricos (`"tmp"`, `"msg"`); usar ids semánticos.
- Elegir `priority` con convención global del proyecto.
- Definir estrategia de cierre: timeout, `remove`, o `clear`.
- Si se usa `display_if.score`, asegurar que el objective exista en el proyecto.

## Entrypoint
- Inicialización desde `Atomic BP/scripts/main.js`.
