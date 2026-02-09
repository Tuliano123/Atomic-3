// scripts/features/chest-ui/upgrades/menus/enchants/enchantsHelpers.js

import { EquipmentSlot, ItemStack, world } from "@minecraft/server";
import { upgradesUiConfig } from "../../config.js";
import { normalizeForMatch } from "../../loreReaders.js";
import { enchantsMenuConfig, typeAEffects } from "./enchantsConfig.js";
import { applyCustomEmojisToText } from "../../../../custom-emojis/index.js";

// Testing helper: players in this list can enchant without requirements.
// Keep this list small and explicit.
const REQUIREMENTS_BYPASS_TAG = "SXB";

function shouldBypassRequirements(player) {
	const name = String(player?.name ?? "");
	if (!player) return false;

	try {
		if (typeof player.hasTag === "function") return player.hasTag(REQUIREMENTS_BYPASS_TAG);
		if (typeof player.getTags === "function") return player.getTags().includes(REQUIREMENTS_BYPASS_TAG);
	} catch {
		// If tag APIs are unavailable for any reason, do not bypass.
	}

	return false;
}

export function toRoman(num) {
	if (num < 1 || num > 3999) return String(num);
	const romanNumerals = [
		{ value: 1000, numeral: "M" },
		{ value: 900, numeral: "CM" },
		{ value: 500, numeral: "D" },
		{ value: 400, numeral: "CD" },
		{ value: 100, numeral: "C" },
		{ value: 90, numeral: "XC" },
		{ value: 50, numeral: "L" },
		{ value: 40, numeral: "XL" },
		{ value: 10, numeral: "X" },
		{ value: 9, numeral: "IX" },
		{ value: 5, numeral: "V" },
		{ value: 4, numeral: "IV" },
		{ value: 1, numeral: "I" },
	];
	let result = "";
	let n = Math.trunc(Number(num));
	for (const { value, numeral } of romanNumerals) {
		while (n >= value) {
			result += numeral;
			n -= value;
		}
	}
	return result;
}

export function fromRoman(roman) {
	const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
	let result = 0;
	const upper = String(roman ?? "").toUpperCase();
	for (let i = 0; i < upper.length; i++) {
		const current = values[upper[i]] || 0;
		const next = values[upper[i + 1]] || 0;
		result += current < next ? -current : current;
	}
	return result;
}

