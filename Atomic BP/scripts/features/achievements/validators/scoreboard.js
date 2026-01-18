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
		if (!name) return null;
		const vByName = obj.getScore(String(name));
		return Number.isFinite(vByName) ? vByName : null;
	} catch (e) {
		void e;
		return null;
	}
}

function compare(op, left, right) {
	switch (op) {
		case ">=":
			return left >= right;
		case ">":
			return left > right;
		case "<=":
			return left <= right;
		case "<":
			return left < right;
		case "==":
			return left === right;
		case "!=" :
			return left !== right;
		default:
			return false;
	}
}

export function validateScoreboardCondition(player, condition) {
	const objective = condition?.objective;
	const op = condition?.operator ?? ">=";
	const value = Number(condition?.value ?? 0);

	const score = getScore(player, objective);
	if (score == null || !Number.isFinite(value)) return false;
	return compare(String(op), score, value);
}
