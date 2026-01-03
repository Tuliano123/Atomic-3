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

/**
 * @param {any} config
 * @returns {{ warnings: string[], errors: string[] }}
 */
export function validateMiningRegenConfig(config) {
	const warnings = [];
	const errors = [];

	if (!isObj(config)) {
		errors.push("Config inválida: se esperaba un objeto");
		return { warnings, errors };
	}

	if (!config.enabled) {
		warnings.push("Config: enabled=false (feature desactivada)");
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

	const ores = Array.isArray(config.ores) ? config.ores : [];
	if (ores.length === 0) warnings.push("Config: ores está vacío (no hay minerales regenerables registrados)");
	for (const [i, o] of ores.entries()) {
		if (!isObj(o)) {
			errors.push(`Ore[${i}]: inválido (no es objeto)`);
			continue;
		}
		if (!asStr(o.id)) errors.push(`Ore[${i}]: id vacío`);
		if (!asStr(o.oreBlockId)) errors.push(`Ore[${i}]: oreBlockId vacío`);

		// Sonidos (opcional)
		if (o.sound != null) {
			// legacy
			if (typeof o.sound !== "string") warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): sound (legacy) debería ser string`);
			else warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): sound (legacy) está deprecado, usa sounds:[{id,volume,pitch}]`);
		}
		if (o.sounds != null) {
			if (isStringArray(o.sounds)) {
				warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): sounds como string[] está deprecado, usa sounds:[{id,volume,pitch}]`);
			} else if (!isSoundObjArray(o.sounds)) {
				warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): sounds debería ser Array<{id,volume?,pitch?}>`);
			}
		}

		// XP orbs (opcional)
		if (o.xpOrbs != null) {
			if (!isObj(o.xpOrbs)) {
				warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): xpOrbs debería ser objeto {min,max,chance}`);
			} else {
				if (!isFiniteNumber(o.xpOrbs.min) || !isFiniteNumber(o.xpOrbs.max) || !isFiniteNumber(o.xpOrbs.chance)) {
					warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): xpOrbs min/max/chance deben ser numéricos`);
				} else {
					const chance = Number(o.xpOrbs.chance);
					if (chance < 0 || chance > 100) warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): xpOrbs.chance debe ser 0..100`);
				}
			}
		}

		// Partículas Silk Touch (opcional)
		if (o.particlesOnSilkTouch != null) {
			if (!isObj(o.particlesOnSilkTouch) || typeof o.particlesOnSilkTouch.fn !== "function") {
				warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): particlesOnSilkTouch debería ser { fn: Function, offset?, options? }`);
			}
		}

		const drops = Array.isArray(o.drops) ? o.drops : [];
		if (drops.length === 0) warnings.push(`Ore[${i}] (${asStr(o.id) || "?"}): drops vacío`);
		for (const [j, d] of drops.entries()) {
			if (!Array.isArray(d) || d.length < 5) {
				errors.push(`Ore[${i}] drop[${j}]: entry inválido (esperado tuple [dropId,itemId,min,max,chance,...])`);
				continue;
			}
			const itemId = asStr(d[1]);
			if (!itemId) errors.push(`Ore[${i}] drop[${j}]: itemId vacío`);
			const minQty = asNum(d[2]);
			const maxQty = asNum(d[3]);
			const chance = asNum(d[4]);
			if (minQty == null || maxQty == null) errors.push(`Ore[${i}] drop[${j}]: min/max inválidos`);
			if (chance == null || chance < 0 || chance > 100) errors.push(`Ore[${i}] drop[${j}]: chancePct debe ser 0..100`);
		}
	}

	return { warnings, errors };
}
