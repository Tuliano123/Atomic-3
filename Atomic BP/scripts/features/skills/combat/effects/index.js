import { system, world } from "@minecraft/server";
import { effectsConfig } from "./config.js";
import { getScore, setScore, OBJ_EFF_VENENO, OBJ_EFF_CONGELAMIENTO, OBJ_EFF_CALOR } from "./scoreboard.js";
import { processEffectsTick } from "./tick.js";

let didInit = false;
let tickCounter = 0;

function clearAllEffectsBestEffort(player) {
	try {
		setScore(player, OBJ_EFF_VENENO, 0);
		setScore(player, OBJ_EFF_CONGELAMIENTO, 0);
		setScore(player, OBJ_EFF_CALOR, 0);
	} catch (e) {
		void e;
	}
	try {
		player?.removeEffect?.("poison");
	} catch (e) {
		void e;
	}
}

function clampSeconds(seconds) {
	const n = Math.trunc(Number(seconds));
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, n);
}

/**
 * Aplica un efecto MVP por key (`veneno` | `congelamiento` | `calor`) usando scoreboards.
 * stackingMode:
 * - "set": sobrescribe
 * - "add": suma
 * - "max": deja el mayor (default)
 */
export function applyEffect(entity, effectKey, seconds, stackingMode = "max") {
	try {
		if (!entity || !entity.isValid) return false;
		const key = String(effectKey ?? "").toLowerCase();
		const def = effectsConfig?.effects?.[key];
		if (!def || typeof def.objective !== "string") return false;

		const add = clampSeconds(seconds);
		if (add <= 0) return false;

		const obj = def.objective;
		const cur = Math.max(0, Math.trunc(Number(getScore(entity, obj, 0))));
		let next = add;
		const mode = String(stackingMode ?? "max").toLowerCase();
		if (mode === "add") next = cur + add;
		else if (mode === "max") next = Math.max(cur, add);

		return setScore(entity, obj, next);
	} catch (e) {
		void e;
		return false;
	}
}

export function clearEffects(entity) {
	try {
		if (!entity || !entity.isValid) return false;
		clearAllEffectsBestEffort(entity);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

export function initEffects(userConfig = undefined) {
	if (didInit) return;
	didInit = true;

	const uc = userConfig && typeof userConfig === "object" ? userConfig : null;
	const config = {
		...effectsConfig,
		...(uc ?? {}),
		hologram: {
			...(effectsConfig.hologram ?? {}),
			...((uc && uc.hologram) || {}),
			offset: {
				...((effectsConfig.hologram && effectsConfig.hologram.offset) || {}),
				...((uc && uc.hologram && uc.hologram.offset) || {}),
			},
		},
		particles: {
			...(effectsConfig.particles ?? {}),
			...((uc && uc.particles) || {}),
		},
		runtime: {
			...(effectsConfig.runtime ?? {}),
			...((uc && uc.runtime) || {}),
		},
		effects: {
			...(effectsConfig.effects ?? {}),
			...((uc && uc.effects) || {}),
		},
	};

	// Limpieza en respawn (muerte => limpiar efectos)
	try {
		world.afterEvents.playerSpawn.subscribe((ev) => {
			try {
				const player = ev?.player;
				if (!player) return;
				clearAllEffectsBestEffort(player);
			} catch (e) {
				void e;
			}
		});
	} catch (e) {
		void e;
	}

	// Loop central: solo hace trabajo en ticks relevantes (18/20/25...)
	system.runInterval(() => {
		try {
			tickCounter = (tickCounter + 1) % 2000000000;
			processEffectsTick(world, config, tickCounter);
		} catch (e) {
			void e;
		}
	}, 1);
}
