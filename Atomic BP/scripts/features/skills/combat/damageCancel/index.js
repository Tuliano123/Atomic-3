import { system, world } from "@minecraft/server";
import { isHEnabled } from "./score.js";

// Feature: skills/combat/damageCancel
//
// Objetivo:
// - Evitar que el jugador pierda HP vanilla al recibir daño si su scoreboard `H` es 1.
//
// Restricciones:
// - NO Dynamic Properties
// - NO APIs experimentales
// - NO overrides JSON de `minecraft:player` (player.json), porque rompe el actor y el gameplay.
//
// Implementación:
// - Preferido: cancelar el evento en `world.beforeEvents.entityHurt`.
// - Fallback: restaurar HP en `world.afterEvents.entityHurt`.
// - Tag opcional `hp_mode` solo para debug (no cancela nada por sí solo).

const DEFAULT_LOOP_TICKS = 10;
const DEBUG_TAG = "hp_mode";

let didInit = false;

/** @type {Map<string, boolean>} */
const lastEnabledByPlayerKey = new Map();

function getPlayerKey(player) {
	try {
		const sbid = player?.scoreboardIdentity?.id;
		if (sbid != null) return `sb:${String(sbid)}`;
		if (player?.id) return `pl:${String(player.id)}`;
		if (player?.name) return `nm:${String(player.name)}`;
	} catch (e) {
		void e;
	}
	return null;
}

function safeHasTag(player, tag) {
	try {
		return player?.hasTag?.(tag) === true;
	} catch (e) {
		void e;
		return false;
	}
}

function safeAddTag(player, tag) {
	try {
		player?.addTag?.(tag);
	} catch (e) {
		void e;
	}
}

function safeRemoveTag(player, tag) {
	try {
		player?.removeTag?.(tag);
	} catch (e) {
		void e;
	}
}

function tryHealBackDamage(player, damageAmount) {
	// Fallback: si no pudimos cancelar antes del daño, intentamos restaurar HP inmediatamente.
	// Nota: si el daño es letal en el mismo tick, este fallback puede no alcanzar.
	try {
		const hc = player?.getComponent?.("minecraft:health");
		if (!hc) return;
		const dmg = Number(damageAmount);
		if (!Number.isFinite(dmg) || dmg <= 0) return;

		const cur = Number(hc.currentValue);
		const max = Number(hc.effectiveMax);
		if (!Number.isFinite(cur) || !Number.isFinite(max)) return;

		const restored = Math.min(max, cur + dmg);
		if (typeof hc.setCurrentValue === "function") {
			hc.setCurrentValue(restored);
		}
	} catch (e) {
		void e;
	}
}

function syncDebugTag(loopTag, player, enabled) {
	if (!loopTag) return;
	const has = safeHasTag(player, loopTag);
	if (enabled) {
		if (!has) safeAddTag(player, loopTag);
	} else {
		if (has) safeRemoveTag(player, loopTag);
	}
}

export function initVanillaDamageCancel(options = undefined) {
	if (didInit) return;
	didInit = true;

	const loopTicks = Math.max(1, Math.trunc(options?.loopTicks ?? DEFAULT_LOOP_TICKS));
	const tag = String(options?.tag ?? DEBUG_TAG);

	// Loop liviano para:
	// - actualizar tag debug (opcional)
	// - mantener cache de enabled por jugador
	system.runInterval(() => {
		try {
			/** @type {Set<string>} */
			const alive = new Set();

			for (const player of world.getPlayers()) {
				const key = getPlayerKey(player);
				if (key) alive.add(key);

				const enabled = isHEnabled(player);
				if (key) lastEnabledByPlayerKey.set(key, enabled);

				// debug tag: útil para confirmar que el gating está activo
				syncDebugTag(tag, player, enabled);
			}

			// Cleanup de jugadores que ya no están
			for (const key of lastEnabledByPlayerKey.keys()) {
				if (!alive.has(key)) lastEnabledByPlayerKey.delete(key);
			}
		} catch (e) {
			void e;
		}
	}, loopTicks);

	// Preferido: cancelar el daño antes de aplicarse.
	try {
		const be = world.beforeEvents;
		if (be?.entityHurt && typeof be.entityHurt.subscribe === "function") {
			be.entityHurt.subscribe((ev) => {
				try {
					const ent = ev?.hurtEntity;
					if (!ent || ent.typeId !== "minecraft:player") return;
					const player = ent;
					// Usar cache si existe (para no leer scoreboard en cada hurt), si no leer directo.
					const key = getPlayerKey(player);
					const enabled = key ? (lastEnabledByPlayerKey.get(key) ?? isHEnabled(player)) : isHEnabled(player);
					if (!enabled) return;
					ev.cancel = true;
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}

	// Fallback: restaurar HP tras daño aplicado.
	try {
		const ae = world.afterEvents;
		if (ae?.entityHurt && typeof ae.entityHurt.subscribe === "function") {
			ae.entityHurt.subscribe((ev) => {
				try {
					const ent = ev?.hurtEntity;
					if (!ent || ent.typeId !== "minecraft:player") return;
					const player = ent;
					const key = getPlayerKey(player);
					const enabled = key ? (lastEnabledByPlayerKey.get(key) ?? isHEnabled(player)) : isHEnabled(player);
					if (!enabled) return;
					tryHealBackDamage(player, ev.damage);
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}
}
