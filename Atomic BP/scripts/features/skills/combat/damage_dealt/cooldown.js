import { system } from "@minecraft/server";

let didInit = false;
let tickCounter = 0;

/** @type {Map<string, number>} */
const lastTickByTargetKey = new Map();

/** @type {Map<string, number>} */
const lastTickByAttackerKey = new Map();

function getEntityKey(entity) {
	try {
		const sbid = entity?.scoreboardIdentity?.id;
		if (sbid != null) return `sb:${String(sbid)}`;
	} catch (e) {
		void e;
	}
	try {
		if (entity?.id) return `id:${String(entity.id)}`;
	} catch (e) {
		void e;
	}
	return null;
}

function ensureTicking() {
	if (didInit) return;
	didInit = true;

	system.runInterval(() => {
		tickCounter = (tickCounter + 1) % 2000000000;
		// Limpieza simple para evitar crecimiento sin limite.
		if (tickCounter % 200 === 0) {
			for (const [k, last] of lastTickByTargetKey) {
				if (tickCounter - last > 600) lastTickByTargetKey.delete(k);
			}
			for (const [k, last] of lastTickByAttackerKey) {
				if (tickCounter - last > 600) lastTickByAttackerKey.delete(k);
			}
		}
	}, 1);
}

export function getDamageDealtTick() {
	ensureTicking();
	return tickCounter;
}

// Cooldown por TARGET (immunity frames). Devuelve true si puede aplicar.
export function canApplyDamageToTarget(target, cooldownTicks) {
	ensureTicking();
	const cd = Math.max(0, Math.trunc(Number(cooldownTicks ?? 0)));
	if (cd <= 0) return true;

	const key = getEntityKey(target);
	if (!key) return true;

	const last = lastTickByTargetKey.get(key) ?? -999999;
	if (tickCounter - last < cd) return false;
	lastTickByTargetKey.set(key, tickCounter);
	return true;
}

// Cooldown por ATACANTE (per-mob). Devuelve true si puede aplicar.
export function canApplyDamageFromAttacker(attacker, cooldownTicks) {
	ensureTicking();
	const cd = Math.max(0, Math.trunc(Number(cooldownTicks ?? 0)));
	if (cd <= 0) return true;

	const key = getEntityKey(attacker);
	if (!key) return true;

	const last = lastTickByAttackerKey.get(key) ?? -999999;
	if (tickCounter - last < cd) return false;
	lastTickByAttackerKey.set(key, tickCounter);
	return true;
}
