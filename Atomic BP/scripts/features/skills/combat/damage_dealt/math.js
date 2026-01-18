export function floorInt(n) {
	const v = Number(n);
	if (!Number.isFinite(v)) return 0;
	return Math.floor(v);
}

export function clampMin0(n) {
	const v = Math.trunc(Number(n));
	if (!Number.isFinite(v)) return 0;
	return Math.max(0, v);
}

export function clampPercent0to100(n) {
	const v = Number(n);
	if (!Number.isFinite(v)) return 0;
	return Math.max(0, Math.min(100, v));
}

export function rollCrit(probPercent) {
	const p = clampPercent0to100(probPercent);
	if (p >= 100) return true;
	if (p <= 0) return false;
	// 0..99
	return Math.floor(Math.random() * 100) < p;
}

export function applyDefenseMultiplier(danoBase, defensa) {
	const base = Number(danoBase);
	if (!Number.isFinite(base) || base <= 0) return 0;

	let def = Number(defensa);
	if (!Number.isFinite(def)) def = 0;
	if (def <= 0) return base;

	// Reduccion monotona (0..1):
	// mult = 75 / (def + 75)
	// - def=0 => 1.0
	// - def=75 => 0.5
	// - def grande => tiende a 0
	const mult = 75 / (def + 75);
	if (!Number.isFinite(mult)) return 0;

	return base * mult;
}
