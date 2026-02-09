import { system, world } from "@minecraft/server";
import { clearPlayerInventory, giveConfiguredItem } from "./inventory.js";
import { loadStructureForPlayer } from "./structure.js";
import { debugLog, getPlayerSelector, runCommandForPlayer } from "./commands.js";
import { runDiagnosticsOnce } from "./diagnostics.js";

/** @type {Map<string, any>} */
const objectiveCache = new Map();

function getObjectiveCached(id) {
	const cached = objectiveCache.get(id) ?? null;
	if (cached) return cached;
	try {
		const obj = world.scoreboard.getObjective(id) ?? null;
		if (obj) objectiveCache.set(id, obj);
		else objectiveCache.delete(id);
		return obj;
	} catch (e) {
		void e;
		objectiveCache.delete(id);
		return null;
	}
}

function getNoNuevoTag(config) {
	try {
		if (config?.secondValidationTag?.enabled === false) return "";
		return String(config?.secondValidationTag?.tag ?? "NoNuevo").trim();
	} catch (e) {
		void e;
		return "NoNuevo";
	}
}

function addTagBestEffort(player, tag) {
	if (!tag) return false;
	try {
		if (typeof player?.addTag === "function") {
			player.addTag(tag);
			return true;
		}
	} catch (e) {
		void e;
	}
	return false;
}

