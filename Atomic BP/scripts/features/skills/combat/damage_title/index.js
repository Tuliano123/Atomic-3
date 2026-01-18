import { system, world } from "@minecraft/server";
import { setDamageTitleEmitter } from "../damage_dealt/damage_title_hook.js";
import { damageTitleConfig } from "./config.js";
import { formatDamageTitle } from "./format.js";
import { hasHEnabled, isPlayerEntity, isValidDamageReal } from "./guards.js";
import { spawnDamageHologram } from "./hologramFactory.js";

let didInit = false;

/** @type {Map<string, number>} */
const lastTickByAttackerKey = new Map();
let tickCounter = 0;

function getAttackerKey(attacker) {
	try {
		const sbid = attacker?.scoreboardIdentity?.id;
		if (sbid != null) return `sb:${String(sbid)}`;
		if (attacker?.id) return `pl:${String(attacker.id)}`;
		if (attacker?.name) return `nm:${String(attacker.name)}`;
	} catch (e) {
		void e;
	}
	return null;
}

function shouldRateLimit(config, attacker) {
	const rl = config?.rateLimit;
	if (!rl || rl.enabled !== true) return false;
	const minTicks = Math.max(0, Math.trunc(Number(rl.minTicksPerAttacker ?? 0)));
	if (minTicks <= 0) return false;

	const key = getAttackerKey(attacker);
	if (!key) return false;
	const last = lastTickByAttackerKey.get(key) ?? -999999;
	if (tickCounter - last < minTicks) return true;
	lastTickByAttackerKey.set(key, tickCounter);
	return false;
}

function computeSpawnLocation(config, target, hitLocation = undefined) {
	try {
		void hitLocation;
		// Para mantenerlo estable y "relativo al enemigo", usamos siempre target.location.
		// El offset Y negativo compensa el "cuerpo" del holograma y centra el title.
		const base = target?.location;
		if (!base) return null;

		const xMax = Math.max(0, Number(config?.offset?.dxAbsMax ?? 0.4));
		const zMax = Math.max(0, Number(config?.offset?.dzAbsMax ?? 0.4));
		const yMin = Number(config?.offset?.dyMin ?? -1.7);
		const yMax = Number(config?.offset?.dyMax ?? -0.5);
		const yLo = Math.min(yMin, yMax);
		const yHi = Math.max(yMin, yMax);
		const jitter = Math.max(0, Number(config?.offset?.jitter ?? 0));

		const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
		const randRange = (lo, hi) => {
			if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
			if (hi <= lo) return lo;
			return lo + Math.random() * (hi - lo);
		};
		const pickFrom = (arr) => {
			if (!Array.isArray(arr) || arr.length === 0) return null;
			const idx = Math.floor(Math.random() * arr.length);
			const v = Number(arr[idx]);
			return Number.isFinite(v) ? v : null;
		};
		const signedAbs = (abs) => (Math.random() < 0.5 ? -1 : 1) * abs;

		let absX = pickFrom(config?.offset?.dxAbsChoices);
		if (absX == null) absX = randRange(0, xMax);
		absX = clamp(Math.abs(absX), 0, xMax);

		let absZ = pickFrom(config?.offset?.dzAbsChoices);
		if (absZ == null) absZ = randRange(0, zMax);
		absZ = clamp(Math.abs(absZ), 0, zMax);

		let dy = pickFrom(config?.offset?.dyChoices);
		if (dy == null) dy = randRange(yLo, yHi);
		dy = clamp(dy, yLo, yHi);

		const jx = jitter > 0 ? randRange(-jitter, jitter) : 0;
		const jz = jitter > 0 ? randRange(-jitter, jitter) : 0;
		const jy = jitter > 0 ? randRange(-jitter, jitter) : 0;

		const dx = clamp(signedAbs(absX) + jx, -xMax, xMax);
		const dz = clamp(signedAbs(absZ) + jz, -zMax, zMax);
		const dyJ = clamp(dy + jy, yLo, yHi);
		return { x: base.x + dx, y: base.y + dyJ, z: base.z + dz };
	} catch (e) {
		void e;
		return null;
	}
}

export function initDamageTitle(userConfig = undefined) {
	if (didInit) return;
	didInit = true;

	const uc = userConfig && typeof userConfig === "object" ? userConfig : null;
	const config = {
		...damageTitleConfig,
		...(uc ?? {}),
		offset: {
			...(damageTitleConfig.offset ?? {}),
			...((uc && uc.offset) || {}),
		},
		formatting: {
			...(damageTitleConfig.formatting ?? {}),
			...((uc && uc.formatting) || {}),
		},
		criticalPattern: {
			...(damageTitleConfig.criticalPattern ?? {}),
			...((uc && uc.criticalPattern) || {}),
			endEmojiByColor: {
				...((damageTitleConfig.criticalPattern && damageTitleConfig.criticalPattern.endEmojiByColor) || {}),
				...((uc && uc.criticalPattern && uc.criticalPattern.endEmojiByColor) || {}),
			},
		},
		types: {
			...(damageTitleConfig.types ?? {}),
			...((uc && uc.types) || {}),
			normal: {
				...((damageTitleConfig.types && damageTitleConfig.types.normal) || {}),
				...((uc && uc.types && uc.types.normal) || {}),
			},
			critical: {
				...((damageTitleConfig.types && damageTitleConfig.types.critical) || {}),
				...((uc && uc.types && uc.types.critical) || {}),
			},
		},
		rateLimit: {
			...(damageTitleConfig.rateLimit ?? {}),
			...((uc && uc.rateLimit) || {}),
		},
	};

	// Tick counter solo para rate-limit opcional.
	system.runInterval(() => {
		tickCounter = (tickCounter + 1) % 2000000000;
	}, 1);

	setDamageTitleEmitter((payload) => {
		try {
			const attacker = payload?.attacker;
			const target = payload?.target;
			if (!attacker || !target) return;

			// Reglas identicas a damage_dealt + requisito extra: solo attacker player
			if (!isPlayerEntity(attacker)) return;
			if (!hasHEnabled(attacker) || !hasHEnabled(target)) return;

			const danoReal = payload?.danoReal ?? payload?.damageReal;
			if (!isValidDamageReal(danoReal)) return;

			if (shouldRateLimit(config, attacker)) return;

			const text = formatDamageTitle(config, payload);
			if (!text) return;

			const dim = target.dimension;
			const loc = computeSpawnLocation(config, target, payload?.hitLocation);
			if (!dim || !loc) return;

			spawnDamageHologram({ dimension: dim, location: loc, text, durationMs: config.durationMs });

			if (config.debug === true) {
				try {
					const codes = String(text)
						.split("")
						.slice(0, 6)
						.map((ch) => ch.charCodeAt(0))
						.join(",");
					attacker.sendMessage(
						`[DamageTitleDbg] text=${JSON.stringify(text)} codes=[${codes}] danoReal=${Math.trunc(Number(danoReal))} crit=${payload?.isCrit === true}`
					);
				} catch (e) {
					void e;
				}
			}
		} catch (e) {
			void e;
		}
	});

	// Limpieza best-effort cuando cambian players (no esencial).
	try {
		world.afterEvents.playerLeave.subscribe((ev) => {
			void ev;
			// No hace falta limpiar porque el map es pequeño, pero lo dejamos por higiene.
			// (no tenemos el player object acá en todas las versiones)
		});
	} catch (e) {
		void e;
	}
}