export function escapeRegex(str) {
	return String(str ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterEnchantmentsByCategory(categoryMode, allEnchantments) {
	const categoryUnions = upgradesUiConfig.categoryUnions;
	let categories = [categoryMode];
	if (categoryUnions?.[categoryMode]) categories = categoryUnions[categoryMode];
	if (categoryMode === "all") return [...(allEnchantments ?? [])].sort((a, b) => a.id - b.id);
	return (allEnchantments ?? [])
		.filter((ench) => Array.isArray(ench?.compatible) && ench.compatible.some((cat) => categories.includes(cat)))
		.sort((a, b) => a.id - b.id);
}

export function safeGetScore(player, objective) {
	try {
		const scoreboard = world.scoreboard.getObjective(String(objective));
		if (!scoreboard) return 0;
		return scoreboard.getScore(player.scoreboardIdentity) ?? 0;
	} catch (e) {
		void e;
		return 0;
	}
}

export function evaluateOperator(left, operator, right) {
	const l = Number(left) || 0;
	const r = Number(right) || 0;
	switch (String(operator)) {
		case ">=":
			return l >= r;
		case "<=":
			return l <= r;
		case "==":
			return l === r;
		case "!=":
			return l !== r;
		default:
			return false;
	}
}

export function countItemsByName(container, requiredName) {
	if (!container) return 0;
	const name = String(requiredName ?? "");
	let count = 0;
	for (let i = 0; i < container.size; i++) {
		let it = null;
		try {
			it = container.getItem(i);
		} catch (e) {
			void e;
			continue;
		}
		if (!it) continue;
		const tag = String(it.nameTag ?? "");
		if (tag !== name) continue;
		count += Number(it.amount ?? 0) || 0;
	}
	return count;
}

export function consumeItemsByName(container, requiredName, quantity) {
	if (!container) return { success: false, consumed: 0, snapshots: [] };
	const name = String(requiredName ?? "");
	let remaining = Math.max(0, Number(quantity) || 0);
	const snapshots = [];

	for (let i = 0; i < container.size && remaining > 0; i++) {
		let it = null;
		try {
			it = container.getItem(i);
		} catch (e) {
			void e;
			continue;
		}
		if (!it) continue;
		if (String(it.nameTag ?? "") !== name) continue;

		// Snapshot original stack for rollback.
		snapshots.push({ slot: i, item: it });

		const amt = Number(it.amount ?? 0) || 0;
		const take = Math.min(amt, remaining);
		remaining -= take;

		try {
			if (amt - take <= 0) container.setItem(i, undefined);
			else {
				it.amount = amt - take;
				container.setItem(i, it);
			}
		} catch (e) {
			void e;
			return { success: false, consumed: (Number(quantity) || 0) - remaining, snapshots };
		}
	}

	const success = remaining === 0;
	return { success, consumed: (Number(quantity) || 0) - remaining, snapshots };
}

export function rollbackConsumed(container, snapshots) {
	if (!container) return false;
	if (!Array.isArray(snapshots) || snapshots.length === 0) return true;
	try {
		for (const snap of snapshots) {
			container.setItem(snap.slot, snap.item);
		}
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

export function checkRequirements(requirement, player) {
	if (!requirement) return { passed: true };
	if (shouldBypassRequirements(player)) return { passed: true, bypassed: true };

	// Scoreboards
	if (Array.isArray(requirement.scores) && requirement.scores.length) {
		for (const score of requirement.scores) {
			const value = safeGetScore(player, score.objective);
			const ok = evaluateOperator(value, score.operator, score.int);
			if (!ok) {
				return { passed: false, reason: `${score.objective}: ${value} ${score.operator} ${score.int}` };
			}
		}
	}

	// Items (only existence)
	if (Array.isArray(requirement.items) && requirement.items.length) {
		const inventory = player.getComponent("inventory")?.container;
		if (!inventory) return { passed: false, reason: "Sin inventario" };
		for (const itemReq of requirement.items) {
			const count = countItemsByName(inventory, itemReq.name);
			const need = Number(itemReq.quantity) || 0;
			if (count < need) return { passed: false, reason: `Faltan: ${stripFormatting(itemReq.name)} x${need - count}` };
		}
	}

	return { passed: true };
}

function stripFormatting(input) {
	return String(input ?? "").replace(/§./g, "");
}

export function buildRequiredItemName(template, level) {
	return String(template ?? "").replace(/<roman>/g, toRoman(level));
}

export function buildLevelDescriptionLines(levelConfig, { level, actionText, rarityText, extraPlaceholders } = {}) {
	const lines = Array.isArray(levelConfig?.levelDescription) ? levelConfig.levelDescription : [];
	const replacements = {
		...extraPlaceholders,
		[enchantsMenuConfig.placeholders.roman]: toRoman(level),
		[enchantsMenuConfig.placeholders.action]: String(actionText ?? ""),
		[enchantsMenuConfig.placeholders.rarity]: String(rarityText ?? ""),
	};

	return lines.map((l) => {
		let out = String(l ?? "");
		for (const [ph, value] of Object.entries(replacements)) out = out.split(ph).join(String(value));
		return applyCustomEmojisToText(out);
	});
}

/**
 * Processes an array of description lines through the custom emoji system.
 * Used for mainDescription in the selection menu.
 */
export function processDescriptionEmojis(lines) {
	if (!Array.isArray(lines)) return lines;
	return lines.map((l) => applyCustomEmojisToText(String(l ?? "")));
}

export function getRarityText(rarityKey) {
	const key = String(rarityKey ?? "");
	const rarity = (upgradesUiConfig.rarities ?? []).find((r) => String(r?.key) === key);
	return String(rarity?.qualityText ?? key);
}

export function getLevelConfig(enchant, level) {
	const levelsMenu = Array.isArray(enchant?.levelsMenu) ? enchant.levelsMenu : [];
	for (const cfg of levelsMenu) {
		const set = Array.isArray(cfg?.level) ? cfg.level : [];
		if (set.includes(level)) return cfg;
	}
	return levelsMenu[0] ?? null;
}

export function setMainhandItemStack(player, itemStack) {
	try {
		const equip = player.getComponent("equippable");
		if (!equip) return false;
		equip.setEquipment(EquipmentSlot.Mainhand, itemStack);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

export function getMainhandItemStack(player) {
	try {
		const equip = player.getComponent("equippable");
		return equip?.getEquipment(EquipmentSlot.Mainhand) ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

export function convertToGlintIfPossible(itemStack) {
	if (!itemStack) return null;
	const typeId = String(itemStack.typeId ?? "");
	const [ns, short] = typeId.includes(":") ? typeId.split(":") : ["minecraft", typeId];
	if (!short) return null;
	if (short.endsWith("_glint")) return itemStack;
	if (!short.endsWith("_plain")) return itemStack;
	const target = `${ns}:${short.slice(0, -"_plain".length)}_glint`;
	try {
		const next = new ItemStack(target, Number(itemStack.amount ?? 1) || 1);
		try {
			next.nameTag = itemStack.nameTag;
			const lore = itemStack.getLore?.() ?? [];
			next.setLore(lore);
		} catch (e) {
			void e;
		}
		return next;
	} catch (e) {
		void e;
		return itemStack;
	}
}

export function convertToPlainIfPossible(itemStack) {
	if (!itemStack) return null;
	const typeId = String(itemStack.typeId ?? "");
	const [ns, short] = typeId.includes(":") ? typeId.split(":") : ["minecraft", typeId];
	if (!short) return null;
	if (short.endsWith("_plain")) return itemStack;
	if (!short.endsWith("_glint")) return itemStack;
	const target = `${ns}:${short.slice(0, -"_glint".length)}_plain`;
	try {
		const next = new ItemStack(target, Number(itemStack.amount ?? 1) || 1);
		try {
			next.nameTag = itemStack.nameTag;
			const lore = itemStack.getLore?.() ?? [];
			next.setLore(lore);
		} catch (e) {
			void e;
		}
		return next;
	} catch (e) {
		void e;
		return itemStack;
	}
}

export function computeExtraPlaceholders(enchantName, level) {
	const key = normalizeForMatch(enchantName);
	const ph = enchantsMenuConfig.placeholders;
	const placeholders = {};

	// — Type A: from registry —
	for (const [name, effects] of Object.entries(typeAEffects)) {
		if (normalizeForMatch(name) !== key) continue;
		for (const fx of effects) {
			const val = String(Math.abs(fx.deltaPerLevel * level));
			const statKey = normalizeForMatch(fx.stat);
			if (statKey === normalizeForMatch("Daño"))                placeholders[ph.damage] = val;
			else if (statKey === normalizeForMatch("Daño Crítico"))    placeholders[ph.critDamage] = val;
			else if (statKey === normalizeForMatch("Probabilidad Crítica")) placeholders[ph.critChance] = val;
			else if (statKey === normalizeForMatch("Fortuna Minera"))  placeholders[ph.fortune] = val;
			else if (statKey === normalizeForMatch("Fortuna de Cosecha")) placeholders[ph.fortuneCrop] = val;
			// Convicción → all three fortunes share one placeholder
			if (statKey === normalizeForMatch("Fortuna Minera") &&
				normalizeForMatch(name) === normalizeForMatch("Convicción"))
				placeholders[ph.fortuneAll] = val;
		}
		break;
	}

	// — Specific per-enchant formulas (non-registry) —
	switch (key) {
		case normalizeForMatch("Protección"):
			placeholders[ph.percentage] = String(level * 4);
			break;
		case normalizeForMatch("Primer Golpe"):
			// ×1.5 / ×2.0 / ×2.5 / ×3.0
			placeholders[ph.multiplier] = (1 + level * 0.5).toFixed(1);
			break;
		case normalizeForMatch("Castigo"):
		case normalizeForMatch("Perdición de los Artrópodos"):
		case normalizeForMatch("Asesino del Fin"):
			placeholders[ph.multiplier] = (level * 0.1).toFixed(1);
			break;
		case normalizeForMatch("Discordancia"):
			placeholders[ph.multiplier] = (level * 0.05).toFixed(2);
			break;
		case normalizeForMatch("Lux"):
		case normalizeForMatch("Nux"):
			placeholders[ph.multiplier] = (level * 0.1).toFixed(1);
			break;
		case normalizeForMatch("Aspecto Ígneo"):
			placeholders[ph.duration] = String(level * 5);
			break;
		case normalizeForMatch("Corte Veloz"):
			placeholders[ph.chance] = String(level * 5);
			break;
		case normalizeForMatch("Oxidación"):
			placeholders[ph.chance] = "60";
			placeholders[ph.damage] = String(level);
			break;
		case normalizeForMatch("Saqueo"):
			placeholders[ph.drops] = String(level * 3);
			break;
		case normalizeForMatch("Salvación"):
			placeholders[ph.percentage] = String(level * 5);
			break;
		case normalizeForMatch("Magmatismo"):
			placeholders[ph.percentage] = String(level * 5);
			break;
		case normalizeForMatch("Artigeno"):
			placeholders[ph.chance] = String(level * 4);
			break;
		case normalizeForMatch("Rejuvenecimiento"):
			placeholders[ph.percentage] = String(level * 2);
			break;
		case normalizeForMatch("Respiración"):
			placeholders[ph.duration] = String(level * 15);
			break;
		case normalizeForMatch("Caída de pluma"):
			placeholders[ph.percentage] = String(level * 5);
			break;
		case normalizeForMatch("Lijereza"):
			placeholders[ph.percentage] = String(level * 5);
			break;
		case normalizeForMatch("Prisa espontánea"):
			placeholders[ph.chance] = "0.1";
			break;
	}

	return placeholders;
}
