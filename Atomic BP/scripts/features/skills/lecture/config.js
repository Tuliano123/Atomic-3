// Feature: skills/lecture
// Centraliza lectura de lore + escritura de capas Equipamiento/Total.

export const lectureConfig = {
	loopTicks: 10,

	// Cuando H != 1
	disabledBehavior: {
		// Si true, escribe 0 en Equipamiento/Total (no recomendado por spam).
		zeroOutputs: false,
	},

	debug: {
		enabled: false,
		console: false,
		// Si true, manda mensajes al jugador (throttled)
		tellPlayer: false,
		throttleMs: 2000,
	},
};
