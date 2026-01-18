const achievementsConfig = {
	debug: false,

	visuals: {
		particlesOnUnlock: {
			enabled: true,
			particle: "minecraft:totem_particle",
			target: "@s",
		},

		tellraw: {
			defaultTarget: "@s",
			maxVisibleCharsPerLine: 25,
			variants: {
				A: {
					separator: "§e--------------------",
					header: " §l§pLOGRO ALCANZADO§r§f",
					rewardsHeader: " §l§gRECOMPENSAS§r",
					progress: "  §8<LogrosActuales-1>/<LogrosTotales> ->§e <LogrosActuales>/<LogrosTotales>§f",
					footer: "§e--------------------",
				},
				B: {
					separator: "§7--------------------",
					header: " §l§6LOGRO ALCANZADO§r§f",
					rewardsHeader: " §l§aRECOMPENSAS§r",
					progress: "  §7<LogrosActuales-1>/<LogrosTotales> ->§f <LogrosActuales>/<LogrosTotales>",
					footer: "§7--------------------",
				},
			},
		},
	},

	totals: {
		playerTotalObjective: "Logros",
		totalObjective: "LogrosTotal",
	},

	heartsReward: {
		enabled: true,
		milestoneEvery: 10,
		maxHeartsLevel: 5,
		heartsObjective: "Corazones",
	},

	achievements: [
		{
			id: 1,
			name: " §gUn Inicio",
			description: "   §fJuega durante 10 minutos o más",
			variant: "A",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "minutos", operator: ">=", value: 10 },
			],
		},
		{
			id: 2,
			name: " §gPasando el rato",
			description: "   §fJuega durante 1 hora o más",
			variant: "A",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "horas", operator: ">=", value: 1 },
			],
		},
		{
			id: 3,
			name: " §7¿Y el admin?",
			description: "   §fAcerca a un admin a 3 bloques o menos",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{
					type: "proximity",
					maxDistance: 3,
					targetSelector: { type: "player", requiredTag: "SX" },
				},
			],
		},
		{
			id: 4,
			name: " §7Ruta al cielo",
			description: "   §fLlega al cielo.",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "position", axis: "y", operator: ">=", value: 186 },
			],
		},
		{
			id: 5,
			name: " §sMonster Slayer",
			description: "   §fAcaba con 100 o más mobs",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "mobs", operator: ">=", value: 100 },
			],
		},
		{
			id: 6,
			name: " §7Visitante Frecuente",
			description: "   §fMuere en 100 ocasiones",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "muertes", operator: ">=", value: 100 },
			],
		},
		{
			id: 7,
			name: " §4Slayer",
			description: "   §fElimina a 100 Jugadores",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "Se", operator: ">=", value: 100 },
			],
		},
		{
			id: 8,
			name: " §6Un tiempo",
			description: "   §fJuega 10 horas o más tiempo.",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "horas", operator: ">=", value: 10 },
			],
		},
		{
			id: 9,
			name: " §8opmieT",
			description: "   §fJuega 10 días o más",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "dias", operator: ">=", value: 10 },
			],
		},
		{
			id: 10,
			name: " §eBaul de Oro",
			description: "   §fObtén 1,000 de Dinero",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "D", operator: ">=", value: 1000 },
			],
		},
		{
			id: 11,
			name: " §hInquilino",
			description: "   §fMuere en 500 ocasiones",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "muertes", operator: ">=", value: 500 },
			],
		},
		{
			id: 12,
			name: " §gTesoro Dorado",
			description: "   §fObtén 50,000 de Dinero",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "D", operator: ">=", value: 50000 },
			],
		},
		{
			id: 13,
			name: " §7¡Seguridad de Propiedad!",
			description: "   §fCompra una Parcela",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "Parcela", operator: ">=", value: 1 },
			],
		},
		{
			id: 14,
			name: " §8Habitante Local",
			description: "   §fMuere en 2,500 ocasiones",
			sound: { minecraftId: "random.levelup" },
			message: [],
			conditions: [
				{ type: "scoreboard", objective: "muertes", operator: ">=", value: 2500 },
			],
		},
	],
};

export default achievementsConfig;
