import { world } from "@minecraft/server";

// Feature: skills/combat/damageCancel
// Score helpers
//
// Objetivo:
// - Leer `H` por API de scoreboard sin comandos (más barato y estable).
// - Si el objective no existe o identity no está listo, tratar como 0.

const OBJ_H = "H";

/** @type {import('@minecraft/server').ScoreboardObjective | null} */
let cachedObjectiveH = null;

function getObjectiveHBestEffort() {
	try {
		if (cachedObjectiveH) return cachedObjectiveH;
		const sb = world?.scoreboard;
		if (!sb) return null;
		cachedObjectiveH = sb.getObjective(OBJ_H) || null;
		return cachedObjectiveH;
	} catch (e) {
		void e;
		return null;
	}
}

export function getHScoreBestEffort(player) {
	try {
		const obj = getObjectiveHBestEffort();
		if (!obj) return 0;
		const id = player?.scoreboardIdentity;
		if (!id) return 0;
		const v = obj.getScore(id);
		return Number.isFinite(v) ? v : 0;
	} catch (e) {
		void e;
		return 0;
	}
}

export function isHEnabled(player) {
	return getHScoreBestEffort(player) === 1;
}
