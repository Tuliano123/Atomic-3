import { system, world } from "@minecraft/server";
import onJoinFirstTimeConfig from "./config.js";
import { getScore, runWelcomeSequence, setScore } from "./handlers.js";

function debugLog(config, message) {
	if (!config?.debug) return;
	try {
		console.warn(`[onJoinFirstTime] ${message}`);
	} catch (e) {
		void e;
	}
}

function getPlayerKey(player) {
	try {
		const id = player?.id;
		if (id) return String(id);
	} catch (e) {
		void e;
	}
	try {
		return String(player?.name ?? "");
	} catch (e) {
		void e;
		return "";
	}
}

function snapshotPos(player) {
	try {
		const loc = player?.location;
		if (!loc) return null;
		return { x: loc.x, y: loc.y, z: loc.z };
	} catch (e) {
		void e;
		return null;
	}
}

function hasMoved(a, b) {
	if (!a || !b) return false;
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return dx * dx + dy * dy + dz * dz > 0.01;
}

function findPlayerById(id) {
	if (!id) return null;
	try {
		for (const p of world.getPlayers()) {
			if (String(p.id) === String(id)) return p;
		}
	} catch (e) {
		void e;
	}
	return null;
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

function hasTagBestEffort(player, tag) {
	if (!tag) return false;
	try {
		if (typeof player?.hasTag === "function") return Boolean(player.hasTag(tag));
	} catch (e) {
		void e;
	}
	return false;
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

let didInit = false;

export function initOnJoinFirstTime(customConfig = undefined, deps = undefined) {
	if (didInit) return;
	didInit = true;
	void deps;

	const config = customConfig != null ? customConfig : onJoinFirstTimeConfig;
	const objectiveId = String(config?.objective ?? "nuevo");
	const noNuevoTag = getNoNuevoTag(config);

	// Asegurar que el objective exista para que getScore/setScore funcionen siempre.
	try {
		if (!world.scoreboard.getObjective(objectiveId)) {
			world.scoreboard.addObjective(objectiveId, objectiveId);
		}
	} catch (e) {
		void e;
	}

	/** @type {Map<string, { lastPos: any }>} */
	const pending = new Map();
	/** @type {Map<string, number>} */
	const lastTrigger = new Map();
	/** @type {Set<string>} */
	const processing = new Set();

	function enqueuePlayer(player) {
		const key = getPlayerKey(player);
		if (!key) return;
		if (noNuevoTag && hasTagBestEffort(player, noNuevoTag)) return;

		const score = getScore(player, objectiveId, 0);
		if (Number.isFinite(score) && score > 0) {
			// Migración: si ya está marcado por scoreboard pero falta el tag, lo añadimos.
			if (noNuevoTag && !hasTagBestEffort(player, noNuevoTag)) addTagBestEffort(player, noNuevoTag);
			return;
		}

		pending.set(key, { lastPos: snapshotPos(player) });
		debugLog(config, `Pendiente: ${player?.name ?? "?"}`);
	}

	async function maybeProcessPlayer(player) {
		if (!player) return;
		const key = getPlayerKey(player);
		if (!key) return;
		if (processing.has(key)) return;
		if (noNuevoTag && hasTagBestEffort(player, noNuevoTag)) {
			pending.delete(key);
			processing.delete(key);
			return;
		}

		const score = getScore(player, objectiveId, 0);
		if (Number.isFinite(score) && score > 0) {
			if (noNuevoTag && !hasTagBestEffort(player, noNuevoTag)) addTagBestEffort(player, noNuevoTag);
			pending.delete(key);
			processing.delete(key);
			return;
		}

		const now = Date.now();
		const debounceMs = Math.max(0, Math.trunc(Number(config?.movementTrigger?.debounceMs ?? 100)));
		const last = lastTrigger.get(key) ?? 0;
		if (now - last < debounceMs) return;

		lastTrigger.set(key, now);
		processing.add(key);
		try {
			try {
				await runWelcomeSequence(player, config);
			} catch (e) {
				void e;
				// Evitar re-ejecución infinita: marcar como procesado aunque falle alguna acción.
				debugLog(config, `Secuencia threw para ${player?.name ?? "?"}`);
			} finally {
				setScore(player, objectiveId, 1);
				if (noNuevoTag) addTagBestEffort(player, noNuevoTag);
				pending.delete(key);
			}
		} finally {
			processing.delete(key);
		}
	}

	function onMovement(player) {
		if (!config?.movementTrigger?.enabled) return;
		if (!player) return;
		const key = getPlayerKey(player);
		if (!key) return;
		if (!pending.has(key) && !processing.has(key)) return;
		void maybeProcessPlayer(player);
	}

	try {
		if (world?.afterEvents?.playerSpawn?.subscribe) {
			world.afterEvents.playerSpawn.subscribe((ev) => {
				try {
					const player = ev?.player;
					if (!player) return;
					if (ev?.initialSpawn === false) return;
					enqueuePlayer(player);
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}

	try {
		if (world?.afterEvents?.playerJoin?.subscribe) {
			world.afterEvents.playerJoin.subscribe((ev) => {
				try {
					const player = ev?.player ?? ev?.playerEntity;
					if (!player) return;
					enqueuePlayer(player);
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}

	try {
		if (world?.afterEvents?.playerMove?.subscribe) {
			world.afterEvents.playerMove.subscribe((ev) => {
				try {
					onMovement(ev?.player ?? ev?.entity ?? ev?.playerEntity);
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}

	try {
		if (world?.afterEvents?.playerInput?.subscribe) {
			world.afterEvents.playerInput.subscribe((ev) => {
				try {
					onMovement(ev?.player ?? ev?.entity ?? ev?.playerEntity);
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}

	// Fallback: revisar movimiento por posición
	try {
		system.runInterval(() => {
			try {
				for (const [key, data] of pending.entries()) {
					const player = findPlayerById(key);
					if (!player) {
						pending.delete(key);
						processing.delete(key);
						continue;
					}
					const curPos = snapshotPos(player);
					if (hasMoved(data?.lastPos, curPos)) {
						void maybeProcessPlayer(player);
					} else {
						data.lastPos = curPos;
					}
				}
			} catch (e) {
				void e;
			}
		}, 2);
	} catch (e) {
		void e;
	}
}
