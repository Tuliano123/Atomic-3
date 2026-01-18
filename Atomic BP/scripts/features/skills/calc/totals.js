import { parseItemStatsFromLore } from "./loreParser.js";

function toInt(v) {
	const n = Number(v);
	if (!Number.isFinite(n)) return 0;
	return Math.trunc(n);
}

function toFloat(v) {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

export function sumStatsFromItems(items) {
	const out = {
		damageTotal: 0,
		critDamageTotal: 0,
		critChanceTotal: 0,
		trueDamageTotal: 0,
		power: 0,
		vidaTotal: 0,
		defensaTotal: 0,
		manaTotal: 0,
		loreLines: 0,
	};

	if (!Array.isArray(items) || items.length === 0) return out;

	for (const item of items) {
		try {
			if (!item) continue;
			const lore = typeof item.getLore === "function" ? item.getLore() : null;
			const loreLines = Array.isArray(lore) ? lore : [];
			out.loreLines += loreLines.length;
			if (!loreLines.length) continue;

			const s = parseItemStatsFromLore(loreLines);
			out.damageTotal += toInt(s.damageTotal);
			out.critDamageTotal += toFloat(s.critDamageTotal);
			out.critChanceTotal += toFloat(s.critChanceTotal);
			out.trueDamageTotal += toInt(s.trueDamageTotal);
			out.power += toInt(s.power);
			out.vidaTotal += toInt(s.vidaTotal);
			out.defensaTotal += toInt(s.defensaTotal);
			out.manaTotal += toInt(s.manaTotal);
		} catch (e) {
			void e;
		}
	}

	return out;
}
