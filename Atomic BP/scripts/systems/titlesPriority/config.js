export default {
	debug: false,

	runtime: {
		// Refresco del loop principal de actionbar
		loopTicks: 10,

		temporary: {
			// Duracion por defecto de un title temporal cuando no se envia duration
			defaultDurationMs: 3000,
			// Fuente por defecto si la feature no envia source
			defaultSource: "anonymous",
		},
	},

	emojis: {
		// Depende del sistema de emojis del proyecto
		enabled: true,
	},

	// Lista de titles ESTATICOS con prioridad.
	// Los titles TEMPORALES se inyectan en runtime via API del sistema (ver README).
	// Nota: el sistema mostrará SOLO 1 (el de mayor prioridad) en actionbar.
	titles: [],
};
