import { world } from "@minecraft/server";

export const OBJ_H = "H";
export const OBJ_VIDA = "Vida";
export const OBJ_VIDA_MAX_BASE = "VidaMaxH";
export const OBJ_VIDA_MAX = "VidaMaxTotalH";
export const OBJ_VIDA_ABSORCION = "VidaAbsorcion";
export const OBJ_H_DEAD = "HDead";

/** @type {Map<string, any>} */
const objectiveCache = new Map();

function getObjectiveCached(objectiveId) {
	if (objectiveCache.has(objectiveId)) return objectiveCache.get(objectiveId) ?? null;
	try {
		const obj = world.scoreboard.getObjective(objectiveId) ?? null;
		objectiveCache.set(objectiveId, obj);
		return obj;
	} catch (e) {
		void e;
		objectiveCache.set(objectiveId, null);
		return null;
	}
}

export function ensureObjectiveBestEffort(objectiveId, displayName = undefined) {
	try {
		const existing = world.scoreboard.getObjective(objectiveId);
		if (existing) {
			objectiveCache.set(objectiveId, existing);
			return existing;
		}
	} catch (e) {
		void e;
	}
	// Creación migrada a scripts/scoreboards (init central)
	objectiveCache.set(objectiveId, null);
	void displayName;
	return null;
}

function getParticipant(entityOrPlayer) {
	try {
		return entityOrPlayer?.scoreboardIdentity ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

export function getScoreBestEffort(objectiveId, entityOrPlayer) {
	try {
		const obj = getObjectiveCached(objectiveId);
		if (!obj) return undefined;
		const p = getParticipant(entityOrPlayer);
		if (!p) return undefined;
		return obj.getScore(p);
	} catch (e) {
		// Normal: participant no existe aún
		void e;
		return undefined;
	}
}

export function setScoreBestEffort(objectiveId, entityOrPlayer, value) {
	try {
		const obj = getObjectiveCached(objectiveId) ?? ensureObjectiveBestEffort(objectiveId);
		if (!obj) return false;
		const p = getParticipant(entityOrPlayer);
		if (!p) return false;
		obj.setScore(p, Math.trunc(Number(value)));
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

export function isHEnabled(entityOrPlayer) {
	return getScoreBestEffort(OBJ_H, entityOrPlayer) === 1;
}
