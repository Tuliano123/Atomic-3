export default {
	debug: false,

	// Asegurar en documentación/instalación:
	// gamerule showdeathmessages false (mensajes vanilla apagados)

	emojis: {
		// Import obligatorio del sistema de emojis custom (depende de tu proyecto)
		enabled: true,
	},

	moneyLoss: {
		enabled: true,
		// Bypass de “adaptación”: las primeras 2 muertes NO pierden dinero
		graceDeaths: 2,

		// Pérdida por default (jugador normal / vip=0)
		normalLossPercent: 30,

		// Tabla VIP (usar enteros y floor):
		vipRules: {
			1: { mode: "fraction", numerator: 1, denominator: 4 }, // pierde floor(D/4)
			2: { mode: "fraction", numerator: 1, denominator: 5 }, // pierde floor(D/5)
			3: { mode: "fraction", numerator: 1, denominator: 10 }, // pierde floor(D/10)
			4: { mode: "none" }, // no pierde nada
		},

		// Mensaje de pérdida (solo si aplica pérdida > 0)
		lossTellraw: "§7¡Has perdido §g<Cantidad>§7!",
	},

	warnings: {
		// Mientras muertes <= graceDeaths (o antes de empezar a perder)
		enabled: true,
		warningTellraw:
			"§c§k12§r §4¡Cuidado! §c§k12§r\n" +
			"§7En este realm al morir perderas <CantidadPerder>%% de tu dinero. \n" +
			"§eUna forma para evitarlo es guardar tu dinero en una cuenta en el \n" +
            "§e§gBanco §eó §eadquiriendo un §bRango VIP§r\n\n" +
			"§cLas proximas veces que mueras si perderas Dinero",
	},

	// Mensajes de muerte artificiales (globales)
	deathMessages: {
		// Mensajes comunes (por causa). placeholders: <Player>, <Target>, <Killer>
		deathCauses: {
			// PvP
			slainByPlayer: "<Target> ha sido asesinado por <Killer>",

			// Mobs comunes
			slainByZombie: "<Target> ha sido asesinado por un Zombie",
			slainBySkeleton: "<Target> ha sido asesinado por un Esqueleto",
			slainByCreeper: "<Target> voló en pedazos por un Creeper",

			// Proyectiles / ranged
			shotByArrow: "<Target> ha sido alcanzado por una Flecha",

			// Ambiente / genéricos
			fall: "<Target> se cayó desde muy alto",
			lava: "<Target> intentó nadar en lava",
			fire: "<Target> se quemó",
			drowning: "<Target> se ahogó",
			explosion: "<Target> explotó",
			void: "<Target> cayó al vacío",

			// Fallback obligatorio
			default: "<Player> ha muerto",
		},

		// VIP: ignora causa SIEMPRE, use un mensaje fijo
		// Identificación: vip >= 1 (scoreboard)
		specialDeathMessages: [
			{ name: "Anthe", message: "<Player> ha muerto porque si" },
			{ name: "JuanXX_8 a", message: "<Player> ha muerto por Juanico" },
		],
		vipDefault: "<Player> ha muerto", // si es VIP pero no está en lista
		killerUnknown: "Desconocido",

		// Target del mensaje de muerte: recomendado @a (simula muerte vanilla global)
		broadcastTarget: "@a",
	},

	sounds: {
		// Sonido opcional al morir (si lo quieres)
		// deathSound: { minecraftId: "random.levelup", volume: 1, pitch: 1 }
	},
};
