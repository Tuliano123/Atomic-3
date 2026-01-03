// AntiCheat context builder (solo arquitectura)

import { createAntiCheatLogger } from "./logger.js";
import { createSanctionsManager } from "./sanctions.js";
import { createWarningsManager } from "./warnings.js";
import { initPlayerStore } from "./playerStore.js";
import { isAntiCheatEnabled } from "./featureFlags.js";

/**
 * @param {{ config: any }} options
 */
export function createAntiCheatContext(options) {
	const config = options && options.config ? options.config : {};

	// Inicializa persistencia basada en scoreboards (configurable).
	initPlayerStore(config);

	const logger = createAntiCheatLogger({ config });
	const sanctions = createSanctionsManager({ config, logger });
	const warnings = createWarningsManager({ config, logger, sanctions });

	/** @type {any} */
	const ctx = {
		config,
		logger,
		warnings,
		sanctions,

		// Reservado para estado runtime (cooldowns, ventanas, muestras, etc.)
		state: {
			// checkId -> any
			checks: new Map(),
		},

		// Punto único de reporte: checks llaman a ctx.enforce.flag() para registrar una advertencia interna.
		// Importante: NO banea directamente. Escala con umbrales (ver config/policy).
		enforce: {
			flag(player, reason, meta) {
				// Global kill-switch por scriptevent (host/owner).
				if (!isAntiCheatEnabled()) return;

				const metaObj = meta || {};

				// Algunos checks son 100% indicativo de cheat (por ejemplo stacks imposibles).
				// Para esos casos se permite escalar inmediatamente a sanción temporal.
				if (metaObj.immediateSanction) {
					if (warnings && typeof warnings.triggerImmediateSanction === "function") {
						warnings.triggerImmediateSanction({
							player: player,
							checkId: metaObj.checkId != null ? metaObj.checkId : "unknown",
							reason: reason,
							sanctionId: metaObj.sanctionId,
							details: metaObj.details != null ? metaObj.details : null,
						});
					}
					return;
				}

				let severity = metaObj.severity != null ? metaObj.severity : 1;
				const tpsSensitive = metaObj.tpsSensitive !== false;
				if (tpsSensitive) {
					const tpsState = ctx && ctx.state && ctx.state.checks && typeof ctx.state.checks.get === "function" ? ctx.state.checks.get("tps") : null;
					const multiplier = Number(tpsState && tpsState.multiplier != null ? tpsState.multiplier : 1);
					if (Number.isFinite(multiplier) && multiplier >= 0 && multiplier < 1) {
						severity = Math.floor(Number(severity) * multiplier);
						// Adjuntar contexto para auditoría (sin revelar más de lo necesario).
						const d = metaObj.details && typeof metaObj.details === "object" ? metaObj.details : {};
						const merged = {
							_tps: tpsState && tpsState.tps != null ? tpsState.tps : undefined,
							_tpsMul: multiplier,
						};
						for (const k in d) merged[k] = d[k];
						metaObj.details = merged;
					}
				}

				warnings.addInternalWarning({
					player: player,
					checkId: metaObj.checkId != null ? metaObj.checkId : "unknown",
					reason: reason,
					severity: severity,
					details: metaObj.details != null ? metaObj.details : null,
				});
			},
		},
	};

	return ctx;
}
