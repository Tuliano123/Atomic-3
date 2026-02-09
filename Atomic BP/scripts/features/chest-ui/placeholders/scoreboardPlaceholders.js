import { world } from "@minecraft/server";

/**
 * Reemplaza placeholders ${...} en un string.
 *
 * Formato nuevo (estándar):
 *   ${(objective)[capObjective]:target:useCommas:multiplier}
 * - (objective) requerido.
 * - [capObjective] opcional: aplica cap ANTES del multiplicador.
 *
 * Formato viejo (compat):
 *   ${objective:selector:useCommas:multiplier}
 * - Acepta 3 params (multiplier=1) o 4 params.
 *
 * - Fallback total a 0 ante cualquier error de lectura.
 * - Siempre hace floor(score*multiplier) y nunca muestra floats.
 *
 * @param {string} text
 * @param {{ player?: import("@minecraft/server").Player, clampMin0?: boolean }=} ctx
 */
export function replaceScoreboardPlaceholders(text, ctx = undefined) {
	try {
		if (typeof text !== "string") return text;
		if (!text.includes("${") && !text.includes("$[")) return text;

		// 1) $[...] primero (puede generar texto que incluya ${...})
		if (text.includes("$[")) text = replaceConditionalPlaceholders(text, ctx);
		// Si no hay ${...}, ya terminamos.
		if (!text.includes("${")) return text;

		const player = ctx?.player;
		const clampMin0 = ctx?.clampMin0 !== false; // default true

		return text.replace(/\$\{([^}]*)\}/g, (_m, innerRaw) => {
			try {
				const inner = String(innerRaw ?? "").trim();
				const parsed = parseScoreboardPlaceholderInner(inner);
				if (!parsed) return "0";
				const { objectiveId, capExpr, selector, useCommas, multiplier } = parsed;

				const baseScore = readScoreSelectorBestEffort(objectiveId, selector, player);
				let base = Math.trunc(Number(baseScore));
				if (!Number.isFinite(base)) base = 0;

				// Regla nueva: multiplicador primero, luego cap.
				let scaled = Math.floor(base * multiplier);
				if (!Number.isFinite(scaled)) scaled = 0;
				scaled = Math.trunc(scaled);

				let value = scaled;
				if (capExpr) {
					const capValue = evaluateCapExpression(capExpr, selector, player);
					value = Math.min(scaled, capValue);
				}
				if (!Number.isFinite(value)) value = 0;
				value = Math.trunc(value);
				if (clampMin0 && value < 0) value = 0;

				return useCommas ? formatIntWithCommas(value) : String(value);
			} catch (e) {
				void e;
				return "0";
			}
		});
	} catch (e) {
		void e;
		return typeof text === "string" ? text : "0";
	}
}

function parseScoreboardPlaceholderInner(innerRaw) {
	try {
		const inner = String(innerRaw ?? "").trim();
		if (!inner) return null;

		// Nuevo formato: (objective)[capExpr]:target:useCommas:multiplier
		if (inner.startsWith("(")) {
			const closeParen = inner.indexOf(")", 1);
			if (closeParen < 0) return null;
			const objectiveId = inner.slice(1, closeParen);
			if (!String(objectiveId).trim()) return null;

			let i = closeParen + 1;
			let capExpr = "";
			if (inner[i] === "[") {
				const closeBracket = inner.indexOf("]", i + 1);
				if (closeBracket < 0) return null;
				capExpr = inner.slice(i + 1, closeBracket);
				i = closeBracket + 1;
			}

			if (inner[i] !== ":") return null;
			const rest = inner.slice(i + 1);
			const { selector, useCommas, multiplier } = parseScoreboardPlaceholderRest(rest);
			if (!selector) return null;
			return {
				objectiveId: String(objectiveId).trim(),
				capExpr: String(capExpr ?? "").trim() || "",
				selector,
				useCommas,
				multiplier,
			};
		}

		// Formato viejo: objective:target:useCommas(:multiplier)
		const parts = inner.split(":");
		if (parts.length !== 3 && parts.length !== 4) return null;
		const objectiveId = String(parts[0] ?? "").trim();
		const selector = String(parts[1] ?? "").trim();
		const useCommasRaw = String(parts[2] ?? "").trim().toLowerCase();
		const multiplierRaw = parts.length === 4 ? String(parts[3] ?? "").trim() : "1";

		if (!objectiveId || !selector) return null;
		const useCommas = useCommasRaw === "true";
		let multiplier = Number(multiplierRaw);
		if (!Number.isFinite(multiplier)) multiplier = 1;
		return { objectiveId, capExpr: "", selector, useCommas, multiplier };
	} catch (e) {
		void e;
		return null;
	}
}

