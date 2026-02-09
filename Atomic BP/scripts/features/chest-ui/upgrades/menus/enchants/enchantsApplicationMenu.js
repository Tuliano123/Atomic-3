import ChestFormData from "../../../chestui/forms.js";
import { upgradesUiConfig } from "../../config.js";
import { enchantmentsData, enchantsMenuConfig, typeAEffects } from "./enchantsConfig.js";
import {
	buildLevelDescriptionLines,
	buildRequiredItemName,
	checkRequirements,
	computeExtraPlaceholders,
	consumeItemsByName,
	getLevelConfig,
	getRarityText,
	rollbackConsumed,
	toRoman,
} from "./enchantsHelpers.js";
import {
	resolveRarityFromLastLoreLine,
	getCurrentEnchantmentLevelFromLore,
	normalizeForMatch,
	extractUpgradeCodeFromLastLoreLine,
	getCategoryFromDigit,
} from "../../loreReaders.js";
import { upsertEnchantmentInLore, removeEnchantmentFromLore, hasAnyEnchantmentsInLore, applyTypeAStatDelta, revertTypeAStatDelta } from "../../loreWriters.js";
import {
	getMainhandItemStack,
	isItemEnchanted,
	resolveChestUiTextureForItem,
	toTitleFromTypeId,
} from "../../itemMirror.js";
import { convertToGlintIfPossible, convertToPlainIfPossible, setMainhandItemStack } from "./enchantsHelpers.js";

function explodeLoreLines(loreLines) {
	if (!Array.isArray(loreLines) || loreLines.length === 0) return [];
	const out = [];
	for (const entry of loreLines) {
		const s = String(entry ?? "");
		if (s.includes("\n")) {
			for (const part of s.split("\n")) out.push(part);
		} else {
			out.push(s);
		}
	}
	return out;
}

