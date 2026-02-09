// scripts/features/chest-ui/upgrades/menus/enchants/enchantsConfig.js
// Config específica del sistema de Encantamientos (fake, por lore).

/**
 * @typedef {Object} ScoreRequirement
 * @property {string} objective
 * @property {">="|"=="|"<="|"!="} operator
 * @property {number} int
 */

/**
 * @typedef {Object} ItemRequirement
 * @property {string} name - Nombre exacto del item (nameTag) incluyendo códigos §
 * @property {number} quantity - Cantidad requerida (se consumirá del inventario)
 */

/**
 * @typedef {Object} LevelConfig
 * @property {number[]} level
 * @property {string} color
 * @property {string} rarity
 * @property {string[]} levelDescription
 * @property {Object} requirement
 * @property {ScoreRequirement[]} [requirement.scores]
 * @property {ItemRequirement[]} [requirement.items]
 */

/**
 * @typedef {Object} EnchantmentDefinition
 * @property {number} id
 * @property {string} name
 * @property {string} colorName
 * @property {string[]} mainDescription
 * @property {number} maxLevel
 * @property {string[]} compatible
 * @property {LevelConfig[]} levelsMenu
 */

export const enchantsMenuConfig = {
	gridSlots: [14, 15, 16, 23, 24, 25, 32, 33, 34],
	pagination: {
		nextSlot: 17,
		prevSlot: 35,
		nextButton: {
			itemName: "§r§aSiguiente",
			itemDesc: ["", "§r§8Ir a la siguiente página", ""],
			texture: "g/lime",
			enchanted: false,
		},
		prevButton: {
			itemName: "§r§cAnterior",
			itemDesc: ["", "§r§8Ir a la página anterior", ""],
			texture: "g/lime",
			enchanted: false,
		},
	},
	mirrorSlot: 20,
	backSlot: 29,
	backButton: {
		itemName: "§eVolver",
		itemDesc: ["", "§r§8Regresa a la lista de encantamientos"],
		texture: "i/gold_nugget",
		enchanted: false,
	},
	enchantmentTexture: "i/enchanted_book",
	placeholders: {
		rarity: "<rarity>",
		action: "<action>",
		roman: "<roman>",
		percentage: "<percentage>",
		damage: "<damage>",
		critDamage: "<critdamage>",
		critChance: "<critchance>",
		multiplier: "<multiplier>",
		duration: "<duration>",
		chance: "<chance>",
		fortune: "<fortune>",
		fortuneAll: "<fortuneall>",
		fortuneCrop: "<fortunecrop>",
		drops: "<drops>",
	},
	actionTexts: {
		canApply: "§r§aDisponible para encantar",
		alreadyHasHigher: "§r§cEncantamiento actual superior",
		alreadyHasSame: "§r§cClic para desencantar",
		confirmDisenchant: "§r§c¡Clic de nuevo para confirmar!",
		missingRequirements: "§r§cNo cumples los requisitos",
	},
	enchantmentLoreColor: "§9",
	maxEnchantsPerLine: 2,
};

/**
 * Type A Effect Registry.
 * Ref: ENCHANTEFFECT.md § 2.6 — only Type A enchantments modify stats in lore.
 *
 * Each entry maps an enchantment name (normalizeForMatch key) to an array of
 * stat effects. Each effect: { stat, deltaPerLevel, segmentColor }.
 *
 * - stat: Display name of the stat line in lore (e.g. "Daño", "Daño Crítico").
 * - deltaPerLevel: Integer added per level. Negative for subtractive enchants.
 * - segmentColor: Color code for the parenthesis segment (default "§9").
 *
 * Omitted enchantments (Type B/C) do NOT modify stats — they only insert the
 * cosmetic lore token.
 *
 * Type A* (Sobrecarga, Obliteración, Linaje) are deferred: they require reading
 * existing stats or scoreboards to compute delta, which is not yet implemented.
 */
export const typeAEffects = {
	// Sword
	"Filo":          [{ stat: "Daño", deltaPerLevel: 3 }],
	"Crítico":       [{ stat: "Daño Crítico", deltaPerLevel: 5 }, { stat: "Probabilidad Crítica", deltaPerLevel: 2 }],
	"Verosimilitud": [{ stat: "Daño", deltaPerLevel: -35 }],

	// Bow
	"Poder":    [{ stat: "Daño", deltaPerLevel: 15 }],
	"Tormenta": [{ stat: "Daño", deltaPerLevel: 24 }],

	// Tools
	"Fortuna":    [{ stat: "Fortuna Minera", deltaPerLevel: 50, segmentColor: "§p" }],
	"Convicción": [
		{ stat: "Fortuna Minera", deltaPerLevel: 5, segmentColor: "§p" },
		{ stat: "Fortuna de Tala", deltaPerLevel: 5, segmentColor: "§p" },
		{ stat: "Fortuna de Cosecha", deltaPerLevel: 5, segmentColor: "§p" },
	],
	"Cultivador": [{ stat: "Fortuna de Cosecha", deltaPerLevel: 20, segmentColor: "§p" }],
};

