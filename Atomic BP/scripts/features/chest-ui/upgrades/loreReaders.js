// Pure helpers for reading/parsing lore for the Upgrades feature.
// Keep this file Script-API-free so it can be unit tested.

import { upgradesUiConfig } from "./config.js";

function stripFormatting(input) {
	return String(input ?? "").replace(/§./g, "");
}

function normalizeSpaces(input) {
	return String(input ?? "")
		.replace(/\s+/g, " ")
		.trim();
}

function removeDiacritics(input) {
	// Avoid Unicode property escapes for runtime compatibility.
	return String(input ?? "").normalize("NFD").replace(/[\u0300-\u036f]+/g, "");
}

export function normalizeForMatch(input) {
	// Used for matching labels/names robustly.
	const stripped = stripFormatting(input);
	const noDiacritics = removeDiacritics(stripped);
	return normalizeSpaces(noDiacritics).toLowerCase();
}

/**
 * Obtiene la categoría desde el dígito del código (#1).
 * Centraliza el mapeo en un solo lugar (ver ENCHANTMENTS.md).
 *
 * @param {string|number} digit - Dígito del código (0-9)
 * @returns {string} categoryMode (ej: "axe", "hoe", "pickaxe") o "unknown"
 */
export function getCategoryFromDigit(digit) {
	const { variantsByDigit } = upgradesUiConfig?.actionsByCodeIndex?.[1] ?? {};
	if (!variantsByDigit) return "unknown";

	const key = String(digit ?? "");
	const variant = variantsByDigit[key];
	return String(variant?.categoryMode ?? "unknown");
}

/**
 * Obtiene el dígito desde el nombre de categoría.
 *
 * @param {string} categoryName
 * @returns {string} Dígito ("0"-"9") o "0" por defecto
 */
export function getDigitFromCategory(categoryName) {
	const { variantsByDigit } = upgradesUiConfig?.actionsByCodeIndex?.[1] ?? {};
	if (!variantsByDigit) return "0";

	const target = String(categoryName ?? "");
	for (const [digit, variant] of Object.entries(variantsByDigit)) {
		if (String(variant?.categoryMode ?? "") === target) return String(digit);
	}
	return "0";
}

export function extractUpgradeCodeFromLastLoreLine(lastLine) {
	// Spec: code is EXACTLY the last 10 non-space chars: "§<digit>" x5.
	const original = String(lastLine ?? "");
	const compact = original.replace(/\s+/g, "");

	if (compact.length < 10) {
		return { code: "00000", prefix: original.trimEnd(), found: false };
	}

	const tail = compact.slice(-10);
	if (!/^(?:§[0-9]){5}$/.test(tail)) {
		return { code: "00000", prefix: original.trimEnd(), found: false };
	}

	const digits = [];
	for (let i = 1; i < 10; i += 2) digits.push(tail[i]);
	return {
		code: digits.join(""),
		// Prefix is best-effort: for rarity, we avoid depending on this.
		prefix: original.trimEnd(),
		found: true,
	};
}


export function resolveRarityFromLastLoreLine(lastLine, rarities) {
	const raw = String(lastLine ?? "");
	// Common: setLore prefixes with §r.
	const cleaned = raw.trimEnd().replace(/^(?:§r)+/g, "");

	let best = null;
	let bestIndex = -1;
	for (const rarity of rarities ?? []) {
		const qualityText = String(rarity?.qualityText ?? "");
		if (!qualityText) continue;

		const idx = cleaned.lastIndexOf(qualityText);
		if (idx >= 0 && idx > bestIndex) {
			best = rarity;
			bestIndex = idx;
		}
	}
	return best;
}

function parseIntSafe(value) {
	const normalized = String(value ?? "").replace(/,/g, ".");
	const n = Number.parseFloat(normalized);
	if (!Number.isFinite(n)) return 0;
	return Math.trunc(n);
}

export function parseDamageSumatoriesFromLore(loreLines) {
	// Returns { s1, s2, s3 } as integers, 0 if missing.
	const lines = Array.isArray(loreLines) ? loreLines : [];
	for (const line of lines) {
		const normalized = normalizeForMatch(line);
		if (!normalized.startsWith("dano:")) continue;

		const stripped = stripFormatting(line);
		// Find up to 2 bracketed values and 1 parenthesized value.
		const bracketMatches = [...stripped.matchAll(/\[\s*\+?(-?\d+(?:[\.,]\d+)?)\s*\]/g)].map((m) => parseIntSafe(m[1]));
		const s1 = bracketMatches[0] ?? 0;
		const s2 = bracketMatches[1] ?? 0;

		const parenMatch = stripped.match(/\(\s*\+?(-?\d+(?:[\.,]\d+)?)\s*\)/);
		const s3 = parenMatch ? parseIntSafe(parenMatch[1]) : 0;

		return {
			s1: Math.max(0, s1),
			s2: Math.max(0, s2),
			s3: Math.max(0, s3),
		};
	}

	return { s1: 0, s2: 0, s3: 0 };
}

