import { world } from "@minecraft/server";
import { atomicEssentialMap } from "./packs/atomicEssential.js";
import { customEmojiShortcodes } from "./shortcodes.js";

let didInit = false;

function escapeForRegExp(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildReplacementRegex(maps) {
	const keys = [];
	for (const map of maps) {
		for (const key of map.keys()) keys.push(key);
	}
	// Ordenar por longitud desc para evitar casos raros (no aplica mucho aquí, pero es seguro)
	keys.sort((a, b) => b.length - a.length);
	const pattern = keys.map(escapeForRegExp).join("|");
	return pattern ? new RegExp(pattern, "g") : null;
}

const activeMaps = [atomicEssentialMap];
const replacementRegex = buildReplacementRegex(activeMaps);

function cp(hex) {
	return String.fromCodePoint(parseInt(hex, 16));
}

function applyPuaShortcodes(input) {
	// Permite escribir directamente el PUA por prefijo.
	// Formatos soportados:
	// - :e302:  -> U+E302
	// - :e41B:  -> U+E41B
	// - :e3A0:  -> U+E3A0
	// - :e4_A0: -> U+E4A0 (compat)
	let out = input;
	// Forma general (:eXYZ: o :eWXYZ:)
	out = out.replace(/:e([0-9a-fA-F]{3,4}):/gi, (_m, hex) => cp(`E${String(hex).toUpperCase()}`));
	// Compat con underscore (:e4_A0:)
	out = out.replace(/:e([34])_([0-9a-fA-F]{2}):/gi, (_m, bank, lo) =>
		cp(`E${String(bank).toUpperCase()}${String(lo).toUpperCase()}`)
	);
	return out;
}

export function applyCustomEmojisToText(input) {
	if (typeof input !== "string" || input.length === 0) return input;

	let out = input;
	// 0) Prefijo directo por PUA (:e3xx:/:e4xx:)
	out = applyPuaShortcodes(out);

	// 1) Shortcodes "humanos" a símbolo
	for (const [code, symbol] of customEmojiShortcodes) {
		if (!code) continue;
		out = out.split(code).join(symbol);
	}

	// 2) Símbolo a PUA
	if (!replacementRegex) return out;
	return out.replace(replacementRegex, (match) => {
		for (const map of activeMaps) {
			const rep = map.get(match);
			if (rep) return rep;
		}
		return match;
	});
}

function subscribeChatInterceptor() {
	// La API cambia entre versiones; intentamos varias rutas de manera segura.
	try {
		const before = world && world.beforeEvents ? world.beforeEvents : null;
		if (before && before.chatSend && typeof before.chatSend.subscribe === "function") {
			before.chatSend.subscribe((ev) => {
				try {
					if (!ev) return;
					const msg = typeof ev.message === "string" ? ev.message : "";
					const next = applyCustomEmojisToText(msg);
					if (next === msg) return;

					// Preferible: mutar el mensaje original (mantiene comportamiento vanilla).
					try {
						ev.message = next;
						return;
					} catch (e) {
						void e;
					}

					// Fallback: si la propiedad es read-only en esta build, cancelamos y re-enviamos.
					try {
						if ("cancel" in ev) ev.cancel = true;
					} catch (e) {
						void e;
					}

					try {
						const sender = ev.sender;
						const name = sender && sender.name ? sender.name : "?";
						world.sendMessage(`<${name}> ${next}`);
					} catch (e) {
						void e;
					}
				} catch (e) {
					void e;
				}
			});
			return true;
		}
	} catch (e) {
		void e;
	}

	// Si no se pudo enganchar, no rompemos nada; solo avisamos una vez.
	try {
		console.warn("[custom-emojis] chatSend no está disponible en esta versión/API. El reemplazo funcionará en lore y en textos controlados por scripts.");
	} catch (e) {
		void e;
	}
	return false;
}

export function initCustomEmojis() {
	if (didInit) return;
	didInit = true;

	subscribeChatInterceptor();
}
