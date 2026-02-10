// Feature: skills/lecture

export function toNumberOr(value, fallback = 0) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

export function floorFinite(value, fallback = 0) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.floor(n);
}

export function clampInt32(value) {
	const n = Math.trunc(toNumberOr(value, 0));
	if (!Number.isFinite(n)) return 0;
	return Math.max(-2147483648, Math.min(2147483647, n));
}