function ceilDiv(numerator, denominator) {
	if (!Number.isFinite(numerator) || numerator <= 0) return 0;
	if (!Number.isFinite(denominator) || denominator <= 0) return 0;
	return Math.ceil(numerator / denominator);
}

export function computeModifiersApplied({ loreLines, rules, categoriesMax }) {
	// rules: { effrenatus: {channel, step, rounding}, meliorem_master: {...} }
	const sums = parseDamageSumatoriesFromLore(loreLines);

	const maxEff = Number(categoriesMax?.effrenatus ?? 0) || 0;
	const maxRune = Number(categoriesMax?.rune_t3 ?? 0) || 0;
	const maxMel = Number(categoriesMax?.meliorem_master ?? 0) || 0;

	const effRule = rules?.effrenatus;
	const melRule = rules?.meliorem_master;

	const effChannelValue = effRule?.channel === "S2" ? sums.s2 : effRule?.channel === "S1" ? sums.s1 : sums.s3;
	const melChannelValue = melRule?.channel === "S2" ? sums.s2 : melRule?.channel === "S1" ? sums.s1 : sums.s3;

	let eff = ceilDiv(effChannelValue, Number(effRule?.step ?? 1));
	let mel = ceilDiv(melChannelValue, Number(melRule?.step ?? 1));

	// Dev rule: runes not interpreted yet
	let rune = 0;

	// Spec: applied can never exceed max.
	if (maxEff > 0) eff = Math.min(eff, maxEff);
	if (maxMel > 0) mel = Math.min(mel, maxMel);
	if (maxRune > 0) rune = Math.min(rune, maxRune);

	return {
		effrenatus: eff,
		rune_t3: rune,
		meliorem_master: mel,
	};
}

function extractEnchantmentBase(token) {
	let t = normalizeSpaces(stripFormatting(token));
	if (!t) return "";
	// Remove trailing roman numerals token (I, II, III, IV, V, X, etc.)
	t = t.replace(/\s+[IVXLCDM]+$/i, "");
	return t.trim();
}

export function countEnchantments({ loreLines, poolBaseNames }) {
	// poolBaseNames are base names (no level). Matching is diacritic-insensitive.
	const pool = Array.isArray(poolBaseNames) ? poolBaseNames : [];
	const poolNormalized = new Set(pool.map((n) => normalizeForMatch(n)).filter(Boolean));

	const appliedNormalized = new Set();
	const lines = Array.isArray(loreLines) ? loreLines : [];
	for (const line of lines) {
		// Split by comma; each part may contain a single enchantment.
		const parts = String(line ?? "").split(",");
		for (const part of parts) {
			const base = extractEnchantmentBase(part);
			const key = normalizeForMatch(base);
			if (!key) continue;
			if (!poolNormalized.has(key)) continue;
			appliedNormalized.add(key);
		}
	}

	const max = poolNormalized.size;
	const applied = Math.min(appliedNormalized.size, max);
	return { applied, max };
}

export function buildPoolForCategory({ categoryMode, poolsByCategory, categoryUnions }) {
	if (categoryMode === "all") {
		const all = new Set();
		for (const list of Object.values(poolsByCategory ?? {})) {
			for (const name of list ?? []) all.add(name);
		}
		return [...all];
	}

	const unions = categoryUnions?.[categoryMode];
	const categories = Array.isArray(unions) ? unions : [categoryMode];

	const set = new Set();
	for (const cat of categories) {
		const list = poolsByCategory?.[cat] ?? [];
		for (const name of list) set.add(name);
	}
	return [...set];
}

// ----------------------------
// Enchantments (fake, lore-based)
// ----------------------------

function isBlankLine(line) {
	return String(line ?? "").trim().length === 0;
}

function splitEnchantmentTokensFromLine(line) {
	// "§9Filo VI, Primer Golpe II" => ["§9Filo VI", "Primer Golpe II"]
	return String(line ?? "")
		.split(",")
		.map((p) => String(p ?? "").trim())
		.filter((p) => p.length > 0);
}

export function parseRomanToInt(roman) {
	// Keep minimal and permissive; used only for parsing existing lore.
	const r = String(roman ?? "").toUpperCase().trim();
	if (!r) return 0;
	const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
	let total = 0;
	let prev = 0;
	for (let i = r.length - 1; i >= 0; i--) {
		const v = map[r[i]];
		if (!v) return 0;
		if (v < prev) total -= v;
		else {
			total += v;
			prev = v;
		}
	}
	return total;
}

