// Config del sistema de regeneración de bloques (global para skills).
// Nota: este archivo es SOLO datos (sin lógica), para mantener responsabilidades separadas.

// import { spawnEndrodStarHorizontal } from "./particles.js";

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 * @typedef {{ dimensionId: string, min: Vec3, max: Vec3 }} RegenArea
 *
 * DropEntryTuple:
 * [dropId, itemId, minQty, maxQty, chancePct, nameTag, lore]
 * - lore puede ser string o string[]
 *
 * @typedef {[number|string, string, number, number, number, (string|null|undefined), (string|string[]|null|undefined)]} DropEntryTuple
 *
 * @typedef {{
 *  match: string[],
 *  priority: number,
 *  mode: "override"|"add",
 *  drops?: DropEntryTuple[],
 *  // Métricas extra si este modifier aplica (scoreboard players add)
 *  scoreboardAddsOnBreak?: Record<string, number>,
 * }} OreModifier
 *
 * @typedef {{
 *  id: string,
 *  // Identificador de skill asociada al bloque (ej: "mining", "farming", "foraging", ...)
 *  skill: string,
 *  // Nuevo (recomendado):
 *  // - exacto: "minecraft:coal_ore"
 *  // - todos: "*" (match any)
 *  // - prefijo: "minecraft:*" (match prefix)
 *  blockId?: string,
 *  // Compat (legacy): oreBlockId (equivalente a blockId exacto)
 *  oreBlockId?: string,
 *  regenSeconds?: number,
 *  minedBlockId?: string,
 *  // Sonidos a reproducir al minar (opcional)
 *  // - sounds: se intentan reproducir TODOS en el mismo tick
 *  // - volumen/pitch permiten ajustar intensidad
 *  sounds?: Array<{ id: string, volume?: number, pitch?: number }>,
 *  // XP (orbes) a spawnear al minar (opcional)
 *  // - chance: 0..100 (si falla, no spawnea)
 *  // - min/max: rango inclusivo de orbes a spawnear si pasa el chance
 *  xpOrbs?: { min: number, max: number, chance: number },
 *  // Partículas al minar con Silk Touch (opcional)
 *  // - fn: función importada desde particles.js
 *  // - offset: relativo al bloque minado (0.5,0.5,0.5 => centro del bloque)
 *  // - options: parámetros específicos de la función
 *  particlesOnSilkTouch?: { fn: Function, offset?: Vec3, options?: any },
 *  // Métricas por-mineral (scoreboard players add)
 *  // - Se suma a las métricas globales (si están activas)
 *  // - Formato: { "OBJETIVO": numeroAAgregar }
 *  scoreboardAddsOnBreak?: Record<string, number>,
 *  drops: DropEntryTuple[],
 *  modifiers?: Record<string, OreModifier>
 * }} BlockDefinition
 */

