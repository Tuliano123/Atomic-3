const INT32_MAX = 2147483647;
const INT32_MIN = -2147483648;

export function clampInt32(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(INT32_MIN, Math.min(INT32_MAX, Math.trunc(n)));
}

export function clampMin0Int(value) {
	return Math.max(0, clampInt32(value));
}

export function floorFinite(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.floor(n);
}

export function toNumberOr(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

export function parseNumberLoose(text) {
	// Acepta coma o punto como decimal. Devuelve number o null.
	const s = String(text != null ? text : "").trim();
	if (!s) return null;
	const normalized = s.replace(/,/g, ".");
	const n = Number(normalized);
	return Number.isFinite(n) ? n : null;
}
