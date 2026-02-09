import {
	analyzeLoreStructure,
	extractEnchantmentFromToken,
	findStatLineIndex,
	getAllEnchantmentsFromLore,
	isStatisticLine,
	normalizeForMatch,
	normalizeLoreSpacing,
	parseStatLine,
} from "./loreReaders.js";

import { applyCustomEmojisToText } from "../../custom-emojis/index.js";

function explodeLoreLines(loreLines) {
	// Some legacy items store multiple visual lines inside a single lore entry with "\n".
	// Writers must operate on visual lines to keep section ordering stable.
	const lines = Array.isArray(loreLines) ? loreLines : [];
	const out = [];
	for (const entry of lines) {
		const s = String(entry ?? "");
		if (!s.includes("\n")) {
			out.push(s);
			continue;
		}
		// Preserve empty lines.
		for (const part of s.split("\n")) out.push(String(part));
	}
	return out;
}

function isBlankLine(line) {
	return String(line ?? "").trim().length === 0;
}

function splitTokens(line) {
	return String(line ?? "")
		.split(",")
		.map((p) => String(p ?? "").trim())
		.filter((p) => p.length > 0);
}

function stripLeadingFormattingForEnchantToken(token, lineColor) {
	let t = String(token ?? "").trim();
	if (!t) return "";
	// Normalize: remove leading resets and the line color if present.
	t = t.replace(/^(?:§r)+/g, "");
	if (lineColor) {
		// lineColor is expected to be like "§9"
		const escaped = String(lineColor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		t = t.replace(new RegExp(`^(?:${escaped})+`), "");
	}
	return t.trim();
}

function formatEnchantLine(tokens, lineColor) {
	const clean = (tokens ?? [])
		.map((t) => stripLeadingFormattingForEnchantToken(t, lineColor))
		.filter(Boolean);
	if (!clean.length) return "";
	// Always prepend §r to avoid color leakage from preceding lines.
	// Ref: ENCHANTMENTS.md § 6.1.1 — recommended format: §r§9<Nombre> <Romano>
	const color = String(lineColor ?? "");
	const prefix = color.startsWith("§r") ? color : `§r${color}`;
	return `${prefix}${clean.join(", ")}`;
}

function joinTokens(tokens) {
	return (tokens ?? []).map((t) => String(t ?? "").trim()).filter(Boolean).join(", ");
}

function ensureSingleBlankLineAround(lines, index) {
	const out = [...lines];
	let idx = index;
	// Insert blank line before if needed; adjust idx after splice.
	if (idx > 0 && !isBlankLine(out[idx - 1])) {
		out.splice(idx, 0, "");
		idx++;
	}
	// Insert blank line after if needed.
	if (idx + 1 < out.length && !isBlankLine(out[idx + 1])) {
		out.splice(idx + 1, 0, "");
	}
	return out;
}

function upsertTokenInLine({ line, baseName, newToken, lineColor }) {
	const tokens = splitTokens(line);
	const key = normalizeForMatch(baseName);
	let replaced = false;
	let hasEnchantToken = false;
	const next = tokens.map((t) => {
		const parsed = extractEnchantmentFromToken(t);
		if (parsed) hasEnchantToken = true;
		if (!parsed) return t;
		if (normalizeForMatch(parsed.baseName) !== key) return t;
		replaced = true;
		return newToken;
	});
	const outLine = hasEnchantToken ? formatEnchantLine(next, lineColor) : joinTokens(next);
	return { line: outLine, replaced, count: next.length };
}

function removeTokenFromLine({ line, baseName, lineColor }) {
	const tokens = splitTokens(line);
	const key = normalizeForMatch(baseName);
	const next = [];
	let removed = false;
	let hasEnchantToken = false;
	for (const t of tokens) {
		const parsed = extractEnchantmentFromToken(t);
		if (parsed) hasEnchantToken = true;
		if (parsed && normalizeForMatch(parsed.baseName) === key) {
			removed = true;
			continue;
		}
		next.push(t);
	}
	const outLine = hasEnchantToken ? formatEnchantLine(next, lineColor) : joinTokens(next);
	return { line: outLine, removed, empty: next.length === 0 };
}

export function upsertEnchantmentInLore({
	loreLines,
	enchantBaseName,
	enchantToken,
	maxPerLine = 2,
	rarityTexts = [],
	lineColor = "§9",
}) {
	const lines = normalizeLoreSpacing(explodeLoreLines(loreLines));
	const structure = analyzeLoreStructure(lines, { rarityTexts });

	// 1) If present anywhere, replace the token in-place.
	for (let i = 0; i < lines.length; i++) {
		const result = upsertTokenInLine({ line: lines[i], baseName: enchantBaseName, newToken: enchantToken, lineColor });
		if (result.replaced) {
			const out = [...lines];
			out[i] = result.line;
			return normalizeLoreSpacing(out);
		}
	}

	// 2) Insert into an existing enchant line with space.
	if (structure.firstEnchantLineIndex >= 0) {
		for (let i = structure.firstEnchantLineIndex; i <= structure.lastEnchantLineIndex; i++) {
			if (structure.rarityLineIndex >= 0 && i >= structure.rarityLineIndex) break;
			const tokens = splitTokens(lines[i]);
			const parsedCount = tokens.filter((t) => !!extractEnchantmentFromToken(t)).length;
			if (parsedCount <= 0) continue;
			if (parsedCount >= maxPerLine) continue;
			const out = [...lines];
			out[i] = formatEnchantLine([...tokens, enchantToken], lineColor);
			return normalizeLoreSpacing(out);
		}
	}

	// 3) Need a new line. Determine insertion point.
	// Priority: after existing enchant block; else after stats; else before description; else before rarity; else end.
	let insertAt = lines.length;
	if (structure.lastEnchantLineIndex >= 0) insertAt = structure.lastEnchantLineIndex + 1;
	else if (structure.lastStatisticIndex >= 0) insertAt = structure.lastStatisticIndex + 1;
	else if (structure.descriptionStartIndex >= 0) insertAt = structure.descriptionStartIndex;
	else if (structure.rarityLineIndex >= 0) insertAt = structure.rarityLineIndex;

	let out = [...lines];
	out.splice(insertAt, 0, formatEnchantLine([enchantToken], lineColor));

	// Add spacing around the new line — but when appending to an existing
	// enchant block, skip the "before" blank (the new line is part of the block).
	if (structure.lastEnchantLineIndex >= 0) {
		// Only ensure blank AFTER (between enchants and the next section).
		if (insertAt + 1 < out.length && !isBlankLine(out[insertAt + 1])) {
			out.splice(insertAt + 1, 0, "");
		}
	} else {
		out = ensureSingleBlankLineAround(out, insertAt);
	}
	return normalizeLoreSpacing(out);
}

export function removeEnchantmentFromLore({ loreLines, enchantBaseName, rarityTexts = [], lineColor = "§9", maxPerLine = 2 }) {
	const lines = normalizeLoreSpacing(explodeLoreLines(loreLines));
	let out = [...lines];
	let removedAny = false;

	// 1) Remove the matching token from whichever line(s) it appears in.
	for (let i = 0; i < out.length; i++) {
		const r = removeTokenFromLine({ line: out[i], baseName: enchantBaseName, lineColor });
		if (!r.removed) continue;
		removedAny = true;
		if (r.empty) out[i] = "";
		else out[i] = r.line;
	}

	if (!removedAny) return { loreLines: normalizeLoreSpacing(out), removedAny: false };

	// Normalize before analysis so that empty lines from removal are collapsed;
	// this prevents double-blank gaps from breaking the enchant block range.
	out = normalizeLoreSpacing(out);

	// 2) Re-flow: collect all remaining enchant tokens, rebuild lines with maxPerLine.
	const structure = analyzeLoreStructure(out, { rarityTexts });
	const { firstEnchantLineIndex: first, lastEnchantLineIndex: last } = structure;

	if (first >= 0 && last >= first) {
		// Gather every surviving enchant token (raw text) from the enchant line range.
		const allTokens = [];
		for (let i = first; i <= last; i++) {
			const tokens = splitTokens(out[i]);
			for (const t of tokens) {
				if (extractEnchantmentFromToken(t)) allTokens.push(t);
			}
		}

		// Build new enchant lines grouped by maxPerLine.
		const newLines = [];
		for (let i = 0; i < allTokens.length; i += maxPerLine) {
			newLines.push(formatEnchantLine(allTokens.slice(i, i + maxPerLine), lineColor));
		}

		// Replace old enchant line range with the new lines.
		out.splice(first, last - first + 1, ...newLines);
	}

	out = normalizeLoreSpacing(out);

	return { loreLines: out, removedAny };
}

export function hasAnyEnchantmentsInLore(loreLines) {
	return getAllEnchantmentsFromLore(loreLines).length > 0;
}

function getStatRenderConfig(statName) {
	const key = normalizeForMatch(statName);
	// Colors ref: upgrades/README.md ("Convención de colores por estadística y canal").
	// Icons ref: skills/calc/README.md + upgrades/README.md examples.
	if (key === normalizeForMatch("Daño")) return { totalColor: "§c", icon: "🗡", parenColor: "§9" };
	if (key === normalizeForMatch("Daño Crítico")) return { totalColor: "§9", icon: "🎃", parenColor: "§9" };
	if (key === normalizeForMatch("Probabilidad Crítica")) return { totalColor: "§9", icon: "", parenColor: "§9" };
	if (key === normalizeForMatch("Fortuna Minera")) return { totalColor: "§6", icon: "⛏", parenColor: "§p" };
	if (key === normalizeForMatch("Fortuna de Tala")) return { totalColor: "§6", icon: "🪓", parenColor: "§p" };
	if (key === normalizeForMatch("Fortuna de Cosecha")) return { totalColor: "§6", icon: "⭐", parenColor: "§p" };
	// Safe fallback: keep total readable, enchant segment default blue.
	return { totalColor: "§f", icon: "", parenColor: "§9" };
}

function buildStatLine({ statName, total, paren, totalColor, parenColor, icon }) {
	const label = String(statName ?? "").trim();
	const tColor = String(totalColor ?? "§f");
	const pColor = String(parenColor ?? "§9");
	const value = Math.max(0, Math.trunc(Number(total) || 0));
	const iconText = String(icon ?? "");
	const withParen = Math.max(0, Math.trunc(Number(paren) || 0));

	let line = `§r§7${label}: ${tColor}+${value}${iconText}`;
	if (withParen > 0) line = `${line} ${pColor}(+${withParen})`;
	// Convert unicode icons to custom glyphs where configured.
	return applyCustomEmojisToText(line);
}

// ----------------------------
// Type A: Stat modification
// ----------------------------

/**
 * Strips all formatting codes from a string.
 * @param {string} input
 * @returns {string}
 */
function stripFormatting(input) {
	return String(input ?? "").replace(/§./g, "");
}

/**
 * Rebuilds a stat line with updated total and parenthesis (enchantment segment).
 * Preserves the original color codes and bracket segments.
 *
 * Ref: ENCHANTEFFECT.md § 2.2 — Segment convention.
 * Ref: ENCHANTMENTS.md § 6.1.4 — S1/S3 format.
 *
 * @param {string} originalLine - The original raw lore line.
 * @param {number} newTotal - New total value (always >= 0).
 * @param {number} newParen - New parenthesis segment value. 0 = remove paren.
 * @param {string} parenColor - Color code for the parenthesis, default "§9".
 * @returns {string} The rebuilt lore line.
 */
function rebuildStatLine(originalLine, newTotal, newParen, parenColor = "§9") {
	const raw = String(originalLine ?? "");

	// Step 1: Replace the total value.
	// The total is the first numeric value after the colon, prefixed by a color code.
	// Pattern: "§<color>+N" or "§<color>-N" — we want to replace just the numeric part.
	let result = raw;

	// Find the colon position to work only on the value portion.
	const colonIdx = result.indexOf(":");
	if (colonIdx < 0) return raw;

	const prefix = result.slice(0, colonIdx + 1);
	let valuePart = result.slice(colonIdx + 1);

	// Replace the first numeric value (the total) in the value portion.
	// Match: optional color codes, then +/- and digits.
	valuePart = valuePart.replace(
		/(\s*§.(?:§.)*)([+\-])(\d+(?:[\.,]\d+)?)/,
		(match, colorPrefix, sign, _oldNum) => {
			const displaySign = newTotal >= 0 ? "+" : "-";
			return `${colorPrefix}${displaySign}${Math.abs(newTotal)}`;
		}
	);

	// Step 2: Handle the parenthesis segment §9(+N).
	// Remove any existing parenthesized segment (may have different color).
	valuePart = valuePart.replace(/\s*§.\(\s*[+\-]?\s*\d+(?:[\.,]\d+)?\s*\)/g, "");

	// Step 3: Append new paren if > 0.
	if (newParen > 0) {
		valuePart = `${valuePart.trimEnd()} ${parenColor}(+${newParen})`;
	}

	return `${prefix}${valuePart}`;
}

/**
 * Applies a Type A enchantment stat delta to lore lines.
 * Modifies the stat's total and parenthesis (enchantment) segment.
 *
 * Ref: ENCHANTEFFECT.md § 2.3 — Application rules.
 *
 * @param {string[]} loreLines - Current lore array.
 * @param {Object} effect - Type A effect definition.
 * @param {string} effect.stat - Stat display name, e.g. "Daño", "Daño Crítico".
 * @param {number} effect.delta - Value to add (can be negative, e.g. Verosimilitud).
 * @param {string} [effect.segmentColor="§9"] - Color for the paren segment.
 * @param {number} [previousDelta=0] - Delta from the previous level (for upgrades).
 * @returns {{ loreLines: string[], applied: boolean }}
 */
export function applyTypeAStatDelta(loreLines, effect, previousDelta = 0) {
	const lines = explodeLoreLines(loreLines);
	if (!effect?.stat || effect.delta == null) return { loreLines: lines, applied: false };

	let idx = findStatLineIndex(lines, effect.stat);
	const segColor = effect.segmentColor ?? getStatRenderConfig(effect.stat).parenColor ?? "§9";

	// Net delta accounts for upgrading from a previous level.
	const netDelta = effect.delta - previousDelta;

	// If the stat line doesn't exist, create it (only for positive deltas).
	if (idx < 0) {
		if (netDelta <= 0) return { loreLines: lines, applied: false };
		const cfg = getStatRenderConfig(effect.stat);
		const structure = analyzeLoreStructure(lines, { rarityTexts: [] });

		let insertAt = lines.length;
		if (structure.lastStatisticIndex >= 0) insertAt = structure.lastStatisticIndex + 1;
		else if (structure.firstEnchantLineIndex >= 0) insertAt = structure.firstEnchantLineIndex;
		else if (structure.descriptionStartIndex >= 0) insertAt = structure.descriptionStartIndex;
		else if (structure.rarityLineIndex >= 0) insertAt = structure.rarityLineIndex;

		const out = [...lines];
		out.splice(
			insertAt,
			0,
			buildStatLine({
				statName: effect.stat,
				total: netDelta,
				paren: netDelta,
				totalColor: cfg.totalColor,
				parenColor: segColor,
				icon: cfg.icon,
			})
		);
		return { loreLines: normalizeLoreSpacing(out), applied: true };
	}

	const parsed = parseStatLine(lines[idx]);

	const newTotal = Math.max(0, parsed.total + netDelta);
	// Only additive enchantments write to the paren segment.
	// Subtractive enchantments (negative delta) only affect total.
	const newParen = netDelta > 0
		? Math.max(0, parsed.paren + netDelta)
		: parsed.paren;

	lines[idx] = rebuildStatLine(lines[idx], newTotal, newParen, segColor);
	return { loreLines: lines, applied: true };
}

/**
 * Reverts a Type A enchantment stat delta from lore lines (disenchant).
 * Subtracts the delta from total and paren. Clamps to 0.
 *
 * Ref: ENCHANTEFFECT.md § 2.3 — Removal rules.
 *
 * @param {string[]} loreLines - Current lore array.
 * @param {Object} effect - Type A effect definition.
 * @param {string} effect.stat - Stat display name.
 * @param {number} effect.delta - Value that was added (will be subtracted).
 * @param {string} [effect.segmentColor="§9"] - Color for the paren segment.
 * @returns {{ loreLines: string[], applied: boolean }}
 */
export function revertTypeAStatDelta(loreLines, effect) {
	const lines = explodeLoreLines(loreLines);
	if (!effect?.stat || effect.delta == null) return { loreLines: lines, applied: false };

	const idx = findStatLineIndex(lines, effect.stat);
	if (idx < 0) return { loreLines: lines, applied: false };

	const parsed = parseStatLine(lines[idx]);
	const segColor = effect.segmentColor ?? getStatRenderConfig(effect.stat).parenColor ?? "§9";

	const newTotal = Math.max(0, parsed.total - effect.delta);
	// Only revert paren for additive enchantments (delta > 0).
	// Subtractive enchantments never wrote a paren segment.
	const newParen = effect.delta > 0
		? Math.max(0, parsed.paren - effect.delta)
		: parsed.paren;

	lines[idx] = rebuildStatLine(lines[idx], newTotal, newParen, segColor);

	// If the stat drops to 0 and has no other sources, remove the entire line.
	// This avoids leaving "+0" stats after disenchant, and restores the original lore shape.
	const hasNonZeroBrackets = Array.isArray(parsed.brackets) && parsed.brackets.some((b) => Number(b) !== 0);
	if (newTotal <= 0 && newParen <= 0 && !hasNonZeroBrackets && isStatisticLine(lines[idx])) {
		lines.splice(idx, 1);
		return { loreLines: normalizeLoreSpacing(lines), applied: true };
	}
	return { loreLines: lines, applied: true };
}
