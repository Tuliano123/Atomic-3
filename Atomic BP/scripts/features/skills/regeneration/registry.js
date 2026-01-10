// Registro de bloques por skill
// Responsabilidad: resolver blockTypeId -> definición normalizada (exact/prefix/any).

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

function normalizeSkill(value) {
	const s = normalizeString(value);
	return s ? s.toLowerCase() : "";
}

function normalizeBlockMatch(value) {
	const raw = normalizeString(value);
	if (!raw) return null;
	if (raw === "*") return { kind: "any", value: "*" };
	const hasStar = raw.includes("*");
	if (hasStar) {
		// Caso simple: prefijo*
		if (raw.endsWith("*") && raw.indexOf("*") === raw.length - 1) {
			const prefix = raw.slice(0, -1);
			return { kind: "prefix", value: prefix };
		}
		// Caso general: glob con '*' en cualquier posición (ej: "minecraft:*_log")
		return { kind: "glob", value: raw, regex: compileGlobToRegExp(raw) };
	}
	return { kind: "exact", value: raw };
}

function compileGlobToRegExp(glob) {
	const src = String(glob != null ? glob : "");
	// Escapa todo excepto '*', luego lo convierte a '.*'
	const parts = src.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = `^${parts.join(".*")}$`;
	try {
		return new RegExp(pattern);
	} catch (e) {
		void e;
		// Fallback: si el patrón es inválido, forzamos no-match.
		return /^$/;
	}
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

function normalizeScoreboardAdds(value) {
	if (!value || typeof value !== "object") return null;
	/** @type {Record<string, number>} */
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		const obj = String(k != null ? k : "").trim();
		const delta = Number(v);
		if (!obj) continue;
		if (!Number.isFinite(delta) || delta === 0) continue;
		out[obj] = Math.trunc(delta);
	}
	return Object.keys(out).length ? out : null;
}

function normalizeModifierEntry(value) {
	if (!value || typeof value !== "object") return null;
	const match = Array.isArray(value.match) ? value.match.filter((x) => typeof x === "string") : [];
	const priority = Number.isFinite(Number(value.priority)) ? Number(value.priority) : 0;
	const modeRaw = String(value.mode != null ? value.mode : "override").toLowerCase();
	const mode = modeRaw === "add" ? "add" : "override";
	const drops = Array.isArray(value.drops) ? value.drops : undefined;
	const scoreboardAddsOnBreak = normalizeScoreboardAdds(value.scoreboardAddsOnBreak);

	return {
		match,
		priority,
		mode,
		...(drops ? { drops } : null),
		...(scoreboardAddsOnBreak ? { scoreboardAddsOnBreak } : null),
	};
}

function normalizeModifiersObject(value) {
	if (!value || typeof value !== "object") return undefined;
	/** @type {Record<string, any>} */
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		const key = String(k != null ? k : "").trim();
		if (!key) continue;
		const norm = normalizeModifierEntry(v);
		if (!norm) continue;
		out[key] = norm;
	}
	return Object.keys(out).length ? out : undefined;
}

/**
 * Normaliza una definición de mineral para que el runtime no tenga que hacer checks repetidos.
 * @param {any} oreDef
 * @param {any} config
 */
export function normalizeBlockDefinition(blockDef, config) {
	const id = normalizeString(blockDef && blockDef.id);
	// Compat: configs antiguas (ores) no tenían skill; asumimos "mining" si no se define.
	const skill = normalizeSkill(blockDef && blockDef.skill) || normalizeSkill(config && config.defaultSkill) || "mining";

	// Compat: aceptar oreBlockId como equivalente a blockId exacto
	const blockIdRaw = normalizeString(blockDef && (blockDef.blockId ?? blockDef.oreBlockId));
	const match = normalizeBlockMatch(blockIdRaw || "");
	if (!id || !match || !skill) return null;

	const ticksPerSecond = toNumberOr(config && config.ticksPerSecond, 20);
	const regenSeconds = clamp(toNumberOr(blockDef && blockDef.regenSeconds, 60), 1, 60 * 60 * 24);
	const minedBlockId =
		normalizeString(blockDef && blockDef.minedBlockId) || normalizeString(config && config.defaultMinedBlockId) || "minecraft:black_concrete";

	// Sonidos:
	// - Nuevo: oreDef.sounds: Array<{id, volume?, pitch?}>
	// - Legacy soportado: oreDef.sound (string) o oreDef.sounds (string[])
	const sounds = normalizeSoundsList(blockDef && (blockDef.sounds ?? blockDef.sound));
	const xpOrbs = normalizeXpOrbs(blockDef && blockDef.xpOrbs);
	const particlesOnSilkTouch = normalizeParticlesOnSilkTouch(blockDef && blockDef.particlesOnSilkTouch);
	const scoreboardAddsOnBreak = normalizeScoreboardAdds(blockDef && blockDef.scoreboardAddsOnBreak);

	const drops = Array.isArray(blockDef && blockDef.drops) ? blockDef.drops : [];
	const modifiers = normalizeModifiersObject(blockDef && blockDef.modifiers);

	return {
		id,
		skill,
		match,
		// Guardamos blockId exacto si aplica (útil para persistencia y debug)
		blockId: match.kind === "exact" ? match.value : null,
		regenSeconds,
		regenTicks: Math.max(1, Math.floor(regenSeconds * ticksPerSecond)),
		minedBlockId,
		sounds,
		xpOrbs,
		particlesOnSilkTouch,
		scoreboardAddsOnBreak,
		drops,
		modifiers,
	};
}

/**
 * Construye un Map oreBlockId -> oreDef normalizado.
 * @param {any} config
 */
export function buildBlockRegistry(config) {
	/** @type {Map<string, any>} */
	const exact = new Map();
	/** @type {any[]} */
	const patterns = [];
	// Compat: aceptar config.ores (legacy) además de config.blocks
	const blocks = Array.isArray(config && config.blocks)
		? config.blocks
		: Array.isArray(config && config.ores)
			? config.ores
			: [];

	for (const b of blocks) {
		const norm = normalizeBlockDefinition(b, config);
		if (!norm) continue;
		if (norm.match.kind === "exact") exact.set(norm.match.value, norm);
		else patterns.push(norm);
	}
	return { exact, patterns };
}

/**
 * Helper DX: obtiene definición por blockTypeId.
 * @param {Map<string, any>} registry
 * @param {string} blockTypeId
 */
export function getBlockDefinition(registry, blockTypeId) {
	if (!registry || typeof registry !== "object") return null;
	const key = String(blockTypeId != null ? blockTypeId : "");
	const exact = registry.exact;
	if (exact && exact instanceof Map) {
		const hit = exact.get(key);
		if (hit) return hit;
	}
	const patterns = Array.isArray(registry.patterns) ? registry.patterns : [];
	for (const def of patterns) {
		const m = def && def.match;
		if (!m) continue;
		if (m.kind === "any") return def;
		if (m.kind === "prefix" && typeof m.value === "string" && key.startsWith(m.value)) return def;
		if (m.kind === "glob" && m.regex && typeof m.regex.test === "function" && m.regex.test(key)) return def;
	}
	return null;
}
