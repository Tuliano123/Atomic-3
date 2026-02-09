import ChestFormData from "../../../chestui/forms.js";
import { upgradesUiConfig } from "../../config.js";
import { enchantmentsData, enchantsMenuConfig } from "./enchantsConfig.js";
import { filterEnchantmentsByCategory, processDescriptionEmojis } from "./enchantsHelpers.js";
import { resolveRarityFromLastLoreLine } from "../../loreReaders.js";
import {
	getMainhandItemStack,
	isItemEnchanted,
	resolveChestUiTextureForItem,
	toTitleFromTypeId,
} from "../../itemMirror.js";
import { enchantsApplicationMenu } from "./enchantsApplicationMenu.js";

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

export function enchantsSelectionMenu(player, { categoryMode, page = 0, onBack } = {}) {
	const ui = new ChestFormData("45", "§l§8Encantamientos", 1);
	ui.default(upgradesUiConfig.layout.defaultItem);

	const mainhandItem = getMainhandItemStack(player);
	const loreLines = mainhandItem ? getSafeLoreLines(mainhandItem) : [];
	const lastLine = getLastNonEmptyLine(loreLines);

	const rarity = resolveRarityFromLastLoreLine(lastLine, upgradesUiConfig.rarities);
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

	renderItemMirror(ui, mainhandItem, loreLines);

	const availableEnchants = filterEnchantmentsByCategory(String(categoryMode ?? "all"), enchantmentsData);
	const { gridSlots, pagination } = enchantsMenuConfig;
	const itemsPerPage = gridSlots.length;
	const totalPages = Math.max(1, Math.ceil(availableEnchants.length / itemsPerPage));
	const currentPage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));

	const startIdx = currentPage * itemsPerPage;
	const pageEnchants = availableEnchants.slice(startIdx, startIdx + itemsPerPage);

	const routesBySlot = {};
	pageEnchants.forEach((enchant, idx) => {
		const slot = gridSlots[idx];
		ui.button(slot, `${enchant.colorName}${enchant.name}`, processDescriptionEmojis(enchant.mainDescription), enchantsMenuConfig.enchantmentTexture, 0, 0, true);
		routesBySlot[slot] = { enchantId: enchant.id };
	});

	if (currentPage < totalPages - 1) {
		ui.button(
			pagination.nextSlot,
			pagination.nextButton.itemName,
			[...pagination.nextButton.itemDesc, `§r§8Página ${currentPage + 2}/${totalPages}`],
			pagination.nextButton.texture,
			0,
			0,
			pagination.nextButton.enchanted
		);
	}
	if (currentPage > 0) {
		ui.button(
			pagination.prevSlot,
			pagination.prevButton.itemName,
			[...pagination.prevButton.itemDesc, `§r§8Página ${currentPage}/${totalPages}`],
			pagination.prevButton.texture,
			0,
			0,
			pagination.prevButton.enchanted
		);
	}

	ui.button(
		enchantsMenuConfig.backSlot,
		enchantsMenuConfig.backButton.itemName,
		enchantsMenuConfig.backButton.itemDesc,
		enchantsMenuConfig.backButton.texture,
		0,
		0,
		false
	);

	ui.show(player).then((res) => {
		if (res.canceled) return;
		const selection = res.selection;

		if (selection === enchantsMenuConfig.backSlot) {
			if (typeof onBack === "function") onBack();
			return;
		}

		if (selection === pagination.nextSlot && currentPage < totalPages - 1) {
			return enchantsSelectionMenu(player, { categoryMode, page: currentPage + 1, onBack });
		}
		if (selection === pagination.prevSlot && currentPage > 0) {
			return enchantsSelectionMenu(player, { categoryMode, page: currentPage - 1, onBack });
		}

		const route = routesBySlot[selection];
		if (route) {
			return enchantsApplicationMenu(player, {
				enchantId: route.enchantId,
				categoryMode,
				onBack: () => enchantsSelectionMenu(player, { categoryMode, page: currentPage, onBack }),
			});
		}
	});
}

function renderItemMirror(ui, mainhandItem, loreLines) {
	if (!mainhandItem) {
		ui.button(enchantsMenuConfig.mirrorSlot, "§r§cMano vacía", ["§r§7No tienes un item en la mano."], "barrier", 0, 0, false);
		return;
	}
	const itemName = String(mainhandItem.nameTag ?? "").trim()
		? String(mainhandItem.nameTag)
		: `§r§7${toTitleFromTypeId(mainhandItem.typeId)}`;
	ui.button(
		enchantsMenuConfig.mirrorSlot,
		itemName,
		loreLines,
		resolveChestUiTextureForItem(mainhandItem),
		0,
		0,
		isItemEnchanted(mainhandItem)
	);
}
