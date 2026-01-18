import { world } from "@minecraft/server";

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

function getParticipant(entity) {
	try {
		return entity?.scoreboardIdentity ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

function getScore(entity, objectiveId, defaultValue = 0) {
	try {
		const obj = getObjectiveCached(objectiveId);
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

export function isPlayerEntity(entity) {
	try {
		return entity?.typeId === "minecraft:player";
	} catch (e) {
		void e;
		return false;
	}
}

export function hasHEnabled(entity) {
	return getScore(entity, "H", 0) === 1;
}

export function isValidDamageReal(danoRealRaw) {
	const n = Number(danoRealRaw);
	if (!Number.isFinite(n)) return false;
	if (n <= 0) return false;
	return true;
}
