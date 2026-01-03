import { EquipmentSlot, system } from "@minecraft/server";

const INVALID_STRING_MESSAGE = "§cstring inválido";
const SUCCESS_APPLIED_MESSAGE = "§fLore aplicado correctamente";
const SUCCESS_OVERWROTE_MESSAGE = "§fLore sobreescrito correctamente";

const MAX_LORE_LINES = 20;
const MAX_LORE_LINE_LENGTH = 50;

function isFormatCodeChar(ch) {
	return typeof ch === "string" && ch.length === 1 && /[0-9a-fklmnor]/i.test(ch);
}

function isColorCodeChar(ch) {
	return typeof ch === "string" && ch.length === 1 && /[0-9a-f]/i.test(ch);
}

function formatPrefixFromState({ color, modifiers }) {
	const colorCode = color ? `§${color}` : "§f";
	const modifierOrder = ["k", "l", "m", "n", "o"];
	const mods = modifierOrder.filter((m) => modifiers.has(m)).map((m) => `§${m}`).join("");
	return `${colorCode}${mods}`;
}

function stateAfterText(text, initialState) {
	const state = {
		color: initialState && initialState.color != null ? initialState.color : "f",
		modifiers: new Set(initialState && initialState.modifiers ? initialState.modifiers : []),
	};

	for (let i = 0; i < text.length - 1; i++) {
		if (text[i] !== "§") continue;
		const next = text[i + 1];
		const code = typeof next === "string" ? next.toLowerCase() : "";
		if (!isFormatCodeChar(code)) continue;

		if (code === "r") {
			state.color = "f";
			state.modifiers.clear();
			continue;
		}

		if (isColorCodeChar(code)) {
			state.color = code;
			// En Minecraft, un código de color también limpia formatos.
			state.modifiers.clear();
			continue;
		}

		// Modificadores
		state.modifiers.add(code);
	}

	return state;
}

function extractStringValue(input) {
	if (typeof input === "string") return input;
	if (Array.isArray(input)) return input.length > 0 ? extractStringValue(input[0]) : null;

	if (input && typeof input === "object") {
		// Algunas versiones entregan objetos por parámetro, ej: { name: 'lore', value: 'text' }
		if (typeof input.value === "string") return input.value;
		if (typeof input.lore === "string") return input.lore;
		if (typeof input.text === "string") return input.text;
		if (typeof input.rawtext === "string") return input.rawtext;
		if (typeof input.rawText === "string") return input.rawText;

		// Fallback: busca recursivamente el primer string en el objeto (poco profundo).
		for (const value of Object.values(input)) {
			if (typeof value === "string") return value;
			if (Array.isArray(value) || (value && typeof value === "object")) {
				const nested = extractStringValue(value);
				if (typeof nested === "string") return nested;
			}
		}
	}

	return null;
}


function parseLoreText(rawInput) {
	const asString = extractStringValue(rawInput);
	if (typeof asString !== "string") return null;

	let trimmed = asString.trim();
	if (trimmed.length === 0) return null;

	// Si el motor entrega comillas incluidas, las removemos.
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		trimmed = trimmed.slice(1, -1);
	}

	// Saltos de línea: usar "\n" (backslash + n).
	// Nota: dependiendo de la versión/parseo del comando, "\n" puede llegar como:
	// - caracteres "\\" + "n"
	// - o como un salto real (\n) / carriage return (\r)
	// Por eso normalizamos TODO a "\n" antes de separar líneas.
	const withEscapedNewlines = trimmed.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");
	const normalizedNewlines = withEscapedNewlines.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const rawLines = normalizedNewlines.split("\n");
	if (rawLines.length === 0 || rawLines.length > MAX_LORE_LINES) return null;

	// Si el usuario no usó códigos § en todo el input, por default usar blanco (§f).
	const hasAnyFormattingCodes = normalizedNewlines.includes("§");
	let currentState = { color: "f", modifiers: new Set() };

	const result = [];
	for (let index = 0; index < rawLines.length; index++) {
		const line = rawLines[index] != null ? rawLines[index] : "";

		let effectiveLine = line;
		if (!hasAnyFormattingCodes) {
			// Default a blanco cuando no se incluye ningún §.
			effectiveLine = `§f${effectiveLine}`;
		} else {
			// Mantener color/formato entre líneas.
			effectiveLine = `${formatPrefixFromState(currentState)}${effectiveLine}`;
		}

		// Validaciones con el resultado final.
		if (effectiveLine.length > MAX_LORE_LINE_LENGTH) return null;
		result.push(effectiveLine);

		currentState = stateAfterText(effectiveLine, currentState);
	}

	return result;
}

/**
 * Handler del comando setlore.
 * Sintaxis: /setlore <string>
 * - El string puede incluir \n para saltos de línea.
 * - Aplica/reescribe el lore en el item de la mano principal.
 *
 * @param {import("@minecraft/server").CustomCommandOrigin} origin
 * @param {string} loreText
 */
export function handleSetLoreCommand(origin, loreText) {
	const player = origin.sourceEntity;
	if (!player) return;

	const loreLines = parseLoreText(loreText);
	if (!loreLines) {
		player.sendMessage(INVALID_STRING_MESSAGE);
		return;
	}

	// IMPORTANTE:
	// En algunas builds, el callback de custom commands puede ejecutarse en un contexto
	// donde mutar inventario/lore arroja error (read-only). Programamos la mutación al siguiente tick.
	system.run(() => {
		// Usar el id explícito evita problemas de compatibilidad entre versiones.
		const equippable = player.getComponent("minecraft:equippable");
		if (!equippable) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		let currentItem;
		try {
			currentItem = equippable.getEquipment(EquipmentSlot.Mainhand);
		} catch (e) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		if (!currentItem) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		let hadLoreBefore = false;
		try {
			const lore = currentItem && typeof currentItem.getLore === "function" ? currentItem.getLore() : null;
			const len = lore && lore.length != null ? lore.length : 0;
			hadLoreBefore = len > 0;
		} catch (e) {
			void e;
			// DEBUG: si falla getLore, igual intentamos setearlo.
			hadLoreBefore = false;
		}

		let updatedItem;
		try {
			updatedItem = currentItem.clone();
		} catch (e) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		try {
			updatedItem.setLore(loreLines);
		} catch (e) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		try {
			const didEquip = equippable.setEquipment(EquipmentSlot.Mainhand, updatedItem);
			if (!didEquip) {
				player.sendMessage(INVALID_STRING_MESSAGE);
				return;
			}
		} catch (e) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		player.sendMessage(hadLoreBefore ? SUCCESS_OVERWROTE_MESSAGE : SUCCESS_APPLIED_MESSAGE);
	});
}
