import ChestFormData from "../../chestui/forms.js";
import { upgradesUiConfig, upgradesMenusConfig } from "../config.js";
import {
	extractUpgradeCodeFromLastLoreLine,
	resolveRarityFromLastLoreLine,
	buildPoolForCategory,
	countEnchantments,
	computeModifiersApplied,
} from "../loreReaders.js";
import {
	getMainhandItemStack,
	isItemEnchanted,
	resolveChestUiTextureForItem,
	toTitleFromTypeId,
} from "../itemMirror.js";
import { enchantsMenu } from "./enchantsMenu.js";
import { modifiersMenu } from "./modifiersMenu.js";
import { infoMenu } from "./infoMenu.js";
import { attributesMenu } from "./attributesMenu.js";

function getSafeLoreLines(item) {
	try {
		const l = item?.getLore?.();
		return Array.isArray(l) ? l : [];
	} catch (e) {
		void e;
		return [];
	}
}

function getLastNonEmptyLine(lines) {
	if (!Array.isArray(lines) || lines.length === 0) return "";
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = String(lines[i] ?? "");
		if (line.trim().length > 0) return line;
	}
	return "";
}

export function upgradesPrimaryMenu(player) {
	const ui = new ChestFormData("45", "§l§8Menú de Mejoras", 1);

	ui.default(upgradesUiConfig.layout.defaultItem);

	const mainhandItem = getMainhandItemStack(player);
	const loreLines = mainhandItem ? getSafeLoreLines(mainhandItem) : [];
	const lastLine = getLastNonEmptyLine(loreLines);
	const codeInfo = extractUpgradeCodeFromLastLoreLine(lastLine);
	const rarity = upgradesMenusConfig.primary.features.rarityPane
		? resolveRarityFromLastLoreLine(lastLine, upgradesUiConfig.rarities)
		: null;

	const yPane = rarity
		? {
			...upgradesUiConfig.layout.fallbackPaneY,
			itemName: rarity.paneName ?? upgradesUiConfig.layout.fallbackPaneY.itemName,
			texture: rarity.paneTexture,
			itemDesc: Array.isArray(rarity.paneDescription)
				? rarity.paneDescription
				: [String(rarity.paneDescription ?? "")],
		}
		: upgradesUiConfig.layout.fallbackPaneY;

	ui.pattern(upgradesUiConfig.layout.pattern, {
		...upgradesUiConfig.layout.patternLegend,
		y: yPane,
	});

	// Mirror slot (always hide stack/durability numbers)
	if (!mainhandItem) {
		ui.button(
			upgradesMenusConfig.primary.mirrorSlot,
			"§r§cMano vacía",
			["§r§7No tienes un item en la mano.", "§r§7Sostén uno y abre el menú."],
			"barrier",
			0,
			0,
			false
		);
	} else {
		const itemName = String(mainhandItem.nameTag ?? "").trim()
			? String(mainhandItem.nameTag)
			: `§r§7${toTitleFromTypeId(mainhandItem.typeId)}`;
		ui.button(
			upgradesMenusConfig.primary.mirrorSlot,
			itemName,
			loreLines,
			resolveChestUiTextureForItem(mainhandItem),
			0,
			0,
			isItemEnchanted(mainhandItem)
		);
	}

	// Placeholder button (reforge)
	if (upgradesMenusConfig.primary.features.reforgeButton) {
		ui.button(
			upgradesMenusConfig.primary.reforgeSlot,
			"§r§aReforgar herramienta",
			[
				"§r§7Las herramientas tienen capacidades asombrosas",
				"§r§7mientras sepas como usarlas, pero a veces",
				"§r§7necesitan un poco de §6ayuda§r§7 extra.",
				"",
				"§r§7Reforga actual:",
				"  §r§cNinguna",
				"",
				"§r§7Costo: §61,000 de dinero",
				"",
				"§r§eClic para reforgar",
			],
			"anvil",
			0,
			0,
			false
		);
	}

	// Dynamic actions (4 max) — deterministic order, no extra abstractions.
	const digits = String(codeInfo.code ?? "00000")
		.padEnd(5, "0")
		.slice(0, 5)
		.split("")
		.map((d) => Number(d) || 0);

	const routesBySlot = {};
	let nextActionSlot = 0;
	const actionSlots = upgradesMenusConfig.primary.actionSlots;

	// #1 Encantamientos
	if (upgradesMenusConfig.primary.features.actionGrid && (digits[0] ?? 0) > 0) {
		const action = upgradesUiConfig.actionsByCodeIndex[1];
		const variant = (action?.variantsByDigit ?? {})[digits[0]] ?? (action?.variantsByDigit ?? {})[1];
		const slot = actionSlots[nextActionSlot++];
		if (slot != null && variant) {
			const pool = buildPoolForCategory({
				categoryMode: variant.categoryMode,
				poolsByCategory: upgradesUiConfig.enchantmentPoolsByCategory,
				categoryUnions: upgradesUiConfig.categoryUnions,
			});
			const { applied, max } = countEnchantments({ loreLines, poolBaseNames: pool });
			ui.button(
				slot,
				action.title,
				[...action.descriptionLines, "", `§r§7Encantamientos: §e${applied}§7/§a${max}`, "", action.clickHint],
				action.texture,
				0,
				0,
				true
			);
			routesBySlot[slot] = { menu: "enchants", props: { loreLines, categoryMode: variant.categoryMode } };
		}
	}

	// #2 Modificadores
	if (upgradesMenusConfig.primary.features.actionGrid && (digits[1] ?? 0) > 0) {
		const action = upgradesUiConfig.actionsByCodeIndex[2];
		const variant = (action?.variantsByDigit ?? {})[digits[1]] ?? (action?.variantsByDigit ?? {})[1];
		const slot = actionSlots[nextActionSlot++];
		if (slot != null && variant) {
			const supportedCategories = Array.isArray(variant.supportedCategories) ? variant.supportedCategories : [];
			const applied = computeModifiersApplied({
				loreLines,
				rules: action.readRules,
				categoriesMax: {
					effrenatus: action.categories.effrenatus.max,
					rune_t3: action.categories.rune_t3.max,
					meliorem_master: action.categories.meliorem_master.max,
				},
			});
			const counterLines = [];
			for (const key of supportedCategories) {
				const cat = action.categories[key];
				if (!cat) continue;
				const max = Number(cat.max ?? 0) || 0;
				const value = Math.min(Number(applied[key] ?? 0) || 0, max);
				counterLines.push(`${cat.label} §e${value}§7/§a${max}`);
			}
			ui.button(slot, action.title, [...action.descriptionLines, "", ...counterLines, "", action.clickHint], action.texture, 0, 0, true);
			routesBySlot[slot] = { menu: "modifiers", props: { loreLines, supportedCategories } };
		}
	}

	// #3 Info
	if (upgradesMenusConfig.primary.features.actionGrid && (digits[2] ?? 0) > 0) {
		const action = upgradesUiConfig.actionsByCodeIndex[3];
		const slot = actionSlots[nextActionSlot++];
		if (slot != null) {
			ui.button(slot, action.title, [...(action.descriptionLines ?? []), "", action.clickHint], action.texture, 0, 0, true);
			routesBySlot[slot] = { menu: "info", props: {} };
		}
	}

	// #4 Atributos
	if (upgradesMenusConfig.primary.features.actionGrid && (digits[3] ?? 0) > 0) {
		const action = upgradesUiConfig.actionsByCodeIndex[4];
		const slot = actionSlots[nextActionSlot++];
		if (slot != null) {
			ui.button(slot, action.title, [...(action.descriptionLines ?? []), "", action.clickHint], action.texture, 0, 0, true);
			routesBySlot[slot] = { menu: "attributes", props: {} };
		}
	}

	ui.show(player).then((response) => {
		if (response.canceled) return;
		if (upgradesMenusConfig.primary.features.reforgeButton && response.selection === upgradesMenusConfig.primary.reforgeSlot) return;
		const route = routesBySlot?.[response.selection];
		if (!route) return;

		const onBack = () => upgradesPrimaryMenu(player);
		if (route.menu === "enchants") return enchantsMenu(player, { ...route.props, onBack });
		if (route.menu === "modifiers") return modifiersMenu(player, { ...route.props, onBack });
		if (route.menu === "info") return infoMenu(player, { ...route.props, onBack });
		if (route.menu === "attributes") return attributesMenu(player, { ...route.props, onBack });
	});
}