// ─── Rarity tiers helper ───
// Defines level→rarity progression for common patterns.
// level arrays, color code, rarity key.

/** @type {EnchantmentDefinition[]} */
export const enchantmentsData = [
	// ═══════════════════════════════════════════════════
	// SWORD (ids 1–14)
	// ═══════════════════════════════════════════════════

	// 1  Filo — Type A, +3 Daño/nivel
	{ id: 1, name: "Filo", colorName: "§r§c", mainDescription: [
		"",
		"§8Aumenta la capacidad de las armas",
		"§8de hacer §cdaño 🗡§8 algunos dicen",
		"§8que un guerrero creó este",
		"§8encantamiento para acabar con",
		"§8la compañía del §cSegador",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 7, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Aumenta el §cdaño 🗡§8 del arma", "§r§8en §t+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eFilo <roman>", quantity: 1 }] } },
		{ level: [4, 5, 6], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Aumenta el §cdaño 🗡§8 del arma", "§r§8en §5+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eFilo <roman>", quantity: 1 }] } },
		{ level: [7], color: "§d", rarity: "mythic", levelDescription: ["", "§r§8Aumenta el §cdaño 🗡§8 del arma", "§r§8en §d+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eFilo <roman>", quantity: 1 }] } },
	] },

	// 2  Primer Golpe — Type B, ×multiplier first hit
	{ id: 2, name: "Primer Golpe", colorName: "§r§6", mainDescription: [
		"",
		"§8El primer golpe que asestes a un",
		"§8enemigo será §6devastador ⅛",
		"§8Un solo impacto certero puede",
		"§8cambiar la batalla.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 4, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8El primer golpe inflige", "§r§8§t×<multiplier>§8 de daño 🗡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePrimer Golpe <roman>", quantity: 1 }] } },
		{ level: [3], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8El primer golpe inflige", "§r§8§u×<multiplier>§8 de daño 🗡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePrimer Golpe <roman>", quantity: 1 }] } },
		{ level: [4], color: "§6", rarity: "legendary", levelDescription: ["", "§r§8El primer golpe inflige", "§r§8§6×<multiplier>§8 de daño 🗡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePrimer Golpe <roman>", quantity: 1 }] } },
	] },

	// 3  Crítico — Type A, +5 DC / +2 PC per level
	{ id: 3, name: "Crítico", colorName: "§r§9", mainDescription: [
		"",
		"§8Mejora la habilidad de la espada",
		"§8para aumentar la probabilidad de",
		"§8asestar un §9golpe crítico 🎃",
		"§8porque solo de un golpe surge",
		"§8la muerte.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 8, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Daño Crítico: §t+<critdamage>", "§r§8Prob. Crítica: §t+<critchance>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCrítico <roman>", quantity: 1 }] } },
		{ level: [4, 5, 6], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Daño Crítico: §u+<critdamage>", "§r§8Prob. Crítica: §u+<critchance>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCrítico <roman>", quantity: 1 }] } },
		{ level: [7], color: "§6", rarity: "legendary", levelDescription: ["", "§r§8Daño Crítico: §6+<critdamage>", "§r§8Prob. Crítica: §6+<critchance>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCrítico <roman>", quantity: 1 }] } },
		{ level: [8], color: "§d", rarity: "mythic", levelDescription: ["", "§r§8Daño Crítico: §d+<critdamage>", "§r§8Prob. Crítica: §d+<critchance>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCrítico <roman>", quantity: 1 }] } },
	] },

	// 4  Aspecto Ígneo — Type C, fire 5s/level
	{ id: 4, name: "Aspecto Ígneo", colorName: "§r§6", mainDescription: [
		"",
		"§8El filo comenzará a emitir",
		"§8poderosas 🔥 que prenden",
		"§8en §vllamas§8 a tus enemigos.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Prende fuego al objetivo", "§r§8durante §t<duration>s 🔥", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAspecto Ígneo I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Prende fuego al objetivo", "§r§8durante §u<duration>s 🔥", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAspecto Ígneo II", quantity: 1 }] } },
		{ level: [3], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Prende fuego al objetivo", "§r§8durante §5<duration>s 🔥", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAspecto Ígneo III", quantity: 1 }] } },
	] },

	// 5  Castigo — Type B, ×0.1 mult vs undead/level
	{ id: 5, name: "Castigo", colorName: "§r§e", mainDescription: [
		"",
		"§8El exterminio de lo vivo esta",
		"§8de lado si su castigo es después de §ela",
		"§8§emuerte ⅜§8 con esta maldición.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Multiplicador §t×<multiplier>§8 extra", "§r§8contra no-muertos ☠", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCastigo <roman>", quantity: 1 }] } },
		{ level: [4, 5], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Multiplicador §5×<multiplier>§8 extra", "§r§8contra no-muertos ☠", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCastigo <roman>", quantity: 1 }] } },
	] },

	// 6  Perdición de los Artrópodos — Type B, ×0.1 vs arthropods/level
	{ id: 6, name: "Perdición de los Artrópodos", colorName: "§r§2", mainDescription: [
		"",
		"§8Letalidad concentrado que aniquila",
		"§8sin piedad a las más grandes",
		"§8criaturas §2artrópodas §8del mundo.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 8, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Multiplicador §t×<multiplier>§8 extra", "§r§8contra artrópodos", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePerdición de los Artrópodos <roman>", quantity: 1 }] } },
		{ level: [4, 5, 6], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Multiplicador §u×<multiplier>§8 extra", "§r§8contra artrópodos", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePerdición de los Artrópodos <roman>", quantity: 1 }] } },
		{ level: [7, 8], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Multiplicador §5×<multiplier>§8 extra", "§r§8contra artrópodos", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePerdición de los Artrópodos <roman>", quantity: 1 }] } },
	] },

	// 7  Discordancia — Type B, ×0.05 vs undead/level
	{ id: 7, name: "Discordancia", colorName: "§r§5", mainDescription: [
		"",
		"§8Ondas de energía caótica",
		"§8desestabilizan al objetivo,",
		"§8debilitando su §5esencia vital§8.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Multiplicador §t×<multiplier>§8 extra", "§r§8de debuff al golpear", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eDiscordancia I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Multiplicador §u×<multiplier>§8 extra", "§r§8de debuff al golpear", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eDiscordancia II", quantity: 1 }] } },
		{ level: [3], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Multiplicador §5×<multiplier>§8 extra", "§r§8de debuff al golpear", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eDiscordancia III", quantity: 1 }] } },
	] },

	// 8  Corte Veloz — Type C, 5% chance per level of 50% extra dmg
	{ id: 8, name: "Corte Veloz", colorName: "§r§b", mainDescription: [
		"",
		"§8Cuando la habilidad supera",
		"§8al sonido es entonces que",
		"§8un solo golpe parecer ser",
		"§8§bdos Ω§8.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 2, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8§t<chance>%§8 de probabilidad de", "§r§8infligir §b50%§8 de daño extra 🗡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCorte Veloz I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8§u<chance>%§8 de probabilidad de", "§r§8infligir §b50%§8 de daño extra 🗡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCorte Veloz II", quantity: 1 }] } },
	] },

	// 9  Oxidación — Type C, 60% poison, reduce dmg
	{ id: 9, name: "Oxidación", colorName: "§r§2", mainDescription: [
		"",
		"§8El filo se cubre de una capa",
		"§8de §2óxido tóxico 🧪§8 que",
		"§8envenena al contacto, pero",
		"§8corroe la propia hoja.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8§t<chance>%§8 de envenenar 🧪", "§r§8Reduce tu daño en §c-<damage>", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eOxidación I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8§u<chance>%§8 de envenenar 🧪", "§r§8Reduce tu daño en §c-<damage>", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eOxidación II", quantity: 1 }] } },
		{ level: [3], color: "§5", rarity: "epic", levelDescription: ["", "§r§8§5<chance>%§8 de envenenar 🧪", "§r§8Reduce tu daño en §c-<damage>", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eOxidación III", quantity: 1 }] } },
	] },

	// 10  Asesino del Fin — Type B, ×0.1 vs End creatures/level
	{ id: 10, name: "Asesino del Fin", colorName: "§r§5", mainDescription: [
		"",
		"§8Buscando cazar aquellas",
		"§8criaturas que escapan en un",
		"§8segundos §5ellos ¾§8 crearon",
		"el final y el inicio",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 7, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Multiplicador §t×<multiplier>§8 extra", "§r§8contra criaturas del End", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAsesino del Fin <roman>", quantity: 1 }] } },
		{ level: [4, 5], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Multiplicador §u×<multiplier>§8 extra", "§r§8contra criaturas del End", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAsesino del Fin <roman>", quantity: 1 }] } },
		{ level: [6, 7], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Multiplicador §5×<multiplier>§8 extra", "§r§8contra criaturas del End", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAsesino del Fin <roman>", quantity: 1 }] } },
	] },

	// 11  Saqueo — Type C, +3% drops/level
	{ id: 11, name: "Saqueo", colorName: "§r§e", mainDescription: [
		"",
		"§8La codicia guía cada golpe.",
		"§8Los enemigos caídos sueltan",
		"§8más §ebotín ⭐§8 de lo normal.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["sword"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Aumenta los drops de mobs", "§r§8en §t+<drops>% ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSaqueo <roman>", quantity: 1 }] } },
		{ level: [4, 5], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Aumenta los drops de mobs", "§r§8en §5+<drops>% ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSaqueo <roman>", quantity: 1 }] } },
	] },

	// 12  Lux — Type B, ×0.1 mult daytime/level
	{ id: 12, name: "Lux", colorName: "§r§e", mainDescription: [
		"",
		"§8La luz del §esol ☀§8 potencia",
		"§8cada golpe. Más efectivo bajo",
		"§8los cielos despejados del día.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Multiplicador §t×<multiplier>§8 extra", "§r§8durante el día ☀", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLux I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Multiplicador §u×<multiplier>§8 extra", "§r§8durante el día ☀", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLux II", quantity: 1 }] } },
		{ level: [3], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Multiplicador §5×<multiplier>§8 extra", "§r§8durante el día ☀", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLux III", quantity: 1 }] } },
	] },

	// 13  Nux — Type B, ×0.1 mult nighttime/level
	{ id: 13, name: "Nux", colorName: "§r§1", mainDescription: [
		"",
		"§8La §1oscuridad de la noche ☽§8",
		"§8potencia tu arma. Cada golpe",
		"§8bajo las estrellas es más letal.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Multiplicador §t×<multiplier>§8 extra", "§r§8durante la noche ☾", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eNux I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Multiplicador §u×<multiplier>§8 extra", "§r§8durante la noche ☾", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eNux II", quantity: 1 }] } },
		{ level: [3], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Multiplicador §5×<multiplier>§8 extra", "§r§8durante la noche ☾", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eNux III", quantity: 1 }] } },
	] },

	// 14  Verosimilitud — Type A, -35 Daño, ×0.5 mult
	{ id: 14, name: "Verosimilitud", colorName: "§r§c", mainDescription: [
		"",
		"§8El pacto de §cdesesperación 🗡§8.",
		"§8resta §c-35 de daño§8 a",
		"§8cambio de §6duplicar§8 el daño",
		"§8restante.",
		"",
		"§r§8Compatible: §7Espadas ⚔",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 1, compatible: ["sword"], levelsMenu: [
		{ level: [1], color: "§6", rarity: "legendary", levelDescription: ["", "§r§8Reduce tu §cdaño 🗡§8 en §c-<damage>§8 pts", "§r§8pero multiplica el resultado §6×2", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eVerosimilitud I", quantity: 1 }] } },
	] },

	// ═══════════════════════════════════════════════════
	// BOW (ids 15–25)
	// ═══════════════════════════════════════════════════

	// 15  Poder — Type A, +15 Daño/level
	{ id: 15, name: "Poder", colorName: "§r§4", mainDescription: [
		"",
		"§8Concentra energía pura en cada",
		"§8flecha, aumentando su §4poder ⅓§8",
		"§8de impacto de forma directa.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 10, compatible: ["bow"], levelsMenu: [
		{ level: [1, 2, 3], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §t+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePoder <roman>", quantity: 1 }] } },
		{ level: [4, 5, 6], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §u+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePoder <roman>", quantity: 1 }] } },
		{ level: [7, 8], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §5+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePoder <roman>", quantity: 1 }] } },
		{ level: [9, 10], color: "§d", rarity: "mythic", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §d+<damage>§8 puntos.", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePoder <roman>", quantity: 1 }] } },
	] },

	// 16  Llama — Type C, fire arrows
	{ id: 16, name: "Llama", colorName: "§r§v", mainDescription: [
		"",
		"§8Las flechas se encienden con",
		"§8§vllamas ardientes 🔥§8 que",
		"§8queman al impactar.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 2, compatible: ["bow"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Las flechas prenden fuego", "§r§8al objetivo 🔥", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLlama I", quantity: 1 }] } },
		{ level: [2], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Las flechas prenden fuego", "§r§8intenso al objetivo 🔥", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLlama II", quantity: 1 }] } },
	] },

	// 17  Golpe — Type C, knockback
	{ id: 17, name: "Golpe", colorName: "§r§b", mainDescription: [
		"",
		"§8Las flechas golpean con una",
		"§8fuerza §bexplosiva§8 que empuja",
		"§8al objetivo hacia atrás.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["bow"], levelsMenu: [
		{ level: [1], color: "§f", rarity: "common", levelDescription: ["", "§r§8Retroceso §fNivel <roman>§8 al", "§r§8impactar con flechas 🏹", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eGolpe I", quantity: 1 }] } },
		{ level: [2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Retroceso §tNivel <roman>§8 al", "§r§8impactar con flechas 🏹", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eGolpe II", quantity: 1 }] } },
		{ level: [3], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Retroceso §uNivel <roman>§8 al", "§r§8impactar con flechas 🏹", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eGolpe III", quantity: 1 }] } },
	] },

	// 18  Salvación — Type C, self-heal
	{ id: 18, name: "Salvación", colorName: "§r§m", mainDescription: [
		"",
		"§8Cada 3 flechas emite",
		"§8un poderoso §mrayo §8que atraviesa",
		"§8y termina con enemigos",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 4, compatible: ["bow"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Hace §t<percentage>%§8 del daño", "§r§8en un poderoso rayo ❤", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSalvación <roman>", quantity: 1 }] } },
		{ level: [3, 4], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Hace §5<percentage>%§8 del daño", "§r§8en un poderoso rayo ❤", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSalvación <roman>", quantity: 1 }] } },
	] },

	// 19  Sobrecarga — Type A*, variable +Daño by DC thresholds
	{ id: 19, name: "Sobrecarga", colorName: "§r§c", mainDescription: [
		"",
		"§8Tu §cDaño Crítico§8 se convierte",
		"§8en combustible. A mayor potencia",
		"§8crítica, más §cdaño bruto 🗡§8",
		"§8generan tus flechas.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["bow"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Por cada umbral de Daño Crítico,", "§r§8gana §t+5§8 Daño al arco 🏹", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSobrecarga <roman>", quantity: 1 }] } },
		{ level: [3, 4], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Por cada umbral de Daño Crítico,", "§r§8gana §5+5§8 Daño al arco 🏹", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSobrecarga <roman>", quantity: 1 }] } },
		{ level: [5], color: "§d", rarity: "mythic", levelDescription: ["", "§r§8Por cada umbral de Daño Crítico,", "§r§8gana §d+5§8 Daño al arco 🏹", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eSobrecarga <roman>", quantity: 1 }] } },
	] },

	// 20  Caprificación — Type C, 50% convert to goat
	{ id: 20, name: "Caprificación", colorName: "§r§q", mainDescription: [
		"",
		"§8Una magia peculiar que tiene",
		"§8un §q50%§8 de probabilidad de",
		"§8convertir al objetivo en una",
		"§8cabra durante §q5 minutos§8.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 1, compatible: ["bow"], levelsMenu: [
		{ level: [1], color: "§6", rarity: "legendary", levelDescription: ["", "§r§8§650%§8 de convertir al objetivo", "§r§8en cabra por §65 min§8 (CD: 5m)", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCaprificación I", quantity: 1 }] } },
	] },

	// 21  Obliteración — Type A*, +DC from excess PC
	{ id: 21, name: "Obliteración", colorName: "§r§4", mainDescription: [
		"",
		"§8Cuando tu §4Prob. Crítica§8 excede",
		"§8el 100%, la energía sobrante se",
		"§8transforma en §4Daño Crítico§8 puro.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["bow"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Por PC > 100%: convierte", "§r§8exceso en §t+DC§8 adicional", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eObliteración <roman>", quantity: 1 }] } },
		{ level: [3, 4], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Por PC > 100%: convierte", "§r§8exceso en §5+DC§8 adicional", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eObliteración <roman>", quantity: 1 }] } },
		{ level: [5], color: "§d", rarity: "mythic", levelDescription: ["", "§r§8Por PC > 100%: convierte", "§r§8exceso en §d+DC§8 adicional", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eObliteración <roman>", quantity: 1 }] } },
	] },

	// 22  Terminación — Type C, +1 extra arrow
	{ id: 22, name: "Terminación", colorName: "§r§v", mainDescription: [
		"",
		"§8Cada disparo libera una §vflecha",
		"§vadicional§8 que busca al",
		"§8mismo objetivo.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 1, compatible: ["bow"], levelsMenu: [
		{ level: [1], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Dispara §5+1§8 flecha adicional 🏹", "§r§8por cada disparo", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eTerminación I", quantity: 1 }] } },
	] },

	// 23  Artigeno — Type C, 4%/level poison I
	{ id: 23, name: "Artigeno", colorName: "§r§2", mainDescription: [
		"",
		"§8Las flechas se impregnan de una",
		"§8§2toxina sutil 🧪§8 que envenena",
		"§8gradualmente al objetivo.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["bow"], levelsMenu: [
		{ level: [1], color: "§f", rarity: "common", levelDescription: ["", "§r§8§f<chance>%§8 de envenenar 🧪", "§r§8con Veneno I al impactar", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eArtigeno I", quantity: 1 }] } },
		{ level: [2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8§t<chance>%§8 de envenenar 🧪", "§r§8con Veneno I al impactar", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eArtigeno II", quantity: 1 }] } },
		{ level: [3], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8§u<chance>%§8 de envenenar 🧪", "§r§8con Veneno I al impactar", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eArtigeno III", quantity: 1 }] } },
	] },

	// 24  Magmatismo — Type B, ignores 5% Def/level
	{ id: 24, name: "Magmatismo", colorName: "§r§6", mainDescription: [
		"",
		"§8Las flechas se envuelven en §vlava",
		"§8§vfundida 🔥§8 capaz de atravesar",
		"§8parcialmente las defensas enemigas.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 4, compatible: ["bow"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Ignora §t<percentage>%§8 de la", "§r§8Defensa 🛡 del objetivo", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eMagmatismo <roman>", quantity: 1 }] } },
		{ level: [3, 4], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Ignora §5<percentage>%§8 de la", "§r§8Defensa 🛡 del objetivo", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eMagmatismo <roman>", quantity: 1 }] } },
	] },

	// 25  Tormenta — Type A, +24 Daño/level
	{ id: 25, name: "Tormenta", colorName: "§r§1", mainDescription: [
		"",
		"§8Un rayo atraviesa cada flecha,",
		"§8otorgándole un §1poder devastador",
		"§8⚡§8 que electrifica a los enemigos.",
		"",
		"§r§8Compatible: §7Arcos 🏹",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["bow"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §t+<damage>§8 puntos ⚡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eTormenta I", quantity: 1 }] } },
		{ level: [2], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §5+<damage>§8 puntos ⚡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eTormenta II", quantity: 1 }] } },
		{ level: [3], color: "§d", rarity: "mythic", levelDescription: ["", "§r§8Aumenta el §cdaño 🏹§8 del arco", "§r§8en §d+<damage>§8 puntos ⚡", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eTormenta III", quantity: 1 }] } },
	] },

	// ═══════════════════════════════════════════════════
	// ARMOR (ids 26–27), shared across armor/helmet/boots
	// ═══════════════════════════════════════════════════

	// 26  Protección — Type B, -4% dam/level
	{ id: 26, name: "Protección", colorName: "§r§a", mainDescription: [
		"",
		"§8Un aura protectora envuelve al",
		"§8portador, reduciendo el §adaño",
		"§7recibido 🛡§8 de la mayoría",
		"§8de fuentes.",
		"",
		"§r§8Compatible: §7Armaduras 🛡",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 6, compatible: ["armor", "helmet", "boots"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Reduce el daño recibido 🛡", "§r§8en un §t<percentage>%", "", "§r<rarity>", "", "<action>"], requirement: { scores: [{ objective: "Nivel", operator: ">=", int: 10 }], items: [{ name: "§r§eProtección I", quantity: 1 }] } },
		{ level: [2, 3, 4], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Reduce el daño recibido 🛡", "§r§8en un §u<percentage>%", "", "§r<rarity>", "", "<action>"], requirement: { scores: [{ objective: "Nivel", operator: ">=", int: 20 }], items: [{ name: "§r§6Protección <roman>", quantity: 1 }] } },
		{ level: [5, 6], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Reduce el daño recibido 🛡", "§r§8en un §5<percentage>%", "", "§r<rarity>", "", "<action>"], requirement: { scores: [{ objective: "Nivel", operator: ">=", int: 30 }], items: [{ name: "§r§6Protección <roman>", quantity: 1 }] } },
	] },

	// 27  Rejuvenecimiento — Type C, passive regen
	{ id: 27, name: "Rejuvenecimiento", colorName: "§r§c", mainDescription: [
		"",
		"§8La §cvida ❦§8 fluye lentamente",
		"§8hacia el portador, sanando",
		"§8heridas con el paso del tiempo.",
		"",
		"§r§8Compatible: §7Armaduras 🛡",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["armor", "helmet", "boots"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Regeneración pasiva de", "§r§8§t<percentage>%§8 vida/s ❤", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eRejuvenecimiento <roman>", quantity: 1 }] } },
		{ level: [3, 4], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Regeneración pasiva de", "§r§8§u<percentage>%§8 vida/s ❤", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eRejuvenecimiento <roman>", quantity: 1 }] } },
		{ level: [5], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Regeneración pasiva de", "§r§8§5<percentage>%§8 vida/s ❤", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eRejuvenecimiento <roman>", quantity: 1 }] } },
	] },

	// ═══════════════════════════════════════════════════
	// HELMET (ids 28–29)
	// ═══════════════════════════════════════════════════

	// 28  Afinidad acuática — Type C
	{ id: 28, name: "Afinidad acuática", colorName: "§r§b", mainDescription: [
		"",
		"§8Mejora la velocidad de minería",
		"§8§bbajo el agua 🌊§8, como si",
		"§8estuvieras en tierra firme.",
		"",
		"§r§8Compatible: §7Cascos",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 1, compatible: ["helmet"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Minería bajo el agua 🌊", "§r§8a velocidad normal", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eAfinidad acuática I", quantity: 1 }] } },
	] },

	// 29  Respiración — Type C
	{ id: 29, name: "Respiración", colorName: "§r§b", mainDescription: [
		"",
		"§8Extiende el tiempo que puedes",
		"§8permanecer §bbajo el agua 🌊§8",
		"§8antes de ahogarte.",
		"",
		"§r§8Compatible: §7Cascos",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["helmet"], levelsMenu: [
		{ level: [1], color: "§f", rarity: "common", levelDescription: ["", "§r§8+§f<duration>s§8 de respiración", "§r§8bajo el agua 🌊", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eRespiración I", quantity: 1 }] } },
		{ level: [2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8+§t<duration>s§8 de respiración", "§r§8bajo el agua 🌊", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eRespiración II", quantity: 1 }] } },
		{ level: [3], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8+§u<duration>s§8 de respiración", "§r§8bajo el agua 🌊", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eRespiración III", quantity: 1 }] } },
	] },

	// ═══════════════════════════════════════════════════
	// BOOTS (ids 30–31)
	// ═══════════════════════════════════════════════════

	// 30  Caída de pluma — Type C
	{ id: 30, name: "Caída de pluma", colorName: "§r§f", mainDescription: [
		"",
		"§8Amortigua las caídas como si",
		"§8una §fpluma 😑§8 guiara tus pasos,",
		"§8reduciendo el daño por impacto.",
		"",
		"§r§8Compatible: §7Botas",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 12, compatible: ["boots"], levelsMenu: [
		{ level: [1, 2, 3, 4], color: "§f", rarity: "common", levelDescription: ["", "§r§8Reduce daño de caída", "§r§8en §f<percentage>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCaída de pluma <roman>", quantity: 1 }] } },
		{ level: [5, 6, 7, 8], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Reduce daño de caída", "§r§8en §t<percentage>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCaída de pluma <roman>", quantity: 1 }] } },
		{ level: [9, 10, 11, 12], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Reduce daño de caída", "§r§8en §u<percentage>%", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCaída de pluma <roman>", quantity: 1 }] } },
	] },

	// 31  Lijereza — Type C, +5% speed/level
	{ id: 31, name: "Lijereza", colorName: "§r§f", mainDescription: [
		"",
		"§8Tus pasos se vuelven §fligeros ⌛§8,",
		"§8otorgándote mayor velocidad",
		"§8de movimiento.",
		"",
		"§r§8Compatible: §7Botas",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 2, compatible: ["boots"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8+§t<percentage>%§8 velocidad", "§r§8de movimiento", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLijereza I", quantity: 1 }] } },
		{ level: [2], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8+§u<percentage>%§8 velocidad", "§r§8de movimiento", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLijereza II", quantity: 1 }] } },
	] },

	// ═══════════════════════════════════════════════════
	// TOOLS (ids 32–37)
	// ═══════════════════════════════════════════════════

	// 32  Eficiencia — Special (vanilla enchant)
	{ id: 32, name: "Eficiencia", colorName: "§r§6", mainDescription: [
		"",
		"§8Mejora la §6velocidad de",
		"§6minado ⛏§8 de la herramienta.",
		"",
		"§r§8Compatible: §7Picos ⛏ Hachas 🪓 Azadas 🔪",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["pickaxe", "axe", "hoe"], levelsMenu: [
		{ level: [1, 2, 3], color: "§f", rarity: "common", levelDescription: ["", "§r§8Velocidad de minado ⛏", "§r§8§fNivel <roman>", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eEficiencia <roman>", quantity: 1 }] } },
		{ level: [4, 5], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Velocidad de minado ⛏", "§r§8§tNivel <roman>", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eEficiencia <roman>", quantity: 1 }] } },
	] },

	// 33  Fortuna — Type A, +50 Fortuna Minera/level
	{ id: 33, name: "Fortuna", colorName: "§r§a", mainDescription: [
		"",
		"§8La suerte te acompaña al minar.",
		"§8Cada bloque tiene más chance",
		"§8de §adropar recursos extra ¼§8.",
		"",
		"§r§8Compatible: §7Picos ⛏ Hachas 🪓 Azadas 🔪",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 5, compatible: ["pickaxe", "axe", "hoe"], levelsMenu: [
		{ level: [1, 2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Fortuna Minera: §t+<fortune> ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eFortuna <roman>", quantity: 1 }] } },
		{ level: [3, 4], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Fortuna Minera: §u+<fortune> ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eFortuna <roman>", quantity: 1 }] } },
		{ level: [5], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Fortuna Minera: §5+<fortune> ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eFortuna <roman>", quantity: 1 }] } },
	] },

	// 34  Prisa espontánea — Type C, 0.1% cumulative haste II
	{ id: 34, name: "Prisa espontánea", colorName: "§r§e", mainDescription: [
		"",
		"§8Al minar, existe una §epequeña",
		"§8probabilidad§8 de obtener un",
		"§8§eimpulso de velocidad ⅔§8 que",
		"§8se acumula con el tiempo.",
		"",
		"§r§8Compatible: §7Picos ⛏ Hachas 🪓",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 3, compatible: ["pickaxe", "axe"], levelsMenu: [
		{ level: [1], color: "§f", rarity: "common", levelDescription: ["", "§r§8§f<chance>%§8 acumulable por bloque", "§r§8para obtener Prisa II ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePrisa espontánea I", quantity: 1 }] } },
		{ level: [2], color: "§t", rarity: "rare", levelDescription: ["", "§r§8§t<chance>%§8 acumulable por bloque", "§r§8para obtener Prisa II ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePrisa espontánea II", quantity: 1 }] } },
		{ level: [3], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8§u<chance>%§8 acumulable por bloque", "§r§8para obtener Prisa II ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§ePrisa espontánea III", quantity: 1 }] } },
	] },

	// 35  Linaje — Type A*, converts Defense → Fortune
	{ id: 35, name: "Linaje", colorName: "§r§a", mainDescription: [
		"",
		"§8El legado ancestral de los",
		"§8mineros transforma parte de tu",
		"§8§7Defensa 🛡§8 en §6Fortuna ⛏§8.",
		"",
		"§r§8Compatible: §7Picos ⛏",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 2, compatible: ["pickaxe"], levelsMenu: [
		{ level: [1], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Convierte §tDefensa§8 en", "§r§8§tFortuna Minera ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLinaje I", quantity: 1 }] } },
		{ level: [2], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Convierte §5Defensa§8 en", "§r§8§5Fortuna Minera ⛏", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eLinaje II", quantity: 1 }] } },
	] },

	// 36  Convicción — Type A, +5 all fortunes/level
	{ id: 36, name: "Convicción", colorName: "§r§a", mainDescription: [
		"",
		"§8La fe inquebrantable del artesano",
		"§8bendice todas las §afortunas 🔔§8",
		"§8de la herramienta por igual.",
		"",
		"§r§8Compatible: §7Picos ⛏ Hachas 🪓 Azadas",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 12, compatible: ["pickaxe", "axe", "hoe"], levelsMenu: [
		{ level: [1, 2, 3, 4], color: "§f", rarity: "common", levelDescription: ["", "§r§8Todas las fortunas: §f+<fortuneall> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eConvicción <roman>", quantity: 1 }] } },
		{ level: [5, 6, 7, 8], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Todas las fortunas: §t+<fortuneall> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eConvicción <roman>", quantity: 1 }] } },
		{ level: [9, 10, 11, 12], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Todas las fortunas: §5+<fortuneall> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eConvicción <roman>", quantity: 1 }] } },
	] },

	// 37  Cultivador — Type A, +20 Fortuna de Cosecha/level
	{ id: 37, name: "Cultivador", colorName: "§r§a", mainDescription: [
		"",
		"§8Manos bendecidas por la tierra.",
		"§8Cada cosecha produce más §afrutos",
		"§8✂ gracias a tu conexión con",
		"§8la naturaleza.",
		"",
		"§r§8Compatible: §7Azadas 🔪",
		"",
		"§r§eClic para ver niveles",
	], maxLevel: 10, compatible: ["hoe"], levelsMenu: [
		{ level: [1, 2, 3], color: "§f", rarity: "common", levelDescription: ["", "§r§8Fortuna de Cosecha:", "§r§8§f+<fortunecrop> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCultivador <roman>", quantity: 1 }] } },
		{ level: [4, 5, 6], color: "§t", rarity: "rare", levelDescription: ["", "§r§8Fortuna de Cosecha:", "§r§8§t+<fortunecrop> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCultivador <roman>", quantity: 1 }] } },
		{ level: [7, 8, 9], color: "§u", rarity: "very_rare", levelDescription: ["", "§r§8Fortuna de Cosecha:", "§r§8§u+<fortunecrop> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCultivador <roman>", quantity: 1 }] } },
		{ level: [10], color: "§5", rarity: "epic", levelDescription: ["", "§r§8Fortuna de Cosecha:", "§r§8§5+<fortunecrop> ⭐", "", "§r<rarity>", "", "<action>"], requirement: { items: [{ name: "§r§eCultivador <roman>", quantity: 1 }] } },
	] },
];
