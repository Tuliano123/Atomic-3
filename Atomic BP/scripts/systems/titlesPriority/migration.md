# Sistema de Titles Priority (BP)

Ruta: `Atomic BP/scripts/systems/titlesPriority/`

## Objetivo
Estandarizar la visualización de `titleraw` en **actionbar** con un sistema de **prioridad numérica**.

- En Minecraft Bedrock solo se puede ver **un** actionbar a la vez.
- Si un jugador cumple condiciones para múltiples “titles”, se muestra **solo uno**: el de **mayor prioridad**.
- La lista de “titles” se define como contrato en un `config.js` para poder añadir/quitar entradas sin tocar el resolver.

## Contexto de migración
Anteriormente se utilizaba `Coo` o `CooMayor` como “prioridad”. El problema es que no existía un orden estable, quedaba revuelto y podía fallar cuando había más de un title activo.

Este sistema migra a:
- **Prioridad numérica** (p. ej. 10, 20, 100…)
- **Regla determinística** de selección (si varios aplican, gana el de prioridad más alta)

## Contrato de configuración (propuesto)
Archivo: `Atomic BP/scripts/systems/titlesPriority/config.js`

### Diseño de datos (por qué `titles` es un array)
`titles` se define como `Array` por ser:
- Fácil de leer y editar (orden natural en el archivo).
- Natural para aplicar la regla “seleccionar el mejor candidato” (filtrar → ordenar/recorrer por prioridad).

#### Alternativa equivalente (más intuitiva para evitar IDs repetidos)
Si en el proyecto te resulta más cómodo, se puede representar como un **objeto indexado por `id`** y luego convertirlo a array internamente. Esto no cambia el comportamiento del sistema: solo cambia la forma de escribir el config.

Ejemplo de shape alternativa (conceptual):
```js
export default {
	titles: {
		Lobby: {
			content: ["..."],
			priority: 10,
			display_if: { /* ... */ },
		},
	},
};
```

Esta forma hace que “`id` único” sea más difícil de romper por accidente.

### Estructura
```js
export default {
	debug: false,

	emojis: {
		// Depende del sistema de emojis del proyecto
		enabled: true,
	},

	titles: [
		{
			id: "Lobby",
			content: [
				"Este es un titleraw que se usará en un lobby",
				"Y esta es otra línea",
				"Y aquí podemos ver un scoreboard: ${D:@s}",
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

### Campos
#### `titles[].id`
- **Tipo:** string
- **Rol:** identificador único del title.

#### `titles[].content`
- **Tipo:** `string[]`
- **Rol:** líneas que componen el actionbar.
- **Nota:** el resolver trata el contenido como “titleraw” (permite selectores y scores). El ejemplo usa la forma `${<objective>:<selector>}` para representar un score (p. ej. `${D:@s}`).

#### `titles[].priority`
- **Tipo:** number
- **Regla:** a mayor número, mayor prioridad.

#### `titles[].display_if`
- **Tipo:** object
- **Rol:** condiciones que deben cumplirse para que el title aplique.
- **Evaluación:** si hay múltiples condiciones dentro de `display_if`, todas deben ser verdaderas (AND).

## Condiciones soportadas
### `display_if.area`
Condición verdadera si el jugador está dentro de un área (AABB) en **overworld**.

- `at`: `{ x, y, z }` esquina A
- `to`: `{ x, y, z }` esquina B

### `display_if.score`
Condición verdadera si el score del jugador cumple la comparación.

- `objective`: nombre del objective (p. ej. `"D"`)
- `condition`: uno de `==`, `!=`, `>=`, `<=`, `>`, `<`
- `int`: número a comparar

Ejemplo interpretado:
- Se muestra el title si el jugador está en el área y además su score `D` es `>= 100`.

## Regla de prioridad
- Si varios titles aplican al mismo tiempo, se muestra **solo** el de mayor `priority`.

### Desempate (mismo `priority`)
Para que el resultado sea 100% determinista, si dos o más titles empatan en `priority`, debe ganar el **primero** que aparezca definido en el config (orden estable).

## Consideraciones
- El output es siempre **actionbar**.
- El chequeo de `area` se limita a **overworld** (no se considera nether/end).
- Mantener `id` como único para evitar colisiones.

## Entrypoint
- Se inicializa desde [Atomic BP/scripts/main.js](../../main.js).

## Notas de implementación (para evitar bugs)
- `display_if` se evalúa como AND: si hay varias condiciones, todas deben cumplirse.
- `area`: conviene normalizar el AABB con `min/max` (por si `at` y `to` vienen invertidos).
- `score`: si el objective no existe o el jugador no tiene score, tratar la condición como **false** (evita mostrar titles por datos faltantes).