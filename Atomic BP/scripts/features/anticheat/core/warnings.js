// AntiCheat warnings manager (arquitectura)
// Mantiene advertencias internas para reducir falsos positivos y escalar gradualmente.

import { addPlayerWarnings, getPlayerWarnings, setPlayerWarnings } from "./playerStore.js";

function nowMs() {
	return Date.now();
}

function clampInt(value, min, max) {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.min(max, Math.max(min, Math.floor(n)));
}

function getPlayerKey(player) {
	// Para el estado interno (no persistente) usamos id/name.
	if (player && player.id != null) return player.id;
	if (player && player.name != null) return player.name;
	return "unknown";
}

/**
 * @param {{ config?: any, logger?: any, sanctions?: any }} options
 */
export function createWarningsManager(options) {
	const config = options && options.config ? options.config : {};
	const logger = options ? options.logger : undefined;
	const sanctions = options ? options.sanctions : undefined;

	const warningsCfg = config && config.warnings ? config.warnings : {};
	const internalCfg = warningsCfg.internal ? warningsCfg.internal : {};
	const playerCfg = warningsCfg.player ? warningsCfg.player : {};

	const decaySeconds = clampInt(internalCfg.decaySeconds != null ? internalCfg.decaySeconds : 1800, 0, 60 * 60 * 24 * 30);
	const pointsPerPlayerWarning = clampInt(internalCfg.pointsPerPlayerWarning != null ? internalCfg.pointsPerPlayerWarning : 4, 1, 1000000);
	const maxStoredPlayers = clampInt(internalCfg.maxStoredPlayers != null ? internalCfg.maxStoredPlayers : 500, 10, 50000);
	const internalDebugLog = Boolean(internalCfg.debugLog != null ? internalCfg.debugLog : false);

	const sanctionAtWarnings = clampInt(playerCfg.sanctionAtWarnings != null ? playerCfg.sanctionAtWarnings : 3, 1, 1000);
	const sanctionIdDefault = Number(playerCfg.sanctionId != null ? playerCfg.sanctionId : 1);
	const notifyCooldownMs = clampInt(playerCfg.notifyCooldownMs != null ? playerCfg.notifyCooldownMs : 450, 0, 10000);

	// Anti-spam: evita 2 mensajes seguidos en el mismo tick/instante.
	const lastNotifyByPlayer = new Map();

	/**
	 * Estado interno (se resetea):
	 * playerKey -> { points: number, lastTs: number, byCheck: Map<string, number> }
	 */
	const stateByPlayer = new Map();

	function cleanupIfNeeded() {
		if (stateByPlayer.size <= maxStoredPlayers) return;
		// Simple eviction: elimina los más viejos
		const entries = Array.from(stateByPlayer.entries());
		entries.sort((a, b) => ((a[1] && a[1].lastTs != null ? a[1].lastTs : 0) - (b[1] && b[1].lastTs != null ? b[1].lastTs : 0)));
		const removeCount = Math.max(1, entries.length - maxStoredPlayers);
		for (let i = 0; i < removeCount; i++) stateByPlayer.delete(entries[i][0]);
	}

	function decayOld(playerKey) {
		if (decaySeconds <= 0) return;
		const entry = stateByPlayer.get(playerKey);
		if (!entry) return;
		const ageMs = nowMs() - (entry.lastTs != null ? entry.lastTs : 0);
		if (ageMs >= decaySeconds * 1000) {
			stateByPlayer.delete(playerKey);
		}
	}

	function ensurePlayer(playerKey) {
		let entry = stateByPlayer.get(playerKey);
		if (!entry) {
			entry = { points: 0, lastTs: nowMs(), byCheck: new Map() };
			stateByPlayer.set(playerKey, entry);
			cleanupIfNeeded();
		}
		return entry;
	}

	function notifyPlayerWarningAdded(player, playerKey, warningsCount) {
		try {
			if (notifyCooldownMs > 0) {
				const ts = nowMs();
				const lastTs = Number(lastNotifyByPlayer.get(playerKey) || 0);
				if (ts - lastTs < notifyCooldownMs) return;
				lastNotifyByPlayer.set(playerKey, ts);
			}
			if (player && typeof player.sendMessage === "function")
				player.sendMessage(
				`§c[AntiCheat] Advertencia §e${warningsCount}§c/§e${sanctionAtWarnings}§c. Si crees que es un error, repórtalo al staff.`
			);
		} catch (e) {
			void e;
			// ignore
		}
	}

	function maybeSanction(player, checkId, warningsCount, reason) {
		if (warningsCount < sanctionAtWarnings) return;

		const sanction = {
			sanctionId: sanctionIdDefault,
			checkId,
			reason: reason != null ? reason : "warnings_threshold_reached",
			count: warningsCount,
		};

		// Importante: ninguna sanción es permanente. Aquí solo se delega a un manager.
		try {
			if (sanctions && typeof sanctions.apply === "function") sanctions.apply(player, sanction);
		} catch (e) {
			void e;
			// ignore
		}
	}

	function notifyImmediateSanction(player) {
		try {
			if (player && typeof player.sendMessage === "function")
				player.sendMessage(
				"§c[AntiCheat] Se detectó una anomalía imposible (cheat). Se aplicará una sanción temporal."
			);
		} catch (e) {
			void e;
			// ignore
		}
	}

	/**
	 * Caso especial: evidencia 100% (hard-flag).
	 * - No pasa por acumulación/decay.
	 * - Sube al jugador directo al umbral de sanción.
	 *
	 * @param {{ player:any, checkId:string, reason?:string, details?:any }} input
	 */
	function triggerImmediateSanction(input) {
		const player = input ? input.player : null;
		if (!player) return;
		const checkId = String(input && input.checkId != null ? input.checkId : "unknown");
		const reason = input && input.reason != null ? input.reason : "hard_flag";
		const sanctionId = input && input.sanctionId != null ? input.sanctionId : sanctionIdDefault;

		// Forzamos las advertencias del jugador al umbral configurado.
		// Esto cumple la política: sanción inmediata sin necesidad de acumular.
		try {
			setPlayerWarnings(player, sanctionAtWarnings);
		} catch (e0) {
			void e0;
		}
		let warningsCount = 0;
		try {
			warningsCount = getPlayerWarnings(player);
		} catch (e1) {
			void e1;
			warningsCount = sanctionAtWarnings;
		}

		if (logger && typeof logger.warn === "function") {
			logger.warn({
				checkId: checkId,
				player: player,
				message: "Immediate sanction triggered (hard-flag)",
				data: { warnings: warningsCount, reason: reason, sanctionId: sanctionId, details: input && input.details != null ? input.details : null },
			});
		}

		notifyImmediateSanction(player);
		// Sanción inmediata: aplicamos sanción específica (hard-flag)
		try {
			if (sanctions && typeof sanctions.apply === "function") sanctions.apply(player, { sanctionId: sanctionId, checkId: checkId, reason: reason });
		} catch (e) {
			void e;
			// ignore
		}
	}

	function grantPlayerWarning(player, checkId, reason) {
		const playerKey = getPlayerKey(player);
		let before = 0;
		try {
			before = Math.max(0, Math.floor(getPlayerWarnings(player)));
		} catch (e0) {
			void e0;
			before = 0;
		}
		try {
			addPlayerWarnings(player, 1);
		} catch (e1) {
			void e1;
		}
		let warningsCount = 0;
		try {
			warningsCount = Math.max(0, Math.floor(getPlayerWarnings(player)));
		} catch (e2) {
			void e2;
			warningsCount = 0;
		}
		// Fix integridad UX: si el storage falló, evita "0/3".
		if (warningsCount <= 0) warningsCount = Math.max(1, before + 1);
		if (warningsCount < before) warningsCount = before + 1;
		// Best-effort: intenta corregir el valor persistente.
		try {
			setPlayerWarnings(player, warningsCount);
		} catch (e3) {
			void e3;
		}

		if (logger && typeof logger.warn === "function") {
			logger.warn({
				checkId: checkId,
				player: player,
				message: "Player warning granted",
				data: { warnings: warningsCount, reason: reason != null ? reason : null },
			});
		}

		notifyPlayerWarningAdded(player, playerKey, warningsCount);
		maybeSanction(player, checkId, warningsCount, reason);
	}

	/**
	 * Agrega una advertencia interna.
	 * @param {{ player:any, checkId:string, reason?:string, severity?:number, details?:any }} input
	 */
	function addInternalWarning(input) {
		const player = input ? input.player : null;
		const playerKey = getPlayerKey(player);
		if (!player || !playerKey) return;

		decayOld(playerKey);
		const entry = ensurePlayer(playerKey);

		const checkId = String(input && input.checkId != null ? input.checkId : "unknown");
		const severity = clampInt(input && input.severity != null ? input.severity : 1, 0, 100);
		if (severity <= 0) {
			if (logger && typeof logger.debug === "function") {
				logger.debug({
					checkId: checkId,
					player: player,
					message: "Internal warning ignored (severity=0)",
					data: { reason: input && input.reason != null ? input.reason : null, details: input && input.details != null ? input.details : null },
				});
			}
			return;
		}

		entry.points += severity;
		entry.lastTs = nowMs();
		const prev = entry.byCheck.get(checkId);
		entry.byCheck.set(checkId, (prev != null ? prev : 0) + severity);

		if (internalDebugLog && logger && typeof logger.debug === "function") {
			logger.debug({
				checkId: checkId,
				player: player,
				message: "Internal warning",
				data: {
					severity: severity,
					points: entry.points,
					reason: input && input.reason != null ? input.reason : null,
					details: input && input.details != null ? input.details : null,
				},
			});
		}

		// Convertir puntos internos en advertencias al jugador.
		while (entry.points >= pointsPerPlayerWarning) {
			entry.points -= pointsPerPlayerWarning;
			grantPlayerWarning(player, checkId, input && input.reason != null ? input.reason : undefined);
		}
	}

	function getSummary(player) {
		const playerKey = getPlayerKey(player);
		const entry = stateByPlayer.get(playerKey);
		if (!entry) return null;
		const byCheckObj = {};
		try {
			entry.byCheck.forEach((v, k) => {
				byCheckObj[String(k)] = v;
			});
		} catch (e) {
			void e;
			// ignore
		}
		let pw = 0;
		try {
			pw = getPlayerWarnings(player);
		} catch (e2) {
			void e2;
			pw = 0;
		}
		return {
			internalPoints: entry.points,
			playerWarnings: pw,
			byCheck: byCheckObj,
			lastTs: entry.lastTs,
		};
	}

	// Manual: "buen comportamiento" / staff.
	function setPlayerWarningCount(player, count, meta) {
		const ok = setPlayerWarnings(player, count);
		if (logger && typeof logger.info === "function") {
			logger.info({
				checkId: meta && meta.checkId != null ? meta.checkId : "admin",
				player: player,
				message: "Player warnings adjusted",
				data: { ok: ok, count: count },
			});
		}
		return ok;
	}

	// Reporte del jugador: por política, puede usarse para limpiar (queda log para auditoría).
	function playerReported(player, meta) {
		const before = getPlayerWarnings(player);
		const ok = setPlayerWarnings(player, 0);
		if (logger && typeof logger.warn === "function") {
			logger.warn({
				checkId: meta && meta.checkId != null ? meta.checkId : "report",
				player: player,
				message: "Player reported issue; warnings cleared",
				data: { ok: ok, before: before },
			});
		}
		return ok;
	}

	return {
		addInternalWarning,
		getSummary,
		setPlayerWarningCount,
		playerReported,
		triggerImmediateSanction,
		_resetAllForTestsOnly() {
			stateByPlayer.clear();
		},
	};
}
