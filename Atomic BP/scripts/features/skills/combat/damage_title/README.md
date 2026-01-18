# Combat / Skills: Damage Title (holograma por dano real)

Ruta: `Atomic BP/scripts/features/skills/combat/damage_title`

Este feature muestra un **holograma flotante** (entidad `atomic:hologram` con `nameTag`) cada vez que ocurre un golpe donde `damage_dealt` aplicó `danoReal` al scoreboard `Vida`.

IMPORTANTE: este feature NO calcula dano. Solo renderiza visualmente el **dano real aplicado**.

---

## Reglas (mismas que `damage_dealt`)

- Solo funciona si el atacante es un **Player**.
- Gate global: se requiere `H == 1` tanto en atacante como en objetivo.
- El holograma se genera únicamente si existe `danoReal` válido (entero > 0) en el momento del impacto.

Si cualquiera de estas condiciones falla, hace early-exit y no spawnea nada.

---

## Qué muestra

El texto del holograma se basa en `danoReal` (no en `DanoFinalSC/DanoFinalCC`).

Nota importante (mobs):

- Cuando el objetivo es un mob, el número mostrado es el **daño real calculado** del golpe y NO se recorta por la vida restante del mob.
- Ejemplo: si el golpe calcula `danoReal=1000` y el mob tenía `Vida=10`, el title muestra `1000`.
- Es normal que `Vida` pueda quedar negativa momentáneamente: el sistema mata al mob cuando `Vida <= 0`.

Sabores MVP (ACTUAL):

### Formato general (siempre)

En ambos casos (crítico o no) el número se formatea con **separador de miles** (coma):

- `10000` -> `10,000`
- `17132` -> `17,132`

### No crítico

- Se muestra en gris: `§7` + número con comas.
- Ejemplo: `10000` -> `§710,000`

### Crítico (decorativo)

Se renderiza como un patrón:

Inicio del title: `⚪`

Patrón por dígito (se repite):

`§f` -> `§e` -> `§6` -> `§c` -> (vuelve a `§f`)

Regla de comas:

- Si hay comas, se **incluyen dentro del dígito a la izquierda** (no “consumen” un color propio).

Emoji final (según el color del último dígito):

- Termina en `§f` -> `⚪`
- Termina en `§e` -> `🟡`
- Termina en `§6` -> `🟠`
- Termina en `§c` -> `🔴`

Ejemplos:

- `17` -> `⚪§f1§e7🟡`
- `1,000` -> `⚪§f1,§e0§60§c0🔴`
- `10,000` -> `⚪§f1§e0,§60§c0§f0⚪`
- `17,132` -> `⚪§f1§e7,§61§c3§f2⚪`

Nota de emojis custom:

- Estos emojis (`⚪🟡🟠🔴`) se convierten a PUA via `custom-emojis` para que se vean como glyphs en Bedrock.

El placeholder soporta:

- `<DañoReal>`
- `<DanoReal>` (ASCII)

---

## Holograma (entidad)

Entidad usada:

- `atomic:hologram` (ver docs generales en `Atomic BP/docs/hologram.md`)

Spawn:

- Se spawnea cerca del target usando `target.location`.
- Offsets tipo summon (relativo al target), sin salirse de bounds: X/Z dentro de ±0.4 y Y entre -1.7 y -0.5.
- Esto compensa el "cuerpo" del holograma y centra el title incluso en mobs pequeños.

Duración:

- Vive ~`durationMs` (default 1200ms) y luego se elimina (kill/remove best-effort).

---

## Arquitectura

Archivos:

- `index.js`: exporta `initDamageTitle(config?)` y se conecta al hook de `damage_dealt`.
- `config.js`: defaults y contrato de configuración.
- `format.js`: `formatDamageTitle(config, payload)`; soporta tipos extensibles.
- `hologramFactory.js`: `spawnDamageHologram({ dimension, location, text, durationMs })`.
- `guards.js`: validaciones (attacker player, `H==1`, `danoReal` válido).

Integración:

- `damage_dealt` llama `emitDamageTitle({ attacker, target, danoReal, isCrit })`.
- `damage_title` registra un handler con `setDamageTitleEmitter(...)` para recibir ese payload.

---

## Config

Default exportado en `config.js`:

- `durationMs` (default 1200)
- `offset.dxAbsMax` (default 0.4)
- `offset.dzAbsMax` (default 0.4)
- `offset.dyMin` (default -1.7)
- `offset.dyMax` (default -0.5)
- `offset.dxAbsChoices` / `offset.dzAbsChoices` / `offset.dyChoices` (bandas opcionales)
- `offset.jitter` (default 0.04)
- `types.normal.text`
- `types.critical.mode` (default `pattern`)
- `formatting.thousandsSeparator` (default `,`)
- `formatting.useCustomEmojis` (default true)
- `criticalPattern.startEmoji`
- `criticalPattern.colors`
- `criticalPattern.endEmojiByColor`
- `rateLimit` (opcional)
- `debug` (bool)

Ejemplo:

```js
import { initDamageTitle } from "./features/skills/combat/damage_title/index.js";

initDamageTitle({
	durationMs: 1200,
	types: {
		normal: { text: "§7<DañoReal>" },
		critical: { mode: "pattern" },
	},
	formatting: { thousandsSeparator: ",", useCustomEmojis: true },
	debug: false,
});
```

---

## Entry-point

En este repo ya está inicializado desde `Atomic BP/scripts/main.js` (una sola vez) junto con `damage_dealt`.

---

## Caso esperado (aceptación)

- Jugador golpea a un mob.
- `damage_dealt` resuelve `danoReal = 10` sin crítico.
- Aparece un holograma cerca del mob con texto `§710`.
- Tras ~1.2s el holograma desaparece.

