// Validación de config (modo diagnóstico)
// Responsabilidad: detectar errores típicos de configuración sin romper el runtime.

function isObj(v) {
	return v != null && typeof v === "object";
}

function asStr(v) {
	return String(v != null ? v : "").trim();
}

function asNum(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function isStringArray(v) {
	return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isSoundObj(v) {
	return isObj(v) && typeof v.id === "string";
}

function isSoundObjArray(v) {
	return Array.isArray(v) && v.every((x) => isSoundObj(x));
}

function isFiniteNumber(v) {
	return Number.isFinite(Number(v));
}

function validateScoreboardAddsObject(adds, label, warnings) {
	if (adds == null) return;
	if (!isObj(adds)) {
		warnings.push(`${label}: scoreboardAddsOnBreak debería ser un objeto {OBJ: number}`);
		return;
	}
	for (const [k, v] of Object.entries(adds)) {
		const obj = asStr(k);
		if (!obj) warnings.push(`${label}: scoreboardAddsOnBreak contiene un objetivo vacío`);
		if (!isFiniteNumber(v)) warnings.push(`${label}: scoreboardAddsOnBreak['${obj || "?"}'] debería ser numérico`);
	}
}

/**
 * @param {any} config
 * @returns {{ warnings: string[], errors: string[] }}
 */
export function validateMiningRegenConfig(config) {
	return validateSkillRegenConfig(config);
}

/**
 * Valida la config del sistema de regeneración (global para skills).
 * Compat: acepta config.ores/oreBlockId (legacy).
 * @param {any} config
 * @returns {{ warnings: string[], errors: string[] }}
 */
export function validateSkillRegenConfig(config) {
	const warnings = [];
	const errors = [];

	if (!isObj(config)) {
		errors.push("Config inválida: se esperaba un objeto");
		return { warnings, errors };
	}

	if (!config.enabled) {
		warnings.push("Config: enabled=false (feature desactivada)");
	}

	// Mode / production
	if (config.mode != null) {
		const m = String(config.mode).toLowerCase();
		if (m !== "dev" && m !== "prod" && m !== "production") warnings.push("Config: mode debería ser 'dev' o 'prod'");
	}

	const tps = asNum(config.ticksPerSecond);
	if (tps == null || tps <= 0) warnings.push("Config: ticksPerSecond inválido, usando fallback en runtime");

	const areas = Array.isArray(config.areas) ? config.areas : [];
	if (areas.length === 0) warnings.push("Config: areas está vacío (no aplicará en ningún lado)");
	for (const [i, a] of areas.entries()) {
		if (!isObj(a)) {
			errors.push(`Area[${i}]: inválida (no es objeto)`);
			continue;
		}
		if (!asStr(a.dimensionId)) errors.push(`Area[${i}]: dimensionId vacío`);
		if (!isObj(a.min) || !isObj(a.max)) errors.push(`Area[${i}]: min/max inválidos`);
	}

	const isLegacy = Array.isArray(config.ores) && !Array.isArray(config.blocks);
	const blocks = Array.isArray(config.blocks) ? config.blocks : Array.isArray(config.ores) ? config.ores : [];
	if (isLegacy) {
		warnings.push("Config: 'ores' está deprecado; usa 'blocks' (compat: seguirá funcionando)");
	}
	if (blocks.length === 0) warnings.push("Config: blocks está vacío (no hay bloques regenerables registrados)");
	for (const [i, b] of blocks.entries()) {
		if (!isObj(b)) {
			errors.push(`Block[${i}]: inválido (no es objeto)`);
			continue;
		}
		if (!asStr(b.id)) errors.push(`Block[${i}]: id vacío`);
		if (!asStr(b.skill)) {
			if (isLegacy) warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): skill vacío (legacy) => se asumirá 'mining'`);
			else errors.push(`Block[${i}] (${asStr(b.id) || "?"}): skill vacío`);
		}
		const blockId = asStr(b.blockId || b.oreBlockId);
		if (!blockId) errors.push(`Block[${i}] (${asStr(b.id) || "?"}): blockId vacío`);
		// '*' soportado (exact/prefix/glob) por registry.js

		// Sonidos (opcional)
		if (b.sound != null) {
			// legacy
			if (typeof b.sound !== "string") warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): sound (legacy) debería ser string`);
			else warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): sound (legacy) está deprecado, usa sounds:[{id,volume,pitch}]`);
		}
		if (b.sounds != null) {
			if (isStringArray(b.sounds)) {
				warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): sounds como string[] está deprecado, usa sounds:[{id,volume,pitch}]`);
			} else if (!isSoundObjArray(b.sounds)) {
				warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): sounds debería ser Array<{id,volume?,pitch?}>`);
			}
		}

		// XP orbs (opcional)
		if (b.xpOrbs != null) {
			if (!isObj(b.xpOrbs)) {
				warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): xpOrbs debería ser objeto {min,max,chance}`);
			} else {
				if (!isFiniteNumber(b.xpOrbs.min) || !isFiniteNumber(b.xpOrbs.max) || !isFiniteNumber(b.xpOrbs.chance)) {
					warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): xpOrbs min/max/chance deben ser numéricos`);
				} else {
					const chance = Number(b.xpOrbs.chance);
					if (chance < 0 || chance > 100) warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): xpOrbs.chance debe ser 0..100`);
				}
			}
		}

		// Partículas Silk Touch (opcional)
		if (b.particlesOnSilkTouch != null) {
			if (!isObj(b.particlesOnSilkTouch) || typeof b.particlesOnSilkTouch.fn !== "function") {
				warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): particlesOnSilkTouch debería ser { fn: Function, offset?, options? }`);
			}
		}

		// Métricas por-bloque
		if (b.scoreboardAddsOnBreak != null) {
			validateScoreboardAddsObject(b.scoreboardAddsOnBreak, `Block[${i}] (${asStr(b.id) || "?"})`, warnings);
		}

		// Métricas por-modifier
		if (b.modifiers != null) {
			if (!isObj(b.modifiers)) {
				warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): modifiers debería ser un objeto`);
			} else {
				for (const [mk, mv] of Object.entries(b.modifiers)) {
					if (!isObj(mv)) continue;
					validateScoreboardAddsObject(
						mv.scoreboardAddsOnBreak,
						`Block[${i}] (${asStr(b.id) || "?"}) modifier '${asStr(mk) || "?"}'`,
						warnings
					);
				}
			}
		}

		const drops = Array.isArray(b.drops) ? b.drops : [];
		if (drops.length === 0) warnings.push(`Block[${i}] (${asStr(b.id) || "?"}): drops vacío`);
		for (const [j, d] of drops.entries()) {
			if (!Array.isArray(d) || d.length < 5) {
				errors.push(`Block[${i}] drop[${j}]: entry inválido (esperado tuple [dropId,itemId,min,max,chance,...])`);
				continue;
			}
			const itemId = asStr(d[1]);
			if (!itemId) errors.push(`Block[${i}] drop[${j}]: itemId vacío`);
			const minQty = asNum(d[2]);
			const maxQty = asNum(d[3]);
			const chance = asNum(d[4]);
			if (minQty == null || maxQty == null) errors.push(`Block[${i}] drop[${j}]: min/max inválidos`);
			if (chance == null || chance < 0 || chance > 100) errors.push(`Block[${i}] drop[${j}]: chancePct debe ser 0..100`);
		}
	}

	// Métricas (scoreboards)
	if (config.metrics != null) {
		if (!isObj(config.metrics)) {
			warnings.push("Config: metrics debería ser un objeto");
		} else {
			const adds = config.metrics.scoreboardAddsOnBreak;
			if (adds != null && !isObj(adds)) {
				warnings.push("Config: metrics.scoreboardAddsOnBreak debería ser un objeto {OBJ: number}");
			} else if (isObj(adds)) {
				for (const [k, v] of Object.entries(adds)) {
					const obj = asStr(k);
					if (!obj) warnings.push("Config: metrics.scoreboardAddsOnBreak contiene un objetivo vacío");
					if (!isFiniteNumber(v)) warnings.push(`Config: metrics.scoreboardAddsOnBreak['${obj || "?"}'] debería ser numérico`);
				}
			}
		}
	}

	return { warnings, errors };
}