function getSafeLoreLines(item) {
	try {
		const l = item?.getLore?.();
		return explodeLoreLines(Array.isArray(l) ? l : []);
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

function resolveEffectiveCategoryModeFromLore(loreLines, fallbackCategoryMode) {
	const lastLine = getLastNonEmptyLine(loreLines);
	const codeInfo = extractUpgradeCodeFromLastLoreLine(lastLine);
	const code = String(codeInfo?.code ?? "00000");
	const digit1 = code.length > 0 ? code[0] : "0";
	const derived = getCategoryFromDigit(digit1);
	return derived && derived !== "unknown" ? derived : String(fallbackCategoryMode ?? "all");
}

export function enchantsApplicationMenu(
	player,
	{ enchantId, categoryMode, page = 0, onBack, pendingDisenchant = null } = {}
) {
	const enchant = (enchantmentsData ?? []).find((e) => Number(e?.id) === Number(enchantId));
	if (!enchant) return;

	const ui = new ChestFormData("45", `§l§8${enchant.name}`, 1);
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

	const currentLevel = getCurrentEnchantmentLevelFromLore(loreLines, enchant.name);
	const { gridSlots, pagination } = enchantsMenuConfig;
	const perPage = gridSlots.length;
	const totalLevels = Number(enchant.maxLevel) || 1;
	const totalPages = Math.max(1, Math.ceil(totalLevels / perPage));
	const currentPage = Math.max(0, Math.min(Number(page) || 0, totalPages - 1));

	const startLevel = currentPage * perPage + 1;
	const endLevel = Math.min(totalLevels, startLevel + perPage - 1);

	const routesBySlot = {};
	let gridIndex = 0;
	for (let level = startLevel; level <= endLevel; level++) {
		const slot = gridSlots[gridIndex++];
		const levelConfig = getLevelConfig(enchant, level);

		const required = Array.isArray(levelConfig?.requirement?.items) ? levelConfig.requirement.items : [];
		const resolvedReq = required.map((r) => ({ ...r, name: buildRequiredItemName(r.name, level) }));
		const requirement = { ...(levelConfig?.requirement ?? {}), items: resolvedReq };

		const state = getEnchantmentActionState(enchant.name, level, currentLevel, requirement, player);

		let actionText = state.actionText;
		let isConfirming = false;
		if (state.canDisenchant && pendingDisenchant?.level === level) {
			actionText = enchantsMenuConfig.actionTexts.confirmDisenchant;
			isConfirming = true;
		}

		const rarityText = getRarityText(levelConfig?.rarity);
		const extraPlaceholders = computeExtraPlaceholders(enchant.name, level);
		const desc = buildLevelDescriptionLines(levelConfig, { level, actionText, rarityText, extraPlaceholders });

		ui.button(slot, `${levelConfig?.color ?? "§r"}${enchant.name} ${toRoman(level)}`, desc, enchantsMenuConfig.enchantmentTexture, 0, 0, true);
		routesBySlot[slot] = {
			level,
			canApply: state.canApply,
			canDisenchant: state.canDisenchant,
			isConfirming,
			requirement,
		};
	}

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

		if (res.selection === enchantsMenuConfig.backSlot) {
			if (typeof onBack === "function") onBack();
			return;
		}

		if (res.selection === pagination.nextSlot && currentPage < totalPages - 1) {
			return enchantsApplicationMenu(player, { enchantId, categoryMode, page: currentPage + 1, onBack });
		}
		if (res.selection === pagination.prevSlot && currentPage > 0) {
			return enchantsApplicationMenu(player, { enchantId, categoryMode, page: currentPage - 1, onBack });
		}

		const route = routesBySlot[res.selection];
		if (!route) return;

		if (route.canApply) {
			const result = executeEnchantmentTransaction(player, enchant, route.level, route.requirement, categoryMode);
			try {
				player.sendMessage(result.success ? `§a✓ Encantado: ${enchant.name} ${toRoman(route.level)}` : `§c✗ ${result.error ?? "Error"}`);
			} catch (e) {
				void e;
			}
			return enchantsApplicationMenu(player, { enchantId, categoryMode, page: currentPage, onBack });
		}

		if (route.canDisenchant && !route.isConfirming) {
			return enchantsApplicationMenu(player, {
				enchantId,
				categoryMode,
				page: currentPage,
				onBack,
				pendingDisenchant: { level: route.level },
			});
		}

		if (route.canDisenchant && route.isConfirming) {
			const result = removeEnchantmentFromMainhand(player, enchant.name, categoryMode);
			try {
				player.sendMessage(result.success ? `§a✓ Removido: ${enchant.name} ${toRoman(route.level)}` : `§c✗ ${result.error ?? "Error"}`);
			} catch (e) {
				void e;
			}
			return enchantsApplicationMenu(player, { enchantId, categoryMode, page: currentPage, onBack });
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

/**
 * Resolves the Type A effects for an enchantment at a given level.
 * Returns an empty array for non-Type-A enchantments.
 * @param {string} enchantName - Base name of the enchantment.
 * @param {number} level - Target level.
 * @returns {Array<{ stat: string, deltaPerLevel: number, segmentColor?: string }>}
 */
function resolveTypeAEffects(enchantName, level, categoryMode) {
	if (!enchantName || !level) return [];

	// Special case: "Fortuna" targets a different stat by tool category.
	// - pickaxe → Fortuna Minera
	// - axe     → Fortuna de Tala
	// - hoe     → Fortuna de Cosecha
	// Fallback if forced onto another item: Fortuna Minera.
	if (normalizeForMatch(enchantName) === normalizeForMatch("Fortuna")) {
		const mode = String(categoryMode ?? "");
		const stat = mode === "axe"
			? "Fortuna de Tala"
			: mode === "hoe"
				? "Fortuna de Cosecha"
				: "Fortuna Minera";
		return [{ stat, deltaPerLevel: 50, segmentColor: "§p" }];
	}

	// Match using normalized keys (diacritic-insensitive).
	const key = normalizeForMatch(enchantName);
	for (const [name, effects] of Object.entries(typeAEffects)) {
		if (normalizeForMatch(name) === key) return effects;
	}
	return [];
}

function getEnchantmentActionState(enchantName, targetLevel, currentLevel, requirement, player) {
	const { actionTexts } = enchantsMenuConfig;

	if (currentLevel >= targetLevel) {
		if (currentLevel === targetLevel) {
			return { canApply: false, canDisenchant: true, actionText: actionTexts.alreadyHasSame };
		}
		return { canApply: false, canDisenchant: false, actionText: actionTexts.alreadyHasHigher };
	}

	const reqCheck = checkRequirements(requirement, player);
	if (!reqCheck.passed) {
		return { canApply: false, canDisenchant: false, actionText: actionTexts.missingRequirements, reason: reqCheck.reason };
	}

	return { canApply: true, canDisenchant: false, actionText: actionTexts.canApply };
}

function executeEnchantmentTransaction(player, enchant, level, requirement, categoryMode) {
	const mainhand = getMainhandItemStack(player);
	if (!mainhand) return { success: false, error: "Mano vacía" };

	// 1) Validar
	const check = checkRequirements(requirement, player);
	if (!check.passed) return { success: false, error: check.reason ?? "No cumples los requisitos" };
	const bypassRequirements = check?.bypassed === true;

	// 2) Consumir (rollback si falla algo después)
	const inventory = player.getComponent("inventory")?.container;
	const snapshots = [];
	if (!bypassRequirements && Array.isArray(requirement?.items) && requirement.items.length) {
		for (const itemReq of requirement.items) {
			const res = consumeItemsByName(inventory, itemReq.name, itemReq.quantity);
			if (Array.isArray(res.snapshots)) snapshots.push(...res.snapshots);
			if (!res.success) {
				rollbackConsumed(inventory, snapshots);
				return { success: false, error: `No se pudo consumir: ${itemReq.name}` };
			}
		}
	}

	// 3) Aplicar lore
	try {
		let loreLines = getSafeLoreLines(mainhand);
		const effectiveCategoryMode = resolveEffectiveCategoryModeFromLore(loreLines, categoryMode);
		const rarityTexts = (upgradesUiConfig.rarities ?? []).map((r) => String(r?.qualityText ?? "")).filter(Boolean);
		const enchantToken = `${enchant.name} ${toRoman(level)}`;

		// 3a) Apply Type A stat deltas (before inserting token).
		const effects = resolveTypeAEffects(enchant.name, level, effectiveCategoryMode);
		const currentLevel = getCurrentEnchantmentLevelFromLore(loreLines, enchant.name);
		for (const fx of effects) {
			const previousDelta = currentLevel > 0 ? fx.deltaPerLevel * currentLevel : 0;
			const result = applyTypeAStatDelta(loreLines, {
				stat: fx.stat,
				delta: fx.deltaPerLevel * level,
				segmentColor: fx.segmentColor,
			}, previousDelta);
			if (!result.applied) {
				console.warn(`[Enchants] Type A stat "${fx.stat}" not found in lore for ${enchant.name} — skipped.`);
			}
			loreLines = result.loreLines;
		}

		// 3b) Insert/update enchantment token.
		const newLore = upsertEnchantmentInLore({
			loreLines,
			enchantBaseName: enchant.name,
			enchantToken,
			maxPerLine: enchantsMenuConfig.maxEnchantsPerLine,
			rarityTexts,
			lineColor: enchantsMenuConfig.enchantmentLoreColor,
		});

		const nextItem = convertToGlintIfPossible(mainhand) ?? mainhand;
		try {
			nextItem.setLore(newLore);
		} catch (e) {
			void e;
			rollbackConsumed(inventory, snapshots);
			return { success: false, error: "No se pudo aplicar lore" };
		}

		const ok = setMainhandItemStack(player, nextItem);
		if (!ok) {
			rollbackConsumed(inventory, snapshots);
			return { success: false, error: "No se pudo actualizar el item" };
		}
		return { success: true };
	} catch (e) {
		try {
			const msg = e?.stack ? String(e.stack) : e?.message ? String(e.message) : String(e);
			console.warn(`[Enchants] Error aplicando encantamiento (${enchant?.name ?? "?"} ${toRoman(level)}). Item=${String(mainhand?.typeId ?? "?")}. ${msg}`);
		} catch (e2) {
			void e2;
		}
		rollbackConsumed(inventory, snapshots);
		return { success: false, error: "Error aplicando encantamiento" };
	}
}

function removeEnchantmentFromMainhand(player, enchantName, categoryMode) {
	const mainhand = getMainhandItemStack(player);
	if (!mainhand) return { success: false, error: "Mano vacía" };

	try {
		let loreLines = getSafeLoreLines(mainhand);
		const effectiveCategoryMode = resolveEffectiveCategoryModeFromLore(loreLines, categoryMode);
		const rarityTexts = (upgradesUiConfig.rarities ?? []).map((r) => String(r?.qualityText ?? "")).filter(Boolean);

		// Determine current level to compute the delta for revert.
		const currentLevel = getCurrentEnchantmentLevelFromLore(loreLines, enchantName);
		const effects = resolveTypeAEffects(enchantName, currentLevel, effectiveCategoryMode);

		// Revert Type A stat deltas.
		for (const fx of effects) {
			const result = revertTypeAStatDelta(loreLines, {
				stat: fx.stat,
				delta: fx.deltaPerLevel * currentLevel,
				segmentColor: fx.segmentColor,
			});
			if (!result.applied) {
				console.warn(`[Enchants] Type A stat "${fx.stat}" not found for revert of ${enchantName} — skipped.`);
			}
			loreLines = result.loreLines;
		}

		// Remove enchantment token.
		const res = removeEnchantmentFromLore({
			loreLines,
			enchantBaseName: enchantName,
			rarityTexts,
			lineColor: enchantsMenuConfig.enchantmentLoreColor,
		});
		if (!res.removedAny) return { success: false, error: "Encantamiento no encontrado" };

		const newLore = res.loreLines;

		let nextItem = mainhand;
		if (!hasAnyEnchantmentsInLore(newLore)) {
			nextItem = convertToPlainIfPossible(mainhand) ?? mainhand;
		}
		try { nextItem.setLore(newLore); } catch (e) { void e; }

		const ok = setMainhandItemStack(player, nextItem);
		if (!ok) return { success: false, error: "No se pudo actualizar el item" };
		return { success: true };
	} catch (e) {
		void e;
		return { success: false, error: "Error removiendo encantamiento" };
	}
}
