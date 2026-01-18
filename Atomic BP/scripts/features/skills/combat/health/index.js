import { system, world } from "@minecraft/server";
import { DEFAULT_MOB_LOOP_TICKS, DEFAULT_MOB_SCAN_TICKS, DEFAULT_PLAYER_LOOP_TICKS } from "./defaults.js";
import { handlePlayerSpawn, syncPlayers } from "./syncPlayers.js";
import { considerTrackMob, scanAndTrackMobs, syncMobs } from "./syncMobs.js";

let didInit = false;

export function initCombatHealth(config = undefined) {
	if (didInit) return;
	didInit = true;

	// Debug (opcional): pasar { debug: true }

	const playerLoopTicks = Math.max(1, Math.trunc(Number(config?.playerLoopTicks ?? DEFAULT_PLAYER_LOOP_TICKS)));
	const mobLoopTicks = Math.max(1, Math.trunc(Number(config?.mobLoopTicks ?? DEFAULT_MOB_LOOP_TICKS)));
	const mobScanTicks = Math.max(1, Math.trunc(Number(config?.mobScanTicks ?? DEFAULT_MOB_SCAN_TICKS)));

	// Hooks de spawn
	try {
		world.afterEvents.playerSpawn.subscribe((ev) => {
			try {
				const player = ev?.player;
				handlePlayerSpawn(player, config);
			} catch (e) {
				void e;
			}
		});
	} catch (e) {
		void e;
	}

	try {
		world.afterEvents.entitySpawn.subscribe((ev) => {
			try {
				const ent = ev?.entity;
				if (!ent) return;
				considerTrackMob(ent, config);
			} catch (e) {
				void e;
			}
		});
	} catch (e) {
		void e;
	}

	// Loop: players
	system.runInterval(() => {
		syncPlayers(world, config);
	}, playerLoopTicks);

	// Loop: mobs (tracked)
	system.runInterval(() => {
		syncMobs(world, config);
	}, mobLoopTicks);

	// Scan lento: incorporar mobs a los que se les puso H=1 después de spawn
	system.runInterval(() => {
		scanAndTrackMobs(world, config);
	}, mobScanTicks);
}
