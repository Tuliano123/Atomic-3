// Feature: skills/lecture

import { getItemLoreBestEffort } from "./equipmentReader.js";
import { parseItemTotalsFromLore } from "./loreParser.js";

export function sumStatsFromEquippedItems(items, statRegistry) {
	/** @type {Record<string, number>} */
	const totals = {};
	for (const stat of statRegistry) totals[stat.id] = 0;

	const arr = Array.isArray(items) ? items : [];
	for (const item of arr) {
		if (!item) continue;
		const lore = getItemLoreBestEffort(item);
		if (!lore || lore.length === 0) continue;
		const parsed = parseItemTotalsFromLore(lore, statRegistry);
		for (const stat of statRegistry) {
			totals[stat.id] = Math.trunc(Number(totals[stat.id] ?? 0) + Number(parsed[stat.id] ?? 0));
		}
	}

	return totals;
}
