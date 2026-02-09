import { world } from "@minecraft/server";

/**
 * Lee score del jugador (identity). Fallback total.
 * @param {import("@minecraft/server").Player} player
 * @param {string} objectiveId
 * @param {number} defaultValue
 */
export function getScorePlayer(player, objectiveId, defaultValue = 0) {
	try {
		const obj = world.scoreboard.getObjective(String(objectiveId));
		if (!obj) return defaultValue;
		const id = player?.scoreboardIdentity;
		if (!id) return defaultValue;
		const v = obj.getScore(id);
		if (v === undefined || v === null) return defaultValue;
		const n = Math.trunc(Number(v));
		return Number.isFinite(n) ? n : defaultValue;
	} catch (e) {
		void e;
		return defaultValue;
	}
}

/**
 * Set score del jugador (identity). Best-effort.
 * @param {import("@minecraft/server").Player} player
 * @param {string} objectiveId
 * @param {number} value
 */
export function setScorePlayer(player, objectiveId, value) {
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
 * Aplica defaults obligatorios al abrir menú.
 * - DBlimite: si no existe / 0 -> defaultLimit
 * - Mejora: si no existe -> 0 (o si es NaN)
 */
export function ensureBankDefaults(player, { defaultLimit = 10000 } = {}) {
	try {
		const limit = getScorePlayer(player, "DBlimite", 0);
		if (!Number.isFinite(limit) || limit <= 0) setScorePlayer(player, "DBlimite", Math.trunc(defaultLimit));
		const mejora = getScorePlayer(player, "Mejora", 0);
		if (!Number.isFinite(mejora) || mejora < 0) setScorePlayer(player, "Mejora", 0);
	} catch (e) {
		void e;
	}
}

/**
 * Si DB > DBlimite, mueve excedente a D.
 * @returns {number} exceso movido
 */
export function clampBankOverflow(player) {
	try {
		const limit = getScorePlayer(player, "DBlimite", 0);
		if (!Number.isFinite(limit) || limit <= 0) return 0;
		const db = getScorePlayer(player, "DB", 0);
		if (!Number.isFinite(db) || db <= limit) return 0;
		const excess = db - limit;
		const d = getScorePlayer(player, "D", 0);
		setScorePlayer(player, "DB", limit);
		setScorePlayer(player, "D", Math.max(0, d + excess));
		return excess;
	} catch (e) {
		void e;
		return 0;
	}
}

/**
 * Computa depósito con cap.
 * @returns {{ attempt: number, real: number, space: number, limit: number }}
 */
export function computeDepositWithCap({ d, db, limit, multiplier }) {
	let money = Math.trunc(Number(d));
	let bank = Math.trunc(Number(db));
	let cap = Math.trunc(Number(limit));
	let m = Number(multiplier);
	if (!Number.isFinite(m)) m = 1;
	if (!Number.isFinite(money)) money = 0;
	if (!Number.isFinite(bank)) bank = 0;
	if (!Number.isFinite(cap)) cap = 0;
	if (money < 0) money = 0;
	if (bank < 0) bank = 0;
	if (cap < 0) cap = 0;

	const attempt = Math.floor(money * m);
	const space = Math.max(0, cap - bank);
	const real = Math.max(0, Math.min(attempt, space));
	return { attempt: Math.trunc(attempt), real: Math.trunc(real), space: Math.trunc(space), limit: cap };
}