function parseScoreboardPlaceholderRest(restRaw) {
	try {
		const rest = String(restRaw ?? "");
		// target:useCommas:multiplier (multiplier opcional)
		const parts = rest.split(":");
		if (parts.length < 2) return { selector: "", useCommas: false, multiplier: 1 };
		const selector = String(parts[0] ?? "").trim();
		const useCommasRaw = String(parts[1] ?? "").trim().toLowerCase();
		const multiplierRaw = parts.length >= 3 ? String(parts.slice(2).join(":")).trim() : "1";
		const useCommas = useCommasRaw === "true";
		let multiplier = Number(multiplierRaw);
		if (!Number.isFinite(multiplier)) multiplier = 1;
		return { selector, useCommas, multiplier };
	} catch (e) {
		void e;
		return { selector: "", useCommas: false, multiplier: 1 };
	}
}

function evaluateCapExpression(exprRaw, selector, player) {
	try {
		let expr = String(exprRaw ?? "").trim();
		if (!expr) return 0;
		// Permitir espacios alrededor del operador.
		expr = expr.replace(/\s+/g, "");
		if (!expr) return 0;

		// Buscar un único operador binario.
		const ops = ["+", "-", "*", "/"];
		let opIndex = -1;
		let op = "";
		for (const candidate of ops) {
			const idx = expr.indexOf(candidate);
			if (idx > 0 && idx < expr.length - 1) {
				opIndex = idx;
				op = candidate;
				break;
			}
		}

		// Sin operador: objective simple.
		if (opIndex === -1) {
			const v = readScoreSelectorBestEffort(expr, selector, player);
			const n = Math.trunc(Number(v));
			return Number.isFinite(n) ? Math.max(0, n) : 0;
		}

		const leftObj = expr.slice(0, opIndex);
		const rightObj = expr.slice(opIndex + 1);
		if (!leftObj || !rightObj) return 0;

		const a0 = readScoreSelectorBestEffort(leftObj, selector, player);
		const b0 = readScoreSelectorBestEffort(rightObj, selector, player);
		const a = Math.trunc(Number(a0));
		const b = Math.trunc(Number(b0));
		if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;

		let out = 0;
		switch (op) {
			case "+":
				out = a + b;
				break;
			case "-":
				out = a - b;
				break;
			case "*":
				out = a * b;
				break;
			case "/":
				if (b <= 0) out = 0;
				else out = Math.floor(a / b);
				break;
			default:
				out = 0;
		}

		out = Math.trunc(out);
		if (!Number.isFinite(out)) return 0;
		// Cap negativo no es útil: clamp a 0 para evitar min(scaled, negativo).
		return Math.max(0, out);
	} catch (e) {
		void e;
		return 0;
	}
}

/**
 * Reemplaza placeholders condicionales:
 * $[condTarget:condScore:condSign:condInt:(message)]
 *
 * Reglas:
 * - condTarget: por ahora solo @s
 * - Si cumple: reemplaza por message
 * - Si no cumple o está mal formado: reemplaza por ""
 *
 * Nota: el message puede contener ${...}; se resuelve después en el pipeline.
 *
 * @param {string} text
 * @param {{ player?: import("@minecraft/server").Player }=} ctx
 */
