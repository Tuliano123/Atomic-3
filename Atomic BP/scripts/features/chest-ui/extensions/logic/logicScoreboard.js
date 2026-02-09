import { world } from "@minecraft/server";

/**
 * Evalúa condiciones (scoreboards/tags) para un jugador.
 * - Si falla alguna condición: manda failMessage (si existe) y termina.
 * - Si todas pasan: ejecuta una lista de "procs" (acciones) en orden.
 *
 * @param {import("@minecraft/server").Player} player
 * @param {Array<any>} conditions
 * @param {Array<any>} procs
 * @param {{ clampMin0?: boolean }=} options
 * @returns {{ ok: boolean, failedAt?: number, reason?: string }}
 */
export function logicScoreboard(player, conditions, procs, options = undefined) {
	const clampMin0 = Boolean(options?.clampMin0);

	/** @type {Map<string, number>} */
	const snapshotScores = new Map();
	/** @type {Map<string, number>} */
	const currentScores = new Map();

	function getScoreSnapshot(objectiveId) {
		const key = String(objectiveId ?? "").trim();
		if (!key) return 0;
		if (snapshotScores.has(key)) return snapshotScores.get(key) ?? 0;
		const v = getScore(player, key);
		snapshotScores.set(key, v);
		if (!currentScores.has(key)) currentScores.set(key, v);
		return v;
	}

	function getScoreCurrent(objectiveId) {
		const key = String(objectiveId ?? "").trim();
		if (!key) return 0;
		if (currentScores.has(key)) return currentScores.get(key) ?? 0;
		// Si se pide por primera vez durante un proc, lo tratamos como snapshot también.
		return getScoreSnapshot(key);
	}

	function setScoreCurrent(objectiveId, value) {
		const key = String(objectiveId ?? "").trim();
		if (!key) return false;
		let n = Math.trunc(Number(value));
		if (!Number.isFinite(n)) n = 0;
		if (clampMin0 && n < 0) n = 0;
		const ok = setScore(player, key, n);
		if (ok) currentScores.set(key, n);
		return ok;
	}

	const ctx = {
		vars: Object.create(null),
		abort: false,
		clampMin0,
		getScore: getScoreSnapshot,
		getScoreCurrent,
		setScore: setScoreCurrent,
		sendMessage: (message) => sendMessageBestEffort(player, message),
	};

	// 1) Condiciones
	try {
		const conds = Array.isArray(conditions) ? conditions : [];
		for (let i = 0; i < conds.length; i++) {
			const c = conds[i];
			const type = String(c?.type ?? "").trim();

			if (type === "scoreboard") {
				const objectiveId = String(c?.scoreboard ?? "").trim();
				const sign = String(c?.conditionSign ?? "").trim();
				const rhs = Math.trunc(Number(c?.conditionInt ?? 0));
				if (!objectiveId) {
					failBestEffort(player, c?.failMessage);
					return { ok: false, failedAt: i, reason: "invalid-scoreboard-condition" };
				}
				const lhs = getScoreSnapshot(objectiveId);
				if (!compare(lhs, sign, rhs)) {
					failBestEffort(player, c?.failMessage);
					return { ok: false, failedAt: i, reason: "scoreboard-condition-failed" };
				}
				continue;
			}

			if (type === "tag") {
				const tag = String(c?.tag ?? "").trim();
				const wantHas = Boolean(c?.hasTag);
				if (!tag) {
					failBestEffort(player, c?.failMessage);
					return { ok: false, failedAt: i, reason: "invalid-tag-condition" };
				}
				const has = hasTagBestEffort(player, tag);
				if (has !== wantHas) {
					failBestEffort(player, c?.failMessage);
					return { ok: false, failedAt: i, reason: "tag-condition-failed" };
				}
				continue;
			}

			// Tipo desconocido => falla por seguridad
			failBestEffort(player, c?.failMessage);
			return { ok: false, failedAt: i, reason: "unknown-condition-type" };
		}
	} catch (e) {
		void e;
		return { ok: false, failedAt: 0, reason: "conditions-exception" };
	}

	// 2) Procs (success)
	try {
		const list = Array.isArray(procs) ? procs : [];
		for (let i = 0; i < list.length; i++) {
			if (ctx.abort) return { ok: false, failedAt: i, reason: "proc-aborted" };
			const p = list[i];

			// Hook (lógica custom sin acoplar)
			try {
				if (typeof p?.run === "function") {
					p.run(player, ctx);
					if (ctx.abort) return { ok: false, failedAt: i, reason: "proc-aborted" };
				}
			} catch (e) {
				void e;
				return { ok: false, failedAt: i, reason: "proc-run-exception" };
			}

			// scoreboardSet: set directo (útil para upgrades / defaults)
			try {
				const ss = p?.scoreboardSet;
				if (ss) {
					const objectiveId = String(ss?.scoreboard ?? "").trim();
					if (objectiveId) {
						let v = ss?.value;
						if (typeof v === "function") v = v(player, ctx);
						const n = Math.trunc(Number(v));
						if (Number.isFinite(n)) ctx.setScore(objectiveId, n);
					}
				}
			} catch (e) {
				void e;
				return { ok: false, failedAt: i, reason: "proc-scoreboardSet-exception" };
			}

			// Mensaje de success
			try {
				if (typeof p?.successMessage === "string" && p.successMessage) sendMessageBestEffort(player, p.successMessage);
				else if (typeof p?.successMessage === "function") {
					const msg = p.successMessage(player, ctx);
					if (typeof msg === "string" && msg) sendMessageBestEffort(player, msg);
				}
			} catch (e) {
				void e;
			}

			const sb = p?.scoreboardSuccess;
			if (!sb) continue;

			const targetObjective = String(sb?.scoreboard ?? "").trim();
			const op = String(sb?.operation ?? "").trim();
			if (!targetObjective) continue;
			if (!op) continue;

			const delta = formatProcDelta(sb, getScoreSnapshot);
			if (!Number.isFinite(delta)) continue;

			let target = getScoreCurrent(targetObjective);
			let result = target;

			switch (op) {
				case "+":
					result = target + delta;
					break;
				case "-":
					result = target - delta;
					break;
				case "*":
					if (delta === 0) break;
					result = target * delta;
					break;
				case "/":
					if (delta <= 0) break;
					result = Math.floor(target / delta);
					break;
				default:
					break;
			}

			result = Math.trunc(Number(result));
			if (!Number.isFinite(result)) result = target;
			if (clampMin0 && result < 0) result = 0;

			setScoreCurrent(targetObjective, result);
		}
	} catch (e) {
		void e;
		return { ok: false, reason: "procs-exception" };
	}

	return { ok: true };
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} objectiveId
 * @returns {number}
 */