function getParticipant(entity) {
	try {
		return entity?.scoreboardIdentity ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

export function getScore(entity, objectiveId, defaultValue = 0) {
	try {
		const obj = getObjectiveCached(objectiveId);
		if (!obj) return defaultValue;
		const p = getParticipant(entity);
		if (!p) return defaultValue;
		const v = obj.getScore(p);
		if (v === undefined || v === null) return defaultValue;
		const n = Math.trunc(Number(v));
		return Number.isFinite(n) ? n : defaultValue;
	} catch (e) {
		void e;
		return defaultValue;
	}
}

export function setScore(entity, objectiveId, value) {
	try {
		const obj = getObjectiveCached(objectiveId);
		if (!obj) return false;
		const p = getParticipant(entity);
		if (!p) return false;
		obj.setScore(p, Math.trunc(Number(value)));
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function resetScoreboardsWithApi(player, config) {
	try {
		const identity = player?.scoreboardIdentity ?? null;
		if (!identity) return false;
		const objectives = world.scoreboard.getObjectives();
		let changed = false;
		for (const obj of objectives) {
			try {
				obj.removeParticipant(identity);
				changed = true;
			} catch (e) {
				void e;
			}
		}
		return changed;
	} catch (e) {
		void e;
		debugLog(config, "Scoreboard API reset failed");
		return false;
	}
}

async function resetAllScoreboardsWithCommand(player, config) {
	// Requisito: reset completo sin excepciones.
	return runCommandForPlayer(
		player,
		"scoreboard players reset @s *",
		`scoreboard players reset ${getPlayerSelector(player)} *`,
		config,
		"scoreboardReset"
	);
}

function waitTicks(ticks) {
	const t = Math.max(0, Math.trunc(Number(ticks ?? 0)));
	if (t <= 0) return Promise.resolve();
	return new Promise((resolve) => {
		try {
			system.runTimeout(() => resolve(), t);
		} catch (e) {
			void e;
			resolve();
		}
	});
}

async function sendTellraw(player, text, config) {
	if (!text) return false;
	try {
		player?.sendMessage?.(String(text));
		return true;
	} catch (e) {
		void e;
	}
	return false;
}

async function teleportPlayer(player, cfg, config) {
	if (!cfg?.enabled) return false;
	const x = Number(cfg.x);
	const y = Number(cfg.y);
	const z = Number(cfg.z);
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
	let dim = null;
	try {
		dim = world.getDimension(String(cfg.dimension ?? "minecraft:overworld"));
	} catch (e) {
		void e;
	}
	try {
		player?.teleport?.({ x, y, z }, { dimension: dim ?? player?.dimension });
		return true;
	} catch (e) {
		void e;
	}
	return runCommandForPlayer(
		player,
		`tp @s ${Math.trunc(x)} ${Math.trunc(y)} ${Math.trunc(z)}`,
		`tp ${getPlayerSelector(player)} ${Math.trunc(x)} ${Math.trunc(y)} ${Math.trunc(z)}`,
		config,
		"teleport"
	);
}

async function showTitle(player, cfg, config) {
	if (!cfg?.enabled) return false;
	const title = String(cfg.title ?? "");
	const subtitle = String(cfg.subtitle ?? "");
	const fadeIn = Math.trunc(Number(cfg.fadeIn ?? 10));
	const stay = Math.trunc(Number(cfg.stay ?? 70));
	const fadeOut = Math.trunc(Number(cfg.fadeOut ?? 20));

	try {
		const display = player?.onScreenDisplay;
		if (display && typeof display.setTitle === "function") {
			display.setTitle(title, {
				subtitle,
				fadeInDuration: fadeIn,
				stayDuration: stay,
				fadeOutDuration: fadeOut,
			});
			return true;
		}
	} catch (e) {
		void e;
	}
	// No command fallback by default; title is best handled via API.
	return false;
}

async function playSound(player, cfg, config) {
	if (!cfg?.enabled) return false;
	const id = String(cfg.minecraftId ?? "");
	if (!id) return false;
	const volume = Number.isFinite(Number(cfg.volume)) ? Number(cfg.volume) : 1;
	const pitch = Number.isFinite(Number(cfg.pitch)) ? Number(cfg.pitch) : 1;
	try {
		player?.playSound?.(id, { volume, pitch });
		return true;
	} catch (e) {
		void e;
		debugLog(config, `playSound failed for '${id}'`);
		return false;
	}
}

export async function runWelcomeSequence(player, config) {
	if (!player || !config) return false;

	const objectiveId = String(config?.objective ?? "nuevo");
	const noNuevoTag = getNoNuevoTag(config);
	try {
		if (!world.scoreboard.getObjective(objectiveId)) {
			world.scoreboard.addObjective(objectiveId, objectiveId);
		}
	} catch (e) {
		void e;
	}

	// Debug diagnostics (once per player) to understand command context/permissions.
	runDiagnosticsOnce(player, config);

	// Reset scoreboards (comando completo). Luego re-aplicamos el marcador para evitar loops.
	if (config?.scoreboardReset?.enabled && config?.scoreboardReset?.resetAll) {
		const cmdOk = await resetAllScoreboardsWithCommand(player, config);
		if (!cmdOk) {
			const apiOk = resetScoreboardsWithApi(player, config);
			if (!apiOk) debugLog(config, `Scoreboard reset failed for ${getPlayerSelector(player)}`);
		}
		// IMPORTANTE: el reset completo borra tambien `nuevo`; lo restauramos inmediatamente.
		setScore(player, objectiveId, 1);
		if (noNuevoTag) addTagBestEffort(player, noNuevoTag);
	}

	// Remover tag
	if (config?.tagRemoval?.enabled && config?.tagRemoval?.tag) {
		const tag = String(config.tagRemoval.tag ?? "").trim();
		if (tag) {
			let shouldRemove = true;
			try {
				if (typeof player?.hasTag === "function") {
					shouldRemove = Boolean(player.hasTag(tag));
				}
			} catch (e) {
				void e;
				shouldRemove = true;
			}
			if (shouldRemove) {
				await runCommandForPlayer(
					player,
					`tag @s remove ${tag}`,
					`tag ${getPlayerSelector(player)} remove ${tag}`,
					config,
					"tagRemoval"
				);
			}
		}
	}

	// Tellraw
	if (config?.welcomeMessage?.enabled && config?.welcomeMessage?.text) {
		await sendTellraw(player, String(config.welcomeMessage.text), config);
	}

	// Teleport inicial
	let didTeleport = false;
	if (config?.initialTeleport?.enabled) {
		didTeleport = await teleportPlayer(player, config.initialTeleport, config);
		if (didTeleport) await waitTicks(4);
	}

	// Clear inventario + ender chest
	if (config?.clearInventory?.enabled) {
		await clearPlayerInventory(player, config.clearInventory);
	}

	// Ítem inicial
	if (config?.itemGiven?.enabled) {
		giveConfiguredItem(player, config.itemGiven);
	}

	// Cargar estructura
	if (config?.structure?.enabled) {
		if (!didTeleport) await waitTicks(10);
		try {
			await loadStructureForPlayer(player, config.structure, config);
		} catch (e) {
			void e;
			if (!config?.structure?.gracefulFail) throw e;
		}
	}

	// Title / Subtitle
	if (config?.titleMessage?.enabled) {
		await showTitle(player, config.titleMessage, config);
	}

	// Sonido
	if (config?.sound?.enabled) {
		await playSound(player, config.sound, config);
	}

	debugLog(config, `Secuencia completada para ${player?.name ?? "?"}`);
	return true;
}
