import { normalizeNameKey, safeString } from "./format.js";

export function buildSpecialDeathMessageMap(config) {
	const map = new Map();
	const list = config?.deathMessages?.specialDeathMessages;
	if (!Array.isArray(list)) return map;
	for (const entry of list) {
		const name = normalizeNameKey(entry?.name);
		const message = safeString(entry?.message, "");
		if (name && message) map.set(name, message);
	}
	return map;
}

function applyPlaceholders(template, values) {
	let out = String(template ?? "");
	out = out.split("<Player>").join(values?.playerName ?? "");
	out = out.split("<Target>").join(values?.playerName ?? "");
	out = out.split("<Killer>").join(values?.killerName ?? "");
	return out;
}

export function resolveDeathMessage(params) {
	const config = params?.config || {};
	const vipLevel = Math.trunc(Number(params?.vipLevel ?? 0));
	const playerName = safeString(params?.playerName, "?");
	let killerName = safeString(params?.killerName, "");
	if (!killerName) killerName = safeString(config?.deathMessages?.killerUnknown, "Desconocido");
	const causeKey = safeString(params?.causeKey, "default");
	const specialMap = params?.specialMap || new Map();

	const deathMessages = config?.deathMessages || {};
	const deathCauses = deathMessages?.deathCauses || {};

	let template = "";
	if (vipLevel >= 1) {
		const special = specialMap.get(normalizeNameKey(playerName));
		template = special || safeString(deathMessages?.vipDefault, "<Player> ha muerto");
	} else {
		template = safeString(deathCauses?.[causeKey], "");
		if (!template) template = safeString(deathCauses?.default, "<Player> ha muerto");
	}

	return applyPlaceholders(template, { playerName, killerName });
}
