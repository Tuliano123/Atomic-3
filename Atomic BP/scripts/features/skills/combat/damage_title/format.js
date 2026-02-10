import { clampMin0Int } from "../calc/utilMath.js";
import { applyCustomEmojisToText } from "../../../custom-emojis/index.js";

const SECTION = String.fromCharCode(167); // '§'

function normalizeSectionSigns(text) {
	// A veces por encoding aparece como "Â§". Lo normalizamos.
	let out = String(text);
	out = out.split("Â" + SECTION).join(SECTION);
	out = out.split("Â§").join(SECTION);
	// Forzar el codepoint correcto incluso si el archivo contiene un caracter raro.
	out = out.split("§").join(SECTION);
	return out;
}

function forceResetIfColored(text) {
	const s = String(text);
	if (s.includes(SECTION)) {
		// Bedrock a veces ignora formatos en nameTag si no hay reset.
		// Envolvemos con reset para forzar aplicacion del color.
		return SECTION + "r" + s + SECTION + "r";
	}
	return s;
}

function formatThousands(value, sep = ",") {
	const n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) return "0";
	const s = String(Math.abs(n));
	if (s.length <= 3) return n < 0 ? "-" + s : s;
	let out = "";
	let group = 0;
	for (let i = s.length - 1; i >= 0; i--) {
		out = s[i] + out;
		group++;
		if (group === 3 && i !== 0) {
			out = String(sep) + out;
			group = 0;
		}
	}
	return n < 0 ? "-" + out : out;
}

function buildCommaAfterDigitIndexes(len) {
	// Devuelve un Set de indices i (0..len-1) donde va una coma DESPUÉS del dígito i.
	const out = new Set();
	if (len <= 3) return out;
	let firstGroup = len % 3;
	if (firstGroup === 0) firstGroup = 3;
	let i = firstGroup - 1;
	while (i < len - 1) {
		out.add(i);
		i += 3;
	}
	return out;
}

function formatCriticalPattern(config, danoRealInt) {
	const pattern = config?.criticalPattern ?? {};
	const startEmoji = typeof pattern.startEmoji === "string" ? pattern.startEmoji : "⚪";
	const colors = Array.isArray(pattern.colors) && pattern.colors.length > 0 ? pattern.colors.map(String) : ["§f", "§e", "§6", "§c"];
	const endByColor = pattern.endEmojiByColor ?? { "§f": "⚪", "§e": "🟡", "§6": "🟠", "§c": "🔴" };

	const digits = String(Math.trunc(Number(danoRealInt)));
	if (!digits || !/^\d+$/.test(digits)) return null;

	const commaAfter = buildCommaAfterDigitIndexes(digits.length);
	let out = startEmoji;

	for (let i = 0; i < digits.length; i++) {
		const color = colors[i % colors.length] ?? "§f";
		out += String(color) + digits[i];
		// La coma pertenece al dígito de la izquierda (no consume color propio)
		if (commaAfter.has(i)) out += ",";
	}

	const lastColor = colors[(digits.length - 1) % colors.length] ?? "§f";
	const endEmoji = typeof endByColor?.[String(lastColor)] === "string" ? endByColor[String(lastColor)] : "⚪";
	out += endEmoji;
	return out;
}

export function resolveTypeKey(isCritical, typeKey) {
	if (typeKey) return String(typeKey);
	return isCritical ? "critical" : "normal";
}

export function formatDamageTitle(config, payload) {
	const danoRealRaw = payload?.danoReal ?? payload?.damageReal;
	const danoReal = clampMin0Int(Math.floor(Number(danoRealRaw)));
	if (!Number.isFinite(danoReal) || danoReal <= 0) return null;

	const isCritical = payload?.isCrit === true || payload?.isCritical === true;
	const key = resolveTypeKey(isCritical, payload?.typeKey);

	const sep = config?.formatting?.thousandsSeparator ?? ",";
	const danoFmt = formatThousands(danoReal, sep);

	// Crítico decorativo
	const critMode = String(config?.types?.critical?.mode ?? "pattern");
	if (isCritical && critMode === "pattern") {
		let critOut = formatCriticalPattern(config, danoReal);
		if (!critOut) return null;
		critOut = normalizeSectionSigns(critOut);
		critOut = forceResetIfColored(critOut);
		if (config?.formatting?.useCustomEmojis !== false) critOut = applyCustomEmojisToText(critOut);
		return critOut;
	}

	// Normal (y/o crítico no decorativo): template + reemplazo
	const def = config?.types?.[key]?.text;
	const template = typeof def === "string" ? def : String(config?.types?.normal?.text ?? "<DañoReal>");

	let out = template;
	out = out.split("<DañoReal>").join(String(danoFmt));
	out = out.split("<DanoReal>").join(String(danoFmt));
	out = normalizeSectionSigns(out);
	out = forceResetIfColored(out);
	if (config?.formatting?.useCustomEmojis !== false) out = applyCustomEmojisToText(out);

	return out;
}
