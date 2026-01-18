export const damageTitleConfig = {
	// Holograma de dano en ms (aprox). 1200ms ~= 24 ticks.
	durationMs: 1200,

	// Offset relativo al target. Se usa si no hay hitLocation.
	offset: {
		// Implementa offsets tipo summon (relativos al target):
		// Bounds:
		// x: ~[-0.4..0.4], y: ~[-1.7..-0.5], z: ~[-0.4..0.4]
		dxAbsMax: 0.4,
		dzAbsMax: 0.4,
		dyMin: -1.7,
		dyMax: -0.5,

		// "Bandas" opcionales para que aparezca mas aleatorio (sin pasarse de los bounds).
		// Si estas listas existen y tienen valores, se usan en vez del random uniforme.
		dxAbsChoices: [0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
		dzAbsChoices: [0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
		dyChoices: [-0.5, -0.8, -1.0, -1.2, -1.4, -1.7],

		// Jitter pequeno adicional (+/-) para evitar que parezca una rejilla.
		jitter: 0.04,
	},

	// Tipos de texto extensibles (future-proof).
	// Keys recomendadas: "normal", "critical".
	// Placeholder soportado: <DañoReal> y <DanoReal>
	types: {
		normal: {
			text: "§7<DañoReal>",
		},
		// Para crítico usamos un render decorativo (ver `format.js`).
		critical: {
			text: "§c<DañoReal>",
			mode: "pattern",
		},
	},

	formatting: {
		// Siempre aplicar separador de miles
		thousandsSeparator: ",",
		// Convertir emojis unicode a PUA para que rendericen como glyphs (nametag/hologram)
		useCustomEmojis: true,
	},

	criticalPattern: {
		startEmoji: "⚪",
		colors: ["§f", "§e", "§6", "§c"],
		endEmojiByColor: {
			"§f": "⚪",
			"§e": "🟡",
			"§6": "🟠",
			"§c": "🔴",
		},
	},

	// Rate-limit opcional (no obligado). Si enabled=false no aplica.
	rateLimit: {
		enabled: false,
		// Min ticks entre hologramas por atacante
		minTicksPerAttacker: 2,
	},

	debug: false,
};