export function extractEnchantmentFromToken(token) {
	// Accepts formatting codes.
	const raw = String(token ?? "").trim();
	const stripped = normalizeSpaces(stripFormatting(raw));
	if (!stripped) return null;

	// Split into words; last word is expected roman numeral.
	const parts = stripped.split(" ").filter(Boolean);
	if (parts.length < 2) return null;
	const roman = parts[parts.length - 1];
	const level = parseRomanToInt(roman);
	if (!level) return null;
	const baseName = parts.slice(0, -1).join(" ").trim();
	if (!baseName) return null;
	return { baseName, level, roman };
}

export function getAllEnchantmentsFromLore(loreLines) {
	/**
	 * Returns an array of tokens found in lore.
	 * Each entry: { baseName, level, roman, tokenRaw, lineIndex, tokenIndex }
	 */
	const lines = Array.isArray(loreLines) ? loreLines : [];
	const out = [];
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = String(lines[lineIndex] ?? "");
		const tokens = splitEnchantmentTokensFromLine(line);
		for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
			const token = tokens[tokenIndex];
			const parsed = extractEnchantmentFromToken(token);
			if (!parsed) continue;
			out.push({ ...parsed, tokenRaw: token, lineIndex, tokenIndex });
		}
	}
	return out;
}

export function getCurrentEnchantmentLevelFromLore(loreLines, baseName) {
	const key = normalizeForMatch(baseName);
	if (!key) return 0;
	let best = 0;
	for (const ench of getAllEnchantmentsFromLore(loreLines)) {
		if (normalizeForMatch(ench.baseName) !== key) continue;
		if (ench.level > best) best = ench.level;
	}
	return best;
}

export function analyzeLoreStructure(loreLines, { rarityTexts } = {}) {
	// Attempts to identify:
	// - lastStatisticIndex: last line that looks like a stat line
	// - firstEnchantLineIndex: first line that contains at least one enchant token
	// - lastEnchantLineIndex: last contiguous enchant line after firstEnchantLineIndex
	// - rarityLineIndex: last line matching any rarity text
	// - descriptionStartIndex: first non-blank after enchant section (best-effort)
	const lines = Array.isArray(loreLines) ? loreLines : [];

	const rarityLineIndex = findRarityLineIndex(lines, rarityTexts);

	let firstEnchantLineIndex = -1;
	for (let i = 0; i < lines.length; i++) {
		const tokens = splitEnchantmentTokensFromLine(lines[i]);
		if (tokens.some((t) => !!extractEnchantmentFromToken(t))) {
			firstEnchantLineIndex = i;
			break;
		}
	}

	let lastEnchantLineIndex = firstEnchantLineIndex;
	if (firstEnchantLineIndex >= 0) {
		for (let i = firstEnchantLineIndex + 1; i < lines.length; i++) {
			if (rarityLineIndex >= 0 && i >= rarityLineIndex) break;
			if (isBlankLine(lines[i])) {
				// Allow a single blank inside the enchant block only if next is also enchant.
				const next = lines[i + 1];
				const nextTokens = splitEnchantmentTokensFromLine(next);
				if (nextTokens.some((t) => !!extractEnchantmentFromToken(t))) {
					lastEnchantLineIndex = i + 1;
					i++;
					continue;
				}
				break;
			}
			const tokens = splitEnchantmentTokensFromLine(lines[i]);
			if (!tokens.some((t) => !!extractEnchantmentFromToken(t))) break;
			lastEnchantLineIndex = i;
		}
	}

	const lastStatisticIndex = findLastStatisticIndex(lines, firstEnchantLineIndex, rarityLineIndex);
	const descriptionStartIndex = findDescriptionStartIndex(lines, lastEnchantLineIndex, rarityLineIndex);

	return {
		rarityLineIndex,
		firstEnchantLineIndex,
		lastEnchantLineIndex,
		lastStatisticIndex,
		descriptionStartIndex,
	};
}

export function findRarityLineIndex(loreLines, rarityTexts) {
	const lines = Array.isArray(loreLines) ? loreLines : [];
	const list = Array.isArray(rarityTexts) ? rarityTexts.map((t) => String(t ?? "")).filter(Boolean) : [];
	if (!list.length) return -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = String(lines[i] ?? "");
		for (const t of list) {
			if (t && line.includes(t)) return i;
		}
	}
	return -1;
}

export function isStatisticLine(line) {
	// Convention: stat lines always use §7 for the stat name, followed by a colon.
	// Examples: "§r§7Daño: §c+40", "§r§7Daño Crítico: §9+20", "§r§7Fortuna Minera: §6+50"
	// This covers all current and future stats without hardcoding names.
	const raw = String(line ?? "");
	if (!raw.includes("§7")) return false;
	const stripped = stripFormatting(raw).trim();
	// Stat lines look like "StatName: +value [segments...]"
	return /^[^:]+:\s/.test(stripped);
}