export function replaceConditionalPlaceholders(text, ctx = undefined) {
	try {
		if (typeof text !== "string") return text;
		if (!text.includes("$[")) return text;
		const player = ctx?.player;

		// Importante: en lore el texto se arma con "\n". Si un $[...] va solo en una línea
		// y la condición falla, debemos eliminar la línea (no dejarla vacía).
		const lines = String(text).split("\n");
		const outLines = [];
		for (const line of lines) {
			const original = String(line);
			if (!original.includes("$[")) {
				outLines.push(original);
				continue;
			}
			const replaced = replaceConditionalPlaceholdersInline(original, player);
			const isOnlyToken = /^\s*\$\[.*\]\s*$/.test(original);
			if (isOnlyToken && String(replaced).trim() === "") continue;
			outLines.push(replaced);
		}
		return outLines.join("\n");
	} catch (e) {
		void e;
		return typeof text === "string" ? text : "";
	}
}

function replaceConditionalPlaceholdersInline(text, player) {
	try {
		let out = "";
		for (let i = 0; i < text.length; i++) {
			// Detecta inicio
			if (text[i] !== "$" || text[i + 1] !== "[") {
				out += text[i];
				continue;
			}
			let j = i + 2;
			let parenDepth = 0;
			let foundEnd = false;
			for (; j < text.length; j++) {
				const ch = text[j];
				if (ch === "(") parenDepth++;
				else if (ch === ")" && parenDepth > 0) parenDepth--;
				else if (ch === "]" && parenDepth === 0) {
					foundEnd = true;
					break;
				}
			}
			if (!foundEnd) {
				// Mal formado: quitar el token y seguir
				continue;
			}

			const inner = text.slice(i + 2, j);
			const replacement = evalConditionalInner(inner, player);
			out += replacement;
			i = j; // saltar hasta ']'
		}
		return out;
	} catch (e) {
		void e;
		return "";
	}
}

function evalConditionalInner(innerRaw, player) {
	try {
		const inner = String(innerRaw ?? "").trim();
		if (!inner) return "";

		// Split en 4 ':' (target, score, sign, int) y el resto es messagePart
		const parts = [];
		let start = 0;
		for (let k = 0; k < inner.length && parts.length < 4; k++) {
			if (inner[k] !== ":") continue;
			parts.push(inner.slice(start, k));
			start = k + 1;
		}
		if (parts.length !== 4) return "";
		const messagePart = inner.slice(start);

		const condTarget = String(parts[0] ?? "").trim();
		const condScore = String(parts[1] ?? "").trim();
		const condSign = String(parts[2] ?? "").trim();
		const condIntRaw = String(parts[3] ?? "").trim();

		if (condTarget !== "@s") return "";
		if (!condScore) return "";
		if (typeof messagePart !== "string") return "";
		const msg = String(messagePart);
		if (!msg.startsWith("(") || !msg.endsWith(")")) return "";
		const message = msg.slice(1, -1);

		const lhs = readScoreSelectorBestEffort(condScore, "@s", player);
		const rhs = resolveConditionalRhs(condIntRaw, player);
		if (!compareInts(lhs, condSign, rhs)) return "";
		return message;
	} catch (e) {
		void e;
		return "";
	}
}

/**
 * condInt puede ser:
 * - Entero: "10"
 * - Scoreboard: "DB" o "(DBlimite)" o "(Nombre con espacios)"
 * Cuando es scoreboard, se lee como objectiveId para @s.
 */
