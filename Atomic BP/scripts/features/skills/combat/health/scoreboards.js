import { world } from "@minecraft/server";

const INT32_MAX = 2147483647;
const INT32_MIN = -2147483648;

function clampInt32(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(INT32_MIN, Math.min(INT32_MAX, Math.trunc(n)));
}

export const OBJ_H = "H";
export const OBJ_VIDA = "Vida";
export const OBJ_VIDA_MAX_BASE = "VidaMaxH";
export const OBJ_VIDA_MAX = "VidaMaxTotalH";
export const OBJ_VIDA_ABSORCION = "VidaAbsorcion";
export const OBJ_H_DEAD = "HDead";

/** @type {Map<string, any>} */
const objectiveCache = new Map();

function getObjectiveCached(objectiveId) {
	// IMPORTANTE: durante worldLoad los objectives pueden no existir aún.
	// No cacheamos null permanentemente; si está null, reintentamos.
	if (objectiveCache.has(objectiveId)) {
		const cached = objectiveCache.get(objectiveId) ?? null;
		if (cached) return cached;
	}
	try {
		const obj = world.scoreboard.getObjective(objectiveId) ?? null;
		if (obj) objectiveCache.set(objectiveId, obj);
		return obj;
	} catch (e) {
		void e;
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
		obj.setScore(p, clampInt32(value));
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

export function isHEnabled(entityOrPlayer) {
	return getScoreBestEffort(OBJ_H, entityOrPlayer) === 1;
}
