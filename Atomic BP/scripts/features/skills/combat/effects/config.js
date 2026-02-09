export const effectsConfig = {
	// Holograma por tick de daño del efecto
	hologram: {
		durationMs: 1200,
		offset: {
			dxAbsMax: 0.4,
			dzAbsMax: 0.4,
			dyMin: -1.7,
			dyMax: -0.5,
			jitter: 0.04,
		},
	},

	// Partículas manuales (para efectos sin visual vanilla)
	particles: {
		// Eleva el centro del spawn respecto a player.location (que suele estar a nivel de pies).
		// Valor recomendado: ~1.5 para que el rango y (-1.7..-0.5) quede alrededor del cuerpo.
		baseYOffset: 1.5,
		dxAbsMax: 0.9,
		dzAbsMax: 0.9,
		dyMin: -1.7,
		dyMax: -0.5,
		countMin: 1,
		countMax: 3,
	},

	// Tick global (interno)
	runtime: {
		// Cada cuántos ticks decrementamos la duración en segundos
		decrementEveryTicks: 20,
	},

	// Efectos MVP
	effects: {
		veneno: {
			objective: "EffVeneno",
			type: 1,
			percentOfVida: 0.05,
			damageEveryTicks: 25, // ~1.25s (poison amp 0)
			hologramText: "§r§2<Daño>🧪",
			vanillaEffect: {
				id: "poison",
				amplifier: 0,
				showParticles: true,
				// Se reaplica best-effort cada segundo con esta duración mínima.
				minDurationTicks: 60,
			},
		},

		congelamiento: {
			objective: "EffCongelamiento",
			type: 1,
			percentOfVida: 0.1,
			damageEveryTicks: 18, // 0.9s
			hologramText: "§r§b<Daño>❄",
			sound: {
				id: "mob.player.hurt_freeze",
				volume: 1,
				pitch: 1,
			},
			particles: {
				id: "minecraft:snowflake_particle",
				// Offset extra sobre particles.baseYOffset (bajar 0.4)
				yOffset: -0.4,
			},
		},

		calor: {
			objective: "EffCalor",
			type: 1,
			percentOfVida: 0.15,
			damageEveryTicks: 18, // 0.9s
			hologramText: "§r§6<Daño>🔥",
			sound: {
				id: "mob.player.hurt_on_fire",
				volume: 1,
				pitch: 1,
			},
			particles: {
				// Nota: en algunas builds el id puede variar; MVP+best-effort.
				id: "minecraft:basic_flame_particle",
				// Offset extra sobre particles.baseYOffset (subir 0.4)
				yOffset: 0.4,
			},
		},
	},
};
