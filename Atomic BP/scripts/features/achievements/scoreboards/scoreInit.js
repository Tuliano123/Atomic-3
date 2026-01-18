import achievementsConfig from "../config.js";

export function getAchievementObjectiveId(achievement) {
	if (!achievement) return null;
	if (achievement.internalObjective) return String(achievement.internalObjective);
	return `Logro_${achievement.id}`;
}

export function listAchievementObjectives() {
	const list = [];
	for (const ach of achievementsConfig.achievements || []) {
		const id = getAchievementObjectiveId(ach);
		if (id) list.push(id);
	}
	return list;
}

export function getTotalsObjectiveId() {
	return achievementsConfig?.totals?.playerTotalObjective || "Logros";
}

export function getTotalGlobalObjectiveId() {
	return achievementsConfig?.totals?.totalObjective || "LogrosTotal";
}

export function getHeartsObjectiveId() {
	return achievementsConfig?.heartsReward?.heartsObjective || "Corazones";
}