function getScore(player, objectiveId) {
	try {
		const obj = world.scoreboard.getObjective(String(objectiveId));
		if (!obj) return 0;
		const id = player?.scoreboardIdentity;
		if (!id) return 0;
		const v = obj.getScore(id);
		const n = Math.trunc(Number(v));
		return Number.isFinite(n) ? n : 0;
	} catch (e) {
		void e;
		return 0;
	}
}

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} objectiveId
 * @param {number} value
 * @returns {boolean}
 */
function setScore(player, objectiveId, value) {
	try {
		const obj = world.scoreboard.getObjective(String(objectiveId));
		if (!obj) return false;
		const id = player?.scoreboardIdentity;
		if (!id) return false;
		const n = Math.trunc(Number(value));
		if (!Number.isFinite(n)) return false;
		obj.setScore(id, n);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

/**
 * @param {number} a
 * @param {string} sign
 * @param {number} b
 */
function compare(a, sign, b) {
	const lhs = Math.trunc(Number(a));
	const rhs = Math.trunc(Number(b));
	if (!Number.isFinite(lhs) || !Number.isFinite(rhs)) return false;
	switch (sign) {
		case ">=":
			return lhs >= rhs;
		case "<=":
			return lhs <= rhs;
		case "==":
			return lhs === rhs;
		case "!=":
			return lhs !== rhs;
		case ">":
			return lhs > rhs;
		case "<":
			return lhs < rhs;
		default:
			return false;
	}
}

/**
 * Calcula delta entero para un proc.
 * - delta = (int ?? 0) + floor(score(scoreboardFrom) * percentage)
 *
 * @param {any} scoreboardSuccess
 * @param {(objectiveId: string) => number} getScoreSnapshot
 */
function formatProcDelta(scoreboardSuccess, getScoreSnapshot) {
	try {
		const baseInt = Math.trunc(Number(scoreboardSuccess?.int ?? 0));
		const safeBase = Number.isFinite(baseInt) ? baseInt : 0;

		let percentageAdd = 0;
		const percentage = scoreboardSuccess?.percentage;
		if (percentage && typeof percentage === "object") {
			const from = String(percentage?.scoreboardFrom ?? "").trim();
			const pct = Number(percentage?.percentage);
			if (from && Number.isFinite(pct)) {
				const fromScore = Math.trunc(Number(getScoreSnapshot(from)));
				if (Number.isFinite(fromScore)) {
					percentageAdd = Math.floor(fromScore * pct);
					if (!Number.isFinite(percentageAdd)) percentageAdd = 0;
				}
			}
		}

		const delta = Math.trunc(Number(safeBase + percentageAdd));
		return Number.isFinite(delta) ? delta : 0;
	} catch (e) {
		void e;
		return 0;
	}
}

function hasTagBestEffort(player, tag) {
	try {
		if (!player || typeof player.hasTag !== "function") return false;
		return Boolean(player.hasTag(String(tag)));
	} catch (e) {
		void e;
		return false;
	}
}

function sendMessageBestEffort(player, message) {
	try {
		if (!player || typeof player.sendMessage !== "function") return false;
		player.sendMessage(String(message));
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function failBestEffort(player, failMessage) {
	try {
		if (typeof failMessage === "string" && failMessage) {
			sendMessageBestEffort(player, failMessage);
		}
	} catch (e) {
		void e;
	}
}
