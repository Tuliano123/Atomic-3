// Feature: skills/lecture

import { world } from "@minecraft/server";
import { clampInt32 } from "./utilMath.js";

/** @type {Map<string, any>} */
const objectiveCache = new Map();

function getObjectiveCached(objectiveId) {
	const id = String(objectiveId ?? "").trim();
	if (!id) return null;

	// Retry-on-null: si estaba null, reintentamos.
	if (objectiveCache.has(id)) {
		const cached = objectiveCache.get(id) ?? null;
		if (cached) return cached;
	}

	try {
		const obj = world.scoreboard.getObjective(id) ?? null;
		if (obj) objectiveCache.set(id, obj);
		return obj;
	} catch (e) {
		void e;
		return null;
	}
}

export function getScoreIdentityOrDefault(objectiveId, identity, fallbackName, defaultValue = 0) {
	try {
		const obj = getObjectiveCached(objectiveId);
		if (!obj) return defaultValue;

		if (identity) {
			const v = obj.getScore(identity);
			return v === undefined || v === null ? defaultValue : Math.trunc(Number(v));
		}

		if (fallbackName) {
			const v = obj.getScore(String(fallbackName));
			return v === undefined || v === null ? defaultValue : Math.trunc(Number(v));
		}

		return defaultValue;
	} catch (e) {
		void e;
		return defaultValue;
	}
}

export function setScoreIdentityBestEffort(objectiveId, identity, fallbackName, value) {
	try {
		const obj = getObjectiveCached(objectiveId);
		if (!obj) return false;

		const v = clampInt32(value);
		if (identity) {
			obj.setScore(identity, v);
			return true;
		}
		if (fallbackName) {
			obj.setScore(String(fallbackName), v);
			return true;
		}
		return false;
	} catch (e) {
		void e;
		return false;
	}
}
