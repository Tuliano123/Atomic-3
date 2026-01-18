import { parseNumberLoose } from "./utilMath.js";

function stripFormatting(line) {
	// Quita códigos §x y reseteos.
	return String(line != null ? line : "").replace(/§./g, "");
}

function normalizeLine(line) {
	return stripFormatting(line)
		.replace(/\s+/g, " ")
		.trim();
}

function findLineByLabel(loreLines, label) {
	if (!Array.isArray(loreLines) || loreLines.length === 0) return null;
	const wanted = String(label != null ? label : "").toLowerCase();
	if (!wanted) return null;

	for (const raw of loreLines) {
		const line = normalizeLine(raw);
		if (!line) continue;
		if (line.toLowerCase().startsWith(wanted)) return line;
	}
	return null;
}

function firstNumberAfterPlus(line) {
	// Captura el primer número después de '+' o ':' (tolerante).
	// Ej: "Daño: +21🗡 ( +14 )" => 21
	const s = String(line != null ? line : "");
	const m = s.match(/[:]\s*\+?\s*([0-9]+(?:[.,][0-9]+)?)/);
	if (!m) return null;
	return parseNumberLoose(m[1]);
}

function parseBracketSums(line) {
	// Captura sumas en [ +N ] (pueden haber 0-2)
	const out = [];
	const s = String(line != null ? line : "");
	const re = /\[\s*\+?\s*([0-9]+)\s*\]/g;
	let m;
	while ((m = re.exec(s))) {
		const n = parseNumberLoose(m[1]);
		if (n != null) out.push(Math.trunc(n));
		if (out.length >= 2) break;
	}
	return out;
}

function parseParenSum(line) {
	// Captura suma en ( +N )
	const s = String(line != null ? line : "");
	const m = s.match(/\(\s*\+?\s*([0-9]+(?:[.,][0-9]+)?)\s*\)/);
	if (!m) return null;
	return parseNumberLoose(m[1]);
}

export function parseWeaponStatsFromLore(loreLines) {
	return parseItemStatsFromLore(loreLines);
}

export function parseItemStatsFromLore(loreLines) {
	// Devuelve totales del arma (y bases cuando aplique). Missing => 0
	/** @type {{
	 *  damageTotal: number, damageBase: number,
	 *  critDamageTotal: number, critDamageBase: number,
	 *  critChanceTotal: number, critChanceBase: number,
	 *  trueDamageTotal: number,
	 *  power: number,
	 *  vidaTotal: number, vidaBase: number,
	 *  defensaTotal: number, defensaBase: number,
	 *  manaTotal: number, manaBase: number
	 * }} */
	const out = {
		damageTotal: 0,
		damageBase: 0,
		critDamageTotal: 0,
		critDamageBase: 0,
		critChanceTotal: 0,
		critChanceBase: 0,
		trueDamageTotal: 0,
		power: 0,
		vidaTotal: 0,
		vidaBase: 0,
		defensaTotal: 0,
		defensaBase: 0,
		manaTotal: 0,
		manaBase: 0,
	};

	// Poder (hook futuro)
	{
		const line = findLineByLabel(loreLines, "Poder:");
		const n = firstNumberAfterPlus(line);
		if (n != null) out.power = Math.trunc(n);
	}

	// Daño
	{
		const line = findLineByLabel(loreLines, "Daño:");
		const total = firstNumberAfterPlus(line);
		if (total != null) {
			const brackets = parseBracketSums(line);
			const paren = parseParenSum(line);
			const s1 = brackets.length > 0 ? brackets[0] : 0;
			const s2 = brackets.length > 1 ? brackets[1] : 0;
			const s3 = paren != null ? Math.trunc(paren) : 0;
			out.damageTotal = Math.trunc(total);
			out.damageBase = Math.trunc(out.damageTotal - (s1 + s2 + s3));
			if (!Number.isFinite(out.damageBase)) out.damageBase = 0;
		}
	}

	// Daño Crítico
	{
		const line = findLineByLabel(loreLines, "Daño Crítico:");
		const total = firstNumberAfterPlus(line);
		if (total != null) {
			const sum = parseParenSum(line);
			out.critDamageTotal = Number(total);
			out.critDamageBase = Number(total) - Number(sum != null ? sum : 0);
			if (!Number.isFinite(out.critDamageBase)) out.critDamageBase = 0;
		}
	}

	// Probabilidad Crítica
	{
		const line = findLineByLabel(loreLines, "Probabilidad Crítica:");
		const total = firstNumberAfterPlus(line);
		if (total != null) {
			const sum = parseParenSum(line);
			out.critChanceTotal = Number(total);
			out.critChanceBase = Number(total) - Number(sum != null ? sum : 0);
			if (!Number.isFinite(out.critChanceBase)) out.critChanceBase = 0;
		}
	}

	// Daño Verdadero
	{
		const line = findLineByLabel(loreLines, "Daño Verdadero:");
		const total = firstNumberAfterPlus(line);
		if (total != null) out.trueDamageTotal = Math.trunc(total);
	}

	// Vida
	{
		const line = findLineByLabel(loreLines, "Vida:");
		const total = firstNumberAfterPlus(line);
		if (total != null) {
			const brackets = parseBracketSums(line);
			const paren = parseParenSum(line);
			const s1 = brackets.length > 0 ? brackets[0] : 0;
			const s2 = brackets.length > 1 ? brackets[1] : 0;
			const s3 = paren != null ? Math.trunc(paren) : 0;
			out.vidaTotal = Math.trunc(total);
			out.vidaBase = Math.trunc(out.vidaTotal - (s1 + s2 + s3));
			if (!Number.isFinite(out.vidaBase)) out.vidaBase = 0;
		}
	}

	// Defensa
	{
		const line = findLineByLabel(loreLines, "Defensa:");
		const total = firstNumberAfterPlus(line);
		if (total != null) {
			const brackets = parseBracketSums(line);
			const paren = parseParenSum(line);
			const s1 = brackets.length > 0 ? brackets[0] : 0;
			const s2 = brackets.length > 1 ? brackets[1] : 0;
			const s3 = paren != null ? Math.trunc(paren) : 0;
			out.defensaTotal = Math.trunc(total);
			out.defensaBase = Math.trunc(out.defensaTotal - (s1 + s2 + s3));
			if (!Number.isFinite(out.defensaBase)) out.defensaBase = 0;
		}
	}

	// Mana
	{
		const line = findLineByLabel(loreLines, "Mana:");
		const total = firstNumberAfterPlus(line);
		if (total != null) {
			const paren = parseParenSum(line);
			out.manaTotal = Math.trunc(total);
			out.manaBase = Math.trunc(out.manaTotal - Number(paren != null ? paren : 0));
			if (!Number.isFinite(out.manaBase)) out.manaBase = 0;
		}
	}

	// Sanitizar NaNs
	for (const k of Object.keys(out)) {
		const v = out[k];
		out[k] = Number.isFinite(Number(v)) ? Number(v) : 0;
	}

	return out;
}
