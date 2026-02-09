export default {
	debug: false,

	objective: "spawnpoint",

	// Spawnpoints por id (string o number, pero consistente)
	spawnpoints: {
		"1": { dimension: "minecraft:overworld", x: -2, y: 5, z: -191 }, // default -2 5 -191
		"2": { dimension: "minecraft:overworld", x: 0, y: 30, z: 0 },
	},

	defaultSpawnpointId: "1",

	// Cuando el jugador entra por primera vez (o no tiene score), setearlo a 1
	assignDefaultOnJoin: true,

	// Intervalo para revalidar cambios de scoreboard (ticks)
	applyEveryTicks: 40,
};