export function findLastStatisticIndex(loreLines, firstEnchantLineIndex, rarityLineIndex) {
	const lines = Array.isArray(loreLines) ? loreLines : [];
	// Determine the upper bound: stop before enchants or rarity, whichever comes first.
	// Use explicit >= 0 checks — sentinel -1 means "not found".
	const enchIdx = (firstEnchantLineIndex ?? -1) >= 0 ? firstEnchantLineIndex : -1;
	const rarIdx = (rarityLineIndex ?? -1) >= 0 ? rarityLineIndex : -1;
	const end = enchIdx >= 0 ? enchIdx : rarIdx >= 0 ? rarIdx : lines.length;
	let last = -1;
	for (let i = 0; i < lines.length; i++) {
		if (i >= end) break;
		if (isStatisticLine(lines[i])) {
			last = i;
		}
	}
	return last;
}

export function findDescriptionStartIndex(loreLines, lastEnchantLineIndex, rarityLineIndex) {
	const lines = Array.isArray(loreLines) ? loreLines : [];
	let start = (lastEnchantLineIndex ?? -1) >= 0 ? lastEnchantLineIndex + 1 : 0;
	if ((rarityLineIndex ?? -1) >= 0) start = Math.min(start, rarityLineIndex);
	for (let i = start; i < lines.length; i++) {
		if ((rarityLineIndex ?? -1) >= 0 && i >= rarityLineIndex) return -1;
		if (!isBlankLine(lines[i])) return i;
	}
	return -1;
}

export function normalizeLoreSpacing(loreLines) {
	// Removes leading/trailing blank lines and collapses multiple blanks.
	const lines = (Array.isArray(loreLines) ? loreLines : []).map((l) => String(l ?? ""));
	const out = [];
	let prevBlank = true;
	for (const line of lines) {
		const blank = isBlankLine(line);
		if (blank && prevBlank) continue;
		out.push(line);
		prevBlank = blank;
	}
	while (out.length && isBlankLine(out[0])) out.shift();
	while (out.length && isBlankLine(out[out.length - 1])) out.pop();
	return out;
}

// ----------------------------
// Stat line parsing (Type A)
// ----------------------------

/**
 * Finds the lore line index for a stat by its normalized name.
 * Uses normalizeForMatch to compare, so "Daño Crítico" matches "dano critico".
 * @param {string[]} loreLines
 * @param {string} statName - Display name, e.g. "Daño", "Daño Crítico", "Fortuna Minera"
 * @returns {number} Index of the stat line, or -1 if not found.
 */
export function findStatLineIndex(loreLines, statName) {
	const lines = Array.isArray(loreLines) ? loreLines : [];
	const key = normalizeForMatch(statName);
	if (!key) return -1;
	for (let i = 0; i < lines.length; i++) {
		if (!isStatisticLine(lines[i])) continue;
		const stripped = stripFormatting(lines[i]).trim();
		// Extract the stat name portion (everything before the first colon)
		const colonIndex = stripped.indexOf(":");
		if (colonIndex < 0) continue;
		const lineStatName = stripped.slice(0, colonIndex).trim();
		if (normalizeForMatch(lineStatName) === key) return i;
	}
	return -1;
}

/**
 * Parses a stat line into its components: total value, bracket segments, parenthesis segment.
 * Example: "§r§7Daño: §c+55 §c[+20] §6[+8] §9(+15)"
 * → { total: 55, brackets: [20, 8], paren: 15 }
 * @param {string} line - Raw lore line.
 * @returns {{ total: number, brackets: number[], paren: number }}
 */
export function parseStatLine(line) {
	const stripped = stripFormatting(String(line ?? "")).trim();
	// After "StatName: ", parse the values.
	const colonIndex = stripped.indexOf(":");
	if (colonIndex < 0) return { total: 0, brackets: [], paren: 0 };
	const valuePart = stripped.slice(colonIndex + 1).trim();

	// Total is the first numeric value (possibly with +/- prefix)
	const totalMatch = valuePart.match(/^[+\-]?\s*(\d+(?:[\.,]\d+)?)/);
	const total = totalMatch ? parseIntSafe(totalMatch[1]) : 0;
	const totalSign = valuePart.startsWith("-") ? -1 : 1;

	// Brackets: [+N] or [-N]
	const bracketMatches = [...stripped.matchAll(/\[\s*([+\-]?\s*\d+(?:[\.,]\d+)?)\s*\]/g)];
	const brackets = bracketMatches.map((m) => parseIntSafe(m[1].replace(/\s/g, "")));

	// Parenthesis: (+N) or (-N) — the enchantment segment
	const parenMatch = stripped.match(/\(\s*([+\-]?\s*\d+(?:[\.,]\d+)?)\s*\)/);
	const paren = parenMatch ? parseIntSafe(parenMatch[1].replace(/\s/g, "")) : 0;

	return { total: total * totalSign, brackets, paren };
}