function resolveConditionalRhs(condIntRaw, player) {
	try {
		const raw = String(condIntRaw ?? "").trim();
		if (!raw) return 0;

		// 1) Si es número válido, usarlo.
		const n = Math.trunc(Number(raw));
		if (Number.isFinite(n)) return n;

		// 2) Scoreboard (si viene entre paréntesis permite espacios)
		let objectiveId = raw;
		if (objectiveId.startsWith("(") && objectiveId.endsWith(")") && objectiveId.length >= 3) {
			objectiveId = objectiveId.slice(1, -1).trim();
		}
		if (!objectiveId) return 0;
		return readScoreSelectorBestEffort(objectiveId, "@s", player);
	} catch (e) {
		void e;
		return 0;
	}
}

function compareInts(a, sign, b) {
	const lhs = Math.trunc(Number(a));
	const rhs = Math.trunc(Number(b));
	if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) return false;
	switch (String(sign)) {
		case ">=":
			return lhs >= rhs;
		case "<=":
			return lhs <= rhs;
		case "==":
			return lhs === rhs;
		case "!=":
			return lhs !== rhs;
		case ">":
			return lhs > rhs;
		case "<":
			return lhs < rhs;
		default:
			return false;
	}
}

/**
 * Lee un score con selector '@s' o nombre (fake player / literal).
 * Fallback total: 0.
 *
 * @param {string} objectiveId
 * @param {string} selector
 * @param {import("@minecraft/server").Player=} player
 */
export function readScoreSelectorBestEffort(objectiveId, selector, player = undefined) {
	try {
		const obj = world.scoreboard.getObjective(String(objectiveId ?? "").trim());
		if (!obj) return 0;

		const sel = String(selector ?? "").trim();
		if (!sel) return 0;

		// @s
		if (sel === "@s") {
			try {
				const id = player?.scoreboardIdentity;
				if (!id) return 0;
				const v = obj.getScore(id);
				const n = Math.trunc(Number(v));
				return Number.isFinite(n) ? n : 0;
			} catch (e) {
				void e;
				return 0;
			}
		}

		// Preferir identity si coincide con jugador online
		try {
			for (const p of world.getPlayers()) {
				if (!p) continue;
				if (p.name === sel || p.nameTag === sel) {
					const id = p.scoreboardIdentity;
					if (id) {
						const iv = obj.getScore(id);
						const inum = Math.trunc(Number(iv));
						if (Number.isFinite(inum)) return inum;
					}
					break;
				}
			}
		} catch (e) {
			void e;
		}

		// string (fake player típico)
		try {
			const sv = obj.getScore(sel);
			const sn = Math.trunc(Number(sv));
			if (Number.isFinite(sn) && sn !== 0) return sn;
		} catch (e) {
			void e;
		}

		// getParticipants fallback (identity)
		try {
			if (typeof obj.getParticipants === "function") {
				for (const part of obj.getParticipants()) {
					if (!part) continue;
					let displayName = "";
					try {
						if (typeof part.displayName === "string") displayName = part.displayName;
						else if (typeof part.getDisplayName === "function") displayName = part.getDisplayName();
					} catch (e) {
						void e;
					}
					if (!displayName) continue;
					if (String(displayName) !== sel) continue;
					const pv = obj.getScore(part);
					const pn = Math.trunc(Number(pv));
					return Number.isFinite(pn) ? pn : 0;
				}
			}
		} catch (e) {
			void e;
		}

		// último intento: devolver 0 o el string-score si existe
		try {
			const sv = obj.getScore(sel);
			const sn = Math.trunc(Number(sv));
			return Number.isFinite(sn) ? sn : 0;
		} catch (e) {
			void e;
			return 0;
		}
	} catch (e) {
		void e;
		return 0;
	}
}

export function formatIntWithCommas(n) {
	try {
		let num = Math.trunc(Number(n));
		if (!Number.isFinite(num)) num = 0;
		try {
			return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num);
		} catch (e) {
			void e;
			const s = String(num);
			const sign = s.startsWith("-") ? "-" : "";
			const raw = sign ? s.slice(1) : s;
			return sign + raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}
	} catch (e) {
		void e;
		return "0";
	}
}
