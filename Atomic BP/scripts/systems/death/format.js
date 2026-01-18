export function formatNumberWithCommas(value) {
	const n = Math.trunc(Number(value));
	if (!Number.isFinite(n) || n <= 0) return "0";
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function normalizeNameKey(value) {
	return String(value ?? "").trim().toLowerCase();
}

export function safeString(value, fallback = "") {
	const out = String(value ?? "").trim();
	return out.length > 0 ? out : fallback;
}
