import ChestFormData from "../../chestui/forms.js";
import { upgradesUiConfig, upgradesMenusConfig } from "../config.js";
import { resolveRarityFromLastLoreLine } from "../loreReaders.js";
import {
	getMainhandItemStack,
	isItemEnchanted,
	resolveChestUiTextureForItem,
	toTitleFromTypeId,
} from "../itemMirror.js";

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

export function infoMenu(player, { onBack } = {}) {
	const ui = new ChestFormData("45", "§l§8Información", 1);
	ui.default(upgradesUiConfig.layout.defaultItem);

	const mainhandItem = getMainhandItemStack(player);
	const loreLines = mainhandItem ? getSafeLoreLines(mainhandItem) : [];
	const lastLine = getLastNonEmptyLine(loreLines);

	const rarity = upgradesMenusConfig.primary.features.rarityPane
		? resolveRarityFromLastLoreLine(lastLine, upgradesUiConfig.rarities)
		: null;
	const yPane = rarity
		? {
			...upgradesUiConfig.layout.fallbackPaneY,
			itemName: rarity.paneName ?? upgradesUiConfig.layout.fallbackPaneY.itemName,
			texture: rarity.paneTexture,
			itemDesc: Array.isArray(rarity.paneDescription) ? rarity.paneDescription : [String(rarity.paneDescription ?? "")],
		}
		: upgradesUiConfig.layout.fallbackPaneY;

	ui.pattern(upgradesUiConfig.layout.pattern, {
		...upgradesUiConfig.layout.patternLegend,
		y: yPane,
	});

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

	ui.button(29, "§eVolver", ["§7Regresa al menú principal de mejoras."], "i/gold_nugget", 0, 0, false);

	ui.show(player).then((res) => {
		if (res.canceled) return;
		if (res.selection === 29 && typeof onBack === "function") onBack();
	});
}
