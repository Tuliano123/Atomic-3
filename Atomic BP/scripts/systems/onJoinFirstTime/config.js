export default {
	debug: true,

	// Logs/sondas para aislar fallos de comandos desde script
	diagnostics: {
		enabled: true,
		delayTicks: 10,
		probeCommands: true,
		chatSummary: true,
	},

	// Scoreboard de tracking
	objective: "nuevo",

	// Segunda validación (por tag) para evitar re-ejecución aunque se reseteen scoreboards.
	secondValidationTag: {
		enabled: true,
		tag: "NoNuevo",
	},

	// Evento que detecta "mundo cargado" (primer movimiento/acción)
	movementTrigger: {
		enabled: true,
		debounceMs: 100,
	},

	// 1) Reset de scoreboards
	scoreboardReset: {
		enabled: true,
		resetAll: true, // /scoreboard players reset @s *
	},

	// 2) Remover tag
	tagRemoval: {
		enabled: true,
		tag: "SX",
	},

	// 3) Tellraw de bienvenida (editable desde config)
	welcomeMessage: {
		enabled: true,
		text:
			"§q§l¡ §r§2Bienvenido a §aAtomic 3 §q§l!\n\n" +
			"§rEn este Realm podrás encontrar diversas modalidades, entre ellas: el Modo Historia, " +
			"hay muchas cosas innovadoras y nunca antes vistas en la comunidad; Esperamos puedas verlas todas.§r\n\n" +
			"§eEl §6Palo§e sirve para picar ciertas cosas, en el Modo Historia",
	},

	// 4) Teleport inicial
	initialTeleport: {
		enabled: true,
		x: 0,
		y: 30,
		z: 0,
		dimension: "minecraft:overworld",
	},

	// 5) Clear inventario + ender chest
	clearInventory: {
		enabled: true,
		clearAll: true,
	},

	// 6) Ítem inicial
	itemGiven: {
		enabled: true,
		item: "minecraft:stick",
		name: "§l§6El Palo Misterioso",
		lore: [
			"   ",
			"§7Todo tiene un comienzo, y este es el tuyo.",
			"§7Úsalo para minar ciertos bloques del Modo Historia.",
			"  ",
			"§l§fITEM COMÚN",
		],
		properties: [
			"keep_on_death",
		],
		canDestroy: [
			"cobblestone",
			"oak_wood",
			"warped_hyphae",
			"warped_planks",
			"twisting_vines",
			"warped_fungus",
		],
	},

	// 7) Cargar estructura tutorial
	structure: {
		enabled: true,
		name: "Nuevo1",
		gracefulFail: true,
		loadAtPlayer: true,
		waitChunkTicks: 20,
		// Ejemplo de fallback por comando:
		// /execute at @s run structure load Nuevo1 ~ ~ ~
	},

	// 8) Title / Subtitle
	titleMessage: {
		enabled: true,
		title: "§l§a¡Bienvenido!",
		subtitle: "§l§qA Atomic",
		fadeIn: 10,
		stay: 70,
		fadeOut: 20,
	},

	// Sonido opcional (no obligatorio)
	sound: {
		enabled: false,
		minecraftId: "note.pling",
		volume: 1.0,
		pitch: 1.0,
	},
};
