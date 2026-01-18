import { system, world } from "@minecraft/server";
import { initByPlayerDamageDealt } from "./byplayer/index.js";
import { initByMobDamageDealt } from "./by_mob/index.js";

let didInit = false;

// Entry-point unico
export function initDamageDealt(config = undefined) {
	if (didInit) return;
	didInit = true;

	// Debug global (bool): initDamageDealt({ debug: true })
	void config;

	initByPlayerDamageDealt(world, config);
	initByMobDamageDealt(world, config);
}
