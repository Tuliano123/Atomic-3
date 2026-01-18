export default {
	debug: false,

	objective: "spawnpoint",

	// Spawnpoints por id (string o number, pero consistente)
	spawnpoints: {
		"1": { dimension: "minecraft:overworld", x: 0, y: 100, z: 0 }, // default
		// "2": { dimension: "minecraft:overworld", x: 200, y: 80, z: -50 },
	},

	defaultSpawnpointId: "1",

	// Cuando el jugador entra por primera vez (o no tiene score), setearlo a 1
	assignDefaultOnJoin: true,

	// Intervalo para revalidar cambios de scoreboard (ticks)
	applyEveryTicks: 40,
};
