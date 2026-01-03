// Config del sistema de minerales regenerables.
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
 * }} OreModifier
 *
 * @typedef {{
 *  id: string,
 *  oreBlockId: string,
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
 *  drops: DropEntryTuple[],
 *  modifiers?: Record<string, OreModifier>
 * }} OreDefinition
 */

export const miningRegenConfig = {
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

	// Minerales: define aquí los bloques objetivo.
	/** @type {OreDefinition[]} */
	ores: [
		// MVP: carbón regenerable
		{
			id: "coal",
			oreBlockId: "minecraft:coal_ore",
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
					drops: [[1, "minecraft:coal", 2, 6, 85, "§jCarbón", ["§7Fortuna III"]]],
				},
			},
		}
	],
};
