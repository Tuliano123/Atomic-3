import { system } from "@minecraft/server";
import { debugLog, getOverworldDimension, getPlayerSelector, runCommandRaw } from "./commands.js";

function buildStructureCommands(player, structureConfig) {
	const name = String(structureConfig?.name ?? "").trim();
	if (!name) return { player: "", dimension: [] };

	const selector = getPlayerSelector(player);
	const hasExplicitPos = structureConfig?.x != null && structureConfig?.y != null && structureConfig?.z != null;
	const x = Math.trunc(Number(structureConfig.x));
	const y = Math.trunc(Number(structureConfig.y));
	const z = Math.trunc(Number(structureConfig.z));

	const dimCmds = [];
	let playerCmd = "";

	if (structureConfig?.loadAtPlayer) {
		playerCmd = `execute at @s run structure load ${name} ~ ~ ~`;
		if (selector !== "@s") dimCmds.push(`execute at ${selector} run structure load ${name} ~ ~ ~`);
		dimCmds.push(`structure load ${name} ~ ~ ~`);
	} else if (hasExplicitPos && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
		playerCmd = `structure load ${name} ${x} ${y} ${z}`;
		dimCmds.push(`structure load ${name} ${x} ${y} ${z}`);
	} else {
		playerCmd = `execute at @s run structure load ${name} ~ ~ ~`;
		if (selector !== "@s") dimCmds.push(`execute at ${selector} run structure load ${name} ~ ~ ~`);
		dimCmds.push(`structure load ${name} ~ ~ ~`);
	}

	return { player: playerCmd, dimension: dimCmds };
}

async function waitForLoadedChunk(player, maxTicks) {
	const ticks = Math.max(0, Math.trunc(Number(maxTicks ?? 0)));
	if (ticks <= 0) return;
	const dim = player?.dimension;
	if (!dim?.isChunkLoaded) return;

	for (let i = 0; i < ticks; i++) {
		try {
			if (dim.isChunkLoaded(player.location)) return;
		} catch (e) {
			void e;
			return;
		}
		await new Promise((r) => system.runTimeout(r, 1));
	}
}

export async function loadStructureForPlayer(player, structureConfig, rootConfig) {
	if (!player || !structureConfig?.enabled) return false;
	const name = String(structureConfig?.name ?? "").trim();
	if (!name) return false;

	const dim = getOverworldDimension();
	if (!dim) return false;

	// Give the engine a moment to load the player's chunk after join/teleport.
	await waitForLoadedChunk(player, structureConfig?.waitChunkTicks ?? 20);

	const cmds = buildStructureCommands(player, structureConfig);

	if (cmds.player) {
		const okPlayer = (await runCommandRaw(player, cmds.player, rootConfig, "structure")).ok;
		if (okPlayer) return true;
	}

	for (const cmd of cmds.dimension) {
		const ok = (await runCommandRaw(dim, cmd, rootConfig, "structure")).ok;
		if (ok) return true;
	}

	// Retry breve por si el mundo aún no termina de cargar
	if (structureConfig?.gracefulFail) {
		debugLog(rootConfig, `Reintentando carga de estructura ${name}...`);
		try {
			system.runTimeout(() => {
				if (cmds.player) void runCommandRaw(player, cmds.player, rootConfig, "structure-retry");
				for (const cmd of cmds.dimension) void runCommandRaw(dim, cmd, rootConfig, "structure-retry");
			}, 20);
			system.runTimeout(() => {
				if (cmds.player) void runCommandRaw(player, cmds.player, rootConfig, "structure-retry");
				for (const cmd of cmds.dimension) void runCommandRaw(dim, cmd, rootConfig, "structure-retry");
			}, 60);
		} catch (e) {
			void e;
		}
		return false;
	}

	throw new Error(`No se pudo cargar estructura ${name}`);
}
