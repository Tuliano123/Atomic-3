import { world } from "@minecraft/server";

function getObjective(id) {
	try {
		return world.scoreboard.getObjective(String(id)) || null;
	} catch (e) {
		void e;
		return null;
	}
}

function getScore(player, objectiveId) {
	const obj = getObjective(objectiveId);
	if (!obj) return null;
	const identity = player?.scoreboardIdentity;
	const name = player?.name;
	try {
		if (identity) {
			const v = obj.getScore(identity);
			if (Number.isFinite(v)) return v;
		}
	} catch (e) {
		void e;
	}

	try {
		if (!name) return 0;
		const vByName = obj.getScore(String(name));
		return Number.isFinite(vByName) ? vByName : 0;
	} catch (e) {
		void e;
		return 0;
	}
}

function setScore(player, objectiveId, value) {
	const obj = getObjective(objectiveId);
	if (!obj) return false;
	const identity = player?.scoreboardIdentity;
	if (!identity) return false;
	try {
		obj.setScore(identity, Math.trunc(Number(value)));
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

export function handleHeartsMilestone(player, config, totalAchievements) {
	if (!config?.enabled) return false;
	const milestoneEvery = Math.max(1, Number(config.milestoneEvery ?? 10));
	const maxLevel = Math.max(1, Number(config.maxHeartsLevel ?? 5));
	const heartsObj = String(config.heartsObjective ?? "Corazones");
	const total = Math.max(0, Math.trunc(Number(totalAchievements ?? 0)));
	const desiredLevel = Math.min(maxLevel, Math.floor(total / milestoneEvery));
	const currentLevel = getScore(player, heartsObj) ?? 0;
	if (desiredLevel <= currentLevel) return false;
	const ok = setScore(player, heartsObj, desiredLevel);
	return ok;
}
