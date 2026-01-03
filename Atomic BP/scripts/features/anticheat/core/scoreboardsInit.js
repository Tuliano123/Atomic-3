// Inicializador central de scoreboards del AntiCheat
//
// Objetivo:
// - Mantener en un solo lugar la creación de TODOS los objectives del anticheat.
// - Evitar errores por ciclo de vida: algunos entornos fallan si se crean objectives antes de worldLoad.
//
// Nota: la creación aquí es best-effort. Cada módulo (warnings/sanctions/featureFlags)
// sigue teniendo fallback si el objective no existe o no se puede crear.

import { system, world } from "@minecraft/server";
import { ensureObjectiveFromConfig } from "./scoreboardStore.js";

let didInit = false;

function safeEnsureAll(config, logger) {
	const storage = config && config.storage ? config.storage : {};
	const sb = storage.scoreboards ? storage.scoreboards : {};

	try {
		// Flags globales (no por jugador):
		// Participantes: "ac_enabled" y "ac_ban_kick_enabled" con score 0/1.
		ensureObjectiveFromConfig(sb.featureFlags, "ac_feature_flags", "ac_feature_flags");

		// Advertencias persistentes por jugador.
		ensureObjectiveFromConfig(sb.playerWarnings, "advertencias", "advertencias");

		// Estado de ban por jugador (persistente):
		// - ac_ban_until: epoch seconds (INT32_MAX = permanente)
		// - ac_ban_seconds: SEGUNDOS RESTANTES (sincronizado por core/banClock.js)
		// - ac_ban_sanction: id de sanción (2/3/6/7)
		ensureObjectiveFromConfig(sb.banUntil, "ac_ban_until", "ac_ban_until");
		ensureObjectiveFromConfig(sb.banSeconds, "ac_ban_seconds", "ac_ban_seconds");
		ensureObjectiveFromConfig(sb.banSanction, "ac_ban_sanction", "ac_ban_sanction");
	} catch (e) {
		void e;
		if (logger && typeof logger.warn === "function") {
			logger.warn({
				checkId: "scoreboards",
				player: null,
				message: "No se pudieron inicializar scoreboards del AntiCheat (best-effort)",
				data: null,
			});
		}
	}
}

/**
 * Inicializa (crea si no existen) todos los scoreboards del AntiCheat.
 * Se ejecuta después de `worldLoad` para máxima compatibilidad.
 *
 * @param {{ config?: any, logger?: any }} options
 */
export function initAntiCheatScoreboards(options) {
	if (didInit) return;
	didInit = true;

	const config = options && options.config ? options.config : {};
	const logger = options ? options.logger : undefined;

	let scheduled = false;
	try {
		if (world && world.afterEvents && world.afterEvents.worldLoad && typeof world.afterEvents.worldLoad.subscribe === "function") {
			world.afterEvents.worldLoad.subscribe(() => safeEnsureAll(config, logger));
			scheduled = true;
		}
	} catch (e) {
		void e;
		scheduled = false;
	}

	if (!scheduled) {
		// Fallback: siguiente tick (si worldLoad no existe en esa versión).
		try {
			system.run(() => safeEnsureAll(config, logger));
		} catch (e2) {
			void e2;
			safeEnsureAll(config, logger);
		}
	}
}
