// Config por defecto del sistema de hologramas (atomic:hologram).
// Este archivo es solo datos.

export const hologramsConfig = {
	enabled: true,

	// Registro/persistencia en dynamic properties de entidad
	persistence: {
		// Donde guardamos el template original (string)
		templateKey: "atomic:holo_template",
		// Límite duro para no romper DP ni permitir abuso
		maxTemplateLength: 1024,
	},

	// Render / actualización
	runtime: {
		// Cada cuántos ticks revisamos y re-renderizamos (poll)
		updateIntervalTicks: 10,

		// Límite best-effort de hologramas procesados por tick de update
		maxPerUpdate: 200,

		// Si falta objective/participant
		missingValue: 0,
	},

	// Interpolación (suavizado de números)
	interpolation: {
		enabled: true,
		// Duración del suavizado en ticks (aplica solo cuando cambia un score)
		durationTicks: 20,
		// Si true: redondea el valor mostrado a entero
		roundToInt: true,
	},

	// Debug
	debug: {
		// Master switch (si no quieres depender del toggle)
		enabled: false,
		// Si true, usa console.log
		console: false,
		// Toggle opcional por scoreboard (en-game):
		// Crea el objective y pon el score del participant a 1 para activar.
		toggle: {
			enabled: true,
			objective: "atomic_debug",
			participant: "holograms",
			onScoreAtLeast: 1,
			pollIntervalTicks: 40,
		},
		// Throttle para evitar spam en consola
		logEveryTicks: 40,
	},
};