export const skillRegenConfig = {
	// Modo del feature:
	// - "dev": permite debug (console/tellPlayer/traceBreak)
	// - "prod": fuerza debug OFF aunque debug.enabled=true
	mode: "dev",
	// Alias por compatibilidad (si prefieres boolean)
	production: false,

	// Flag master
	enabled: true,

	// Diagnóstico para la primera prueba (no afecta gameplay si console=false)
	debug: {
		enabled: true,
		console: true,
		// Si lo activas, manda mensajes al jugador al minar (no recomendado en producción)
		tellPlayer: true,
		// Traza: manda info del bloque detectado en cada intento de minado dentro de áreas
		traceBreak: true,
	},

	// Métricas (scoreboard players add)
	// - scoreboardAddsOnBreak: { "OBJETIVO": numeroAAgregar }
	// - Se aplica cuando el sistema procesa un minado válido (área + ore registrado + no creative)
	metrics: {
		enabled: false,
		scoreboardAddsOnBreak: {
			// "TEST": 1,
			// "BLOQUES": 1,
		},
	},

	// Usado para convertir segundos -> ticks. En Bedrock normalmente 20.
	ticksPerSecond: 20,

	// mined-state global (puede ser sobre-escrito por mineral)
	defaultMinedBlockId: "minecraft:black_concrete",

	// Áreas donde aplica el sistema (AABB inclusivo)
	/** @type {RegenArea[]} */
	areas: [
		// MVP de prueba: área amplia en el overworld.
		// Ajusta estos valores a tu mina para producción.
		{
			dimensionId: "minecraft:overworld",
			min: { x: -5000, y: -64, z: -5000 },
			max: { x: 5000, y: 320, z: 5000 },
		},
	],

	// Persistencia (dynamic properties)
	persistence: {
		// Key del mundo para guardar pendientes (JSON)
		key: "atomic3:mining_regen_pending",
		// Longitud máxima del string guardado (limita tamaño del JSON).
		// Si crece mucho, se recorta en runtime para no romper DP.
		maxStringLength: 30000,
		// Límite duro de entries guardadas (protege del crecimiento infinito)
		maxEntries: 1500,
		// Batches al cargar mundo (evita picos)
		loadBatchSize: 50,
		loadBatchDelayTicks: 1,
	},

	// Bloques: define aquí lo que aplica a cada skill.
	/** @type {BlockDefinition[]} */
	blocks: [
		// MVP: carbón regenerable (skill: mining)
		{
			id: "coal",
			skill: "mining",
			blockId: "minecraft:coal_ore",
			// Métrica específica: al minar carbón suma 1 al objective CARBON
			scoreboardAddsOnBreak: {
				CARBON: 1,
			},
			regenSeconds: 60,
			// Sonidos: se reproducen TODOS
			sounds: [
				{ id: "dig.stone", volume: 1, pitch: 1 },
				// Ejemplo extra: agrega otro si quieres validar simultáneo
				// { id: "random.pop", volume: 1, pitch: 1 },
			],
			// XP (orbes) de prueba
			xpOrbs: { min: 1, max: 3, chance: 100 },
			// Partículas de prueba: solo al minar con Silk Touch
				// particlesOnSilkTouch: {
				// 	fn: spawnEndrodStarHorizontal,
				// 	// Pegado a la cara superior del bloque (y = +1) con un pequeño extra.
				// 	offset: { x: 0.5, y: 1.02, z: 0.5 },
				// 	// Contorno punteado (menos partículas)
				// 	options: { size: 0.35, pointsPerEdge: 12, pointStep: 4, particleId: "minecraft:endrod" },
				// },
			// minedBlockId opcional: si lo omites usa defaultMinedBlockId
			// minedBlockId: "minecraft:black_concrete",
			drops: [
				// Ejemplo base (sin fortuna): 50% 1-2 carbón
				[1, "minecraft:coal", 1, 2, 30, "§jCarbón", ["§7Mineral regenerable"]],
				// Drop extra raro: 10% 1 pepita de hierro (solo para probar  tabla)
				[2, "minecraft:iron_nugget", 1, 1, 70, "§fPepita", ["§7Drop de prueba"]],
			],
			modifiers: {
				// Silk Touch: reemplaza por el bloque (para comprobar override)
				silk_touch_1: {
					match: ["silk touch i", "toque de seda i"],
					priority: 100,
					mode: "override",
					drops: [[1, "minecraft:coal_ore", 1, 1, 100, "§8Carbón (Silk)", ["§7Toque de seda"]]],
				},

				// Fortuna (override): aumenta cantidades y chance
				fortune_1: {
					match: ["fortuna i", "fortune i"],
					priority: 10,
					mode: "override",
					drops: [[1, "minecraft:coal", 1, 3, 65, "§jCarbón", ["§7Fortuna I"]]],
				},
				fortune_2: {
					match: ["fortuna ii", "fortune ii"],
					priority: 20,
					mode: "override",
					drops: [[1, "minecraft:coal", 2, 4, 75, "§jCarbón", ["§7Fortuna II"]]],
				},
				fortune_3: {
					match: ["fortuna iii", "fortune iii"],
					priority: 30,
					mode: "override",
					// Ejemplo: bonus extra SOLO con fortuna III
					scoreboardAddsOnBreak: {
						DINERO: 2,
					},
					drops: [[1, "minecraft:coal", 2, 6, 85, "§jCarbón", ["§7Fortuna III"]]],
				},
			},
		}
		,
		// TEST: tronco de roble (skill: foraging)
		{
			id: "oak log",
			skill: "foraging",
			blockId: "minecraft:oak_log",
			// mined-state específico para este bloque
			minedBlockId: "minecraft:brown_terracotta",
			regenSeconds: 15,
			sounds: [{ id: "dig.wood", volume: 1, pitch: 1 }],
			scoreboardAddsOnBreak: {
				TRONCOS: 1,
			},
			drops: [
				[1, "minecraft:oak_log", 1, 1, 50, "MaderaTest", ["Madera."]],
				[2, "minecraft:oak_leaves", 1, 3, 33, "Hojitas", ["hojita :D"]],
			],
			modifiers: {
				// Silk Touch: para testear override
				silk_touch_1: {
					match: ["silk touch i", "toque de seda i"],
					priority: 100,
					mode: "override",
					drops: [[1, "minecraft:oak_log", 1, 1, 100, "MaderaTest (Silk)", ["§7Test: Silk Touch"]]],
				},
				// Fortuna: para testear otra tabla
				fortune_1: {
					match: ["fortuna i", "fortune i"],
					priority: 10,
					mode: "override",
					drops: [
						[1, "minecraft:oak_log", 1, 2, 65, "MaderaTest", ["§7Test: Fortune I"]],
						[2, "minecraft:oak_leaves", 1, 4, 40, "Hojitas", ["§7Test: Fortune I"]],
					],
				},
			},
		},

		// TEST: cultivo de zanahoria (skill: farming)
		{
			id: "carrots",
			skill: "farming",
			blockId: "minecraft:carrots",
			// mined-state específico: queremos que quede vacío mientras regenera
			// Si por versión `minecraft:air` no se puede setear, usa "minecraft:structure_void".
			minedBlockId: "minecraft:air",
			regenSeconds: 12,
			sounds: [{ id: "dig.grass", volume: 0.8, pitch: 1.1 }],
			scoreboardAddsOnBreak: {
				ZANAHORIAS: 1,
			},
			// Sin xpOrbs (omitido a propósito)
			drops: [
				[1, "minecraft:carrot", 1, 3, 80, "Zanahoria", ["§7Test crop"]],
				[2, "minecraft:bone_meal", 1, 1, 15, "Fertilizante", ["§7Test crop"]],
			],
			modifiers: {
				// "Cosecha I": modo add para testear stacking
				harvest_1: {
					match: ["cosecha i", "harvest i"],
					priority: 10,
					mode: "add",
					drops: [[99, "minecraft:carrot", 1, 1, 100, "Bonus", ["§7Test: +1"]]],
				},
				// Silk Touch: override (solo test)
				silk_touch_1: {
					match: ["silk touch i", "toque de seda i"],
					priority: 100,
					mode: "override",
					drops: [[1, "minecraft:carrot", 1, 1, 100, "Zanahoria (Silk)", ["§7Test: Silk Touch"]]],
				},
			},
		},
	],
};

// Compat: mantener nombres antiguos si otras partes del addon los usan
export const miningRegenConfig = skillRegenConfig;
