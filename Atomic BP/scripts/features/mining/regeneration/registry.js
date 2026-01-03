// Registro de minerales
// Responsabilidad: mapear oreBlockId -> definición normalizada.

function toNumberOr(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function normalizeString(value) {
	return String(value != null ? value : "").trim();
}

function normalizeSoundEntry(value) {
	// Nuevo formato recomendado: { id, volume?, pitch? }
	if (value && typeof value === "object") {
		const id = normalizeString(value.id);
		if (!id) return null;
		const volumeRaw = value.volume;
		const pitchRaw = value.pitch;
		const volume = Number.isFinite(Number(volumeRaw)) ? clamp(Number(volumeRaw), 0, 4) : 1;
		const pitch = Number.isFinite(Number(pitchRaw)) ? clamp(Number(pitchRaw), 0, 2) : 1;
		return { id, volume, pitch };
	}

	// Legacy: string
	if (typeof value === "string") {
		const id = normalizeString(value);
		return id ? { id, volume: 1, pitch: 1 } : null;
	}

	return null;
}

function normalizeSoundsList(value) {
	if (value == null) return [];
	if (Array.isArray(value)) {
		return value.map(normalizeSoundEntry).filter((v) => v && v.id);
	}
	// Legacy: sound: "..."
	const single = normalizeSoundEntry(value);
	return single ? [single] : [];
}

function normalizeXpOrbs(value) {
	if (!value || typeof value !== "object") return null;
	const min = Number(value.min);
	const max = Number(value.max);
	const chance = Number(value.chance);

	if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(chance)) return null;
	const minC = clamp(Math.floor(min), 0, 100000);
	const maxC = clamp(Math.floor(max), 0, 100000);
	const chanceC = clamp(chance, 0, 100);
	return {
		min: Math.min(minC, maxC),
		max: Math.max(minC, maxC),
		chance: chanceC,
	};
}

function normalizeVec3(value, fallback) {
	if (!value || typeof value !== "object") return fallback;
	const x = Number(value.x);
	const y = Number(value.y);
	const z = Number(value.z);
	return {
		x: Number.isFinite(x) ? x : fallback.x,
		y: Number.isFinite(y) ? y : fallback.y,
		z: Number.isFinite(z) ? z : fallback.z,
	};
}

function normalizeParticlesOnSilkTouch(value) {
	if (!value || typeof value !== "object") return null;
	const fn = value.fn;
	if (typeof fn !== "function") return null;
	return {
		fn,
		offset: normalizeVec3(value.offset, { x: 0.5, y: 0.5, z: 0.5 }),
		options: value.options,
	};
}

/**
 * Normaliza una definición de mineral para que el runtime no tenga que hacer checks repetidos.
 * @param {any} oreDef
 * @param {any} config
 */
export function normalizeOreDefinition(oreDef, config) {
	const id = normalizeString(oreDef && oreDef.id);
	const oreBlockId = normalizeString(oreDef && oreDef.oreBlockId);
	if (!id || !oreBlockId) return null;

	const ticksPerSecond = toNumberOr(config && config.ticksPerSecond, 20);
	const regenSeconds = clamp(toNumberOr(oreDef && oreDef.regenSeconds, 60), 1, 60 * 60 * 24);
	const minedBlockId = normalizeString(oreDef && oreDef.minedBlockId) || normalizeString(config && config.defaultMinedBlockId) || "minecraft:black_concrete";

	// Sonidos:
	// - Nuevo: oreDef.sounds: Array<{id, volume?, pitch?}>
	// - Legacy soportado: oreDef.sound (string) o oreDef.sounds (string[])
	const sounds = normalizeSoundsList(oreDef && (oreDef.sounds ?? oreDef.sound));
	const xpOrbs = normalizeXpOrbs(oreDef && oreDef.xpOrbs);
	const particlesOnSilkTouch = normalizeParticlesOnSilkTouch(oreDef && oreDef.particlesOnSilkTouch);

	const drops = Array.isArray(oreDef && oreDef.drops) ? oreDef.drops : [];
	const modifiers = oreDef && oreDef.modifiers && typeof oreDef.modifiers === "object" ? oreDef.modifiers : undefined;

	return {
		id,
		oreBlockId,
		regenSeconds,
		regenTicks: Math.max(1, Math.floor(regenSeconds * ticksPerSecond)),
		minedBlockId,
		sounds,
		xpOrbs,
		particlesOnSilkTouch,
		drops,
		modifiers,
	};
}

/**
 * Construye un Map oreBlockId -> oreDef normalizado.
 * @param {any} config
 */
export function buildOreRegistry(config) {
	/** @type {Map<string, any>} */
	const map = new Map();
	const ores = Array.isArray(config && config.ores) ? config.ores : [];
	for (const ore of ores) {
		const norm = normalizeOreDefinition(ore, config);
		if (!norm) continue;
		map.set(norm.oreBlockId, norm);
	}
	return map;
}

/**
 * Helper DX: obtiene definición por blockTypeId.
 * @param {Map<string, any>} registry
 * @param {string} blockTypeId
 */
export function getOreDefinition(registry, blockTypeId) {
	if (!registry || !(registry instanceof Map)) return null;
	const key = String(blockTypeId != null ? blockTypeId : "");
	return registry.get(key) || null;
}
