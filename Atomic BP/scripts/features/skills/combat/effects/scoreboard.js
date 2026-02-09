import { world } from "@minecraft/server";

/** @type {Map<string, any>} */
const objectiveCache = new Map();

export const OBJ_H = "H";
export const OBJ_VIDA = "Vida";
export const OBJ_VIDA_MAX = "VidaMaxTotalH";
export const OBJ_H_DEAD = "HDead";

export const OBJ_EFF_VENENO = "EffVeneno";
export const OBJ_EFF_CONGELAMIENTO = "EffCongelamiento";
export const OBJ_EFF_CALOR = "EffCalor";

function getParticipant(entity) {
	try {
		return entity?.scoreboardIdentity ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

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

export function getScore(entity, objectiveId, defaultValue = 0) {
	try {
		const obj = getObjectiveCached(String(objectiveId));
		if (!obj) return defaultValue;
		const p = getParticipant(entity);
		if (!p) return defaultValue;
		const v = obj.getScore(p);
		if (v === undefined || v === null) return defaultValue;
		const n = Math.trunc(Number(v));
		return Number.isFinite(n) ? n : defaultValue;
	} catch (e) {
		void e;
		return defaultValue;
	}
}

export function setScore(entity, objectiveId, value) {
	try {
		const obj = getObjectiveCached(String(objectiveId));
		if (!obj) return false;
		const p = getParticipant(entity);
		if (!p) return false;
		obj.setScore(p, Math.trunc(Number(value)));
		return true;
	} catch (e) {
		void e;
		return false;
	}
}
