// Feature: minerales regenerables
// - Event-driven: playerBreakBlock (before)
// - Drops controlados
// - Regeneración con system.runTimeout
// - Persistencia con world dynamic properties

import * as mc from "@minecraft/server";
import { GameMode, system, world } from "@minecraft/server";

import { isInAnyArea } from "./area.js";
import { buildOreRegistry, getOreDefinition } from "./registry.js";
import { getNormalizedToolLore, selectActiveModifier, resolveDropsTable } from "./modifiers.js";
import { runDropsTable } from "./drops.js";
import { validateMiningRegenConfig } from "./validate.js";
import {
	computeRemainingTicks,
	initMiningRegenDynamicProperties,
	isExpired,
	loadPendingEntries,
	makePendingKey,
	processEntriesInBatches,
	savePendingEntries,
} from "./persistence.js";

let didInit = false;

function nowMs() {
	return Date.now();
}

function makeKeyFromPos(dimensionId, pos) {
	// Formato único de key para runtime y persistencia.
	return `${String(dimensionId)}:${pos.x}:${pos.y}:${pos.z}`;
}

function debugEnabled(config) {
	return Boolean(config?.debug?.enabled);
}

function debugConsole(config) {
	return Boolean(config?.debug?.console);
}

function debugTellPlayer(config) {
	return Boolean(config?.debug?.tellPlayer);
}

function debugTraceBreak(config) {
	return Boolean(config?.debug?.traceBreak);
}

function dbg(config, message) {
	if (!debugEnabled(config) || !debugConsole(config)) return;
	try {
		console.log(`[miningRegen] ${String(message != null ? message : "")}`);
	} catch (e) {
		void e;
	}
}

function tell(player, msg) {
	try {
		if (player && typeof player.sendMessage === "function") player.sendMessage(String(msg));
	} catch (e) {
		void e;
	}
}

function isTraceTargetBlock(blockTypeId) {
	const t = String(blockTypeId != null ? blockTypeId : "");
	return t === "minecraft:coal_ore" || t === "minecraft:deepslate_coal_ore";
}

function isSafeCommandToken(token) {
	// Token "simple" para usar en comandos sin comillas.
	// Ejemplos esperados: dig.stone, minecraft:block.stone, random.pop
	return /^[0-9A-Za-z_:\.-]+$/.test(String(token != null ? token : ""));
}

function quoteForCommand(value) {
	// Similar a anticheat/commandsRunner.js pero local al feature.
	return `"${String(value).replace(/"/g, "\\\"")}"`;
}

function playMineSoundBestEffort(config, player, dimension, pos, oreDef, traceToPlayer = false) {
	try {
		const sounds = Array.isArray(oreDef && oreDef.sounds) ? oreDef.sounds : [];
		if (sounds.length === 0) return;

		// Ejecutar en el siguiente tick para evitar errores por early_execution.
		system.run(() => {
			const loc = { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 };
			const canPlayer = player && typeof player.playSound === "function";
			const canDim = dimension && typeof dimension.playSound === "function";
			const canCmd = dimension && typeof dimension.runCommandAsync === "function";

			let played = 0;
			let via = canPlayer ? "player.playSound" : canDim ? "dimension.playSound" : canCmd ? "command" : "none";

			for (const s of sounds) {
				try {
					const id = String(s && s.id != null ? s.id : "").trim();
					if (!id || !isSafeCommandToken(id)) continue;
					const volume = Number.isFinite(Number(s && s.volume)) ? Number(s.volume) : 1;
					const pitch = Number.isFinite(Number(s && s.pitch)) ? Number(s.pitch) : 1;
					const volC = Math.max(0, Math.min(4, volume));
					const pitC = Math.max(0, Math.min(2, pitch));

					if (canPlayer) {
						player.playSound(id, { volume: volC, pitch: pitC });
						played++;
						if (debugEnabled(config)) dbg(config, `sound: ok id=${id} via=player v=${volC} p=${pitC}`);
						continue;
					}

					if (canDim) {
						dimension.playSound(id, loc, { volume: volC, pitch: pitC });
						played++;
						if (debugEnabled(config)) dbg(config, `sound: ok id=${id} via=dimension v=${volC} p=${pitC}`);
						continue;
					}

					if (canCmd) {
						const targetByName = player && player.name ? `@a[name=${quoteForCommand(player.name)}]` : null;
						const fallbackTarget = `@p[x=${pos.x},y=${pos.y},z=${pos.z},r=8]`;
						const target = targetByName || fallbackTarget;
						const cmd = `playsound ${id} ${target} ${pos.x} ${pos.y} ${pos.z} ${volC} ${pitC} 0.2`;
						dimension.runCommandAsync(cmd);
						played++;
						if (debugEnabled(config)) dbg(config, `sound: ok id=${id} via=command v=${volC} p=${pitC}`);
					}
				} catch (e) {
					void e;
					if (debugEnabled(config)) dbg(config, "sound: excepción al reproducir un entry");
				}
			}

			if (traceToPlayer && debugTellPlayer(config) && player) {
				tell(player, `§8[mining] sounds=${played}/${sounds.length} via=${via}`);
			}
			if (debugEnabled(config) && played === 0) dbg(config, "sound: no se pudo reproducir ningún sonido");
		});
	} catch (e) {
		void e;
		dbg(config, "sound: excepción inesperada");
	}
}

function rollChancePct(chancePct) {
	const c = Number(chancePct);
	if (!Number.isFinite(c)) return false;
	if (c <= 0) return false;
	if (c >= 100) return true;
	return Math.random() * 100 < c;
}

function rollUniformInt(min, max) {
	const a = Math.floor(Number(min));
	const b = Math.floor(Number(max));
	if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
	const lo = Math.min(a, b);
	const hi = Math.max(a, b);
	if (hi <= lo) return Math.max(0, lo);
	return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function spawnXpOrbsBestEffort(config, dimension, blockPos, oreDef) {
	try {
		const xp = oreDef && oreDef.xpOrbs && typeof oreDef.xpOrbs === "object" ? oreDef.xpOrbs : null;
		if (!xp) return;
		if (!rollChancePct(xp.chance)) return;
		let amount = rollUniformInt(xp.min, xp.max);
		if (amount <= 0) return;

		// Cap para evitar spam de entidades si alguien configura valores grandes.
		const cap = 25;
		if (amount > cap) {
			dbg(config, `xpOrbs cap aplicado: ${amount} -> ${cap}`);
			amount = cap;
		}

		if (!dimension || typeof dimension.spawnEntity !== "function") return;
		const loc = { x: blockPos.x + 0.5, y: blockPos.y + 0.5, z: blockPos.z + 0.5 };
		for (let i = 0; i < amount; i++) {
			try {
				dimension.spawnEntity("minecraft:xp_orb", loc);
			} catch (e) {
				void e;
				// si falla una vez, no spameamos exceptions: cortamos
				break;
			}
		}
	} catch (e) {
		void e;
	}
}

function safeGetDimension(id) {
	try {
		return world.getDimension(id);
	} catch (e) {
		void e;
		return null;
	}
}

function setBlockTypeSafe(dimension, pos, blockTypeId) {
	try {
		const block = dimension.getBlock(pos);
		if (!block) return false;

		// Preferir permutation (más estable en varias versiones)
		if (mc?.BlockPermutation?.resolve && typeof block.setPermutation === "function") {
			const perm = mc.BlockPermutation.resolve(String(blockTypeId));
			block.setPermutation(perm);
			return true;
		}

		// Fallback
		if (typeof block.setType === "function") {
			block.setType(String(blockTypeId));
			return true;
		}
	} catch (e) {
		void e;
	}
	return false;
}

function getBlockTypeIdSafe(dimension, pos) {
	try {
		const b = dimension.getBlock(pos);
		return b && b.typeId ? String(b.typeId) : null;
	} catch (e) {
		void e;
		return null;
	}
}

function getGameModeNameBestEffort(player) {
	try {
		if (player && typeof player.getGameMode === "function") {
			const gm = player.getGameMode();
			return gm != null ? String(gm) : null;
		}
	} catch (e) {
		void e;
	}
	return null;
}

function isCreativeBestEffort(player) {
	try {
		// API moderna
		if (typeof player.getGameMode === "function") {
			const gm = player.getGameMode();
			const gmStr = gm != null ? String(gm).toLowerCase() : "";

			// En 2.4.0 el enum es PascalCase: GameMode.Creative (value: "Creative")
			const creativeEnum = (GameMode && (GameMode.Creative ?? GameMode.creative)) || null;
			if (creativeEnum != null && gm === creativeEnum) return true;
			return gmStr === "creative";
		}
	} catch (e) {
		void e;
	}
	// Si no se puede detectar, asumimos NO-creative para no romper la economía.
	return false;
}

/**
 * Inicializa el sistema.
 * @param {any} userConfig
 */
export function initMiningRegen(userConfig) {
	if (didInit) return;
	didInit = true;

	// Soporte dinámico:
	// - Objeto directo: initMiningRegen(config)
	// - Provider: initMiningRegen(() => configActual)
	const configProvider = typeof userConfig === "function" ? userConfig : () => (userConfig || {});
	let config = configProvider();
	if (!config || !config.enabled) return;

	// Registra DP (best-effort)
	initMiningRegenDynamicProperties(config);

	// Validación (solo diagnóstico)
	try {
		const report = validateMiningRegenConfig(config);
		for (const w of report.warnings) dbg(config, `WARN: ${w}`);
		for (const e of report.errors) dbg(config, `ERROR: ${e}`);
	} catch (e) {
		void e;
	}

	let registry = buildOreRegistry(config);
	let ticksPerSecond = Number(config.ticksPerSecond != null ? config.ticksPerSecond : 20) || 20;
	let lastConfigRef = config;

	function refreshConfigIfChanged() {
		const next = configProvider();
		if (!next || typeof next !== "object") return;
		// Si el provider devuelve un objeto nuevo, rearmamos el registro.
		if (next !== lastConfigRef) {
			lastConfigRef = next;
			config = next;
			registry = buildOreRegistry(config);
			ticksPerSecond = Number(config.ticksPerSecond != null ? config.ticksPerSecond : 20) || 20;
			dbg(config, `Config recargada: areas=${Array.isArray(config.areas) ? config.areas.length : 0} ores=${Array.isArray(config.ores) ? config.ores.length : 0}`);
		}
	}

	// Cache runtime: evita doble drop en el mismo bloque durante cooldown.
	/** @type {Set<string>} */
	const pendingKeys = new Set();
	// Keys "en vuelo": un evento ya cancelado que se procesará en el siguiente tick.
	/** @type {Set<string>} */
	const processingKeys = new Set();
	/** @type {any[]} */
	let pendingEntries = [];

	function persist() {
		savePendingEntries(config, pendingEntries);
	}

	function removePendingByKey(key) {
		pendingKeys.delete(key);
		pendingEntries = pendingEntries.filter((e) => makePendingKey(e) !== key);
		persist();
	}

	function scheduleRestore(entry) {
		const key = makePendingKey(entry);
		pendingKeys.add(key);
		const ticks = computeRemainingTicks(entry, ticksPerSecond);

		system.runTimeout(() => {
			try {
				// Verificación final: solo restaurar si aún está el minedBlockId.
				const dim = safeGetDimension(entry.dimensionId);
				if (!dim) {
					// Si la dimensión no existe, reintentar más adelante.
					entry.restoreAt = nowMs() + 2000;
					scheduleRestore(entry);
					persist();
					return;
				}

				const pos = { x: entry.x, y: entry.y, z: entry.z };
				const current = getBlockTypeIdSafe(dim, pos);
				if (current !== entry.minedBlockId) {
					// Se cambió externamente: no restaurar.
					removePendingByKey(key);
					return;
				}

				setBlockTypeSafe(dim, pos, entry.oreBlockId);
				removePendingByKey(key);
			} catch (e) {
				void e;
				// Reintento suave
				try {
					entry.restoreAt = nowMs() + 2000;
					scheduleRestore(entry);
					persist();
				} catch (e2) {
					void e2;
				}
			}
		}, ticks);
	}

	function addPending(entry) {
		const key = makePendingKey(entry);
		if (pendingKeys.has(key)) return false;
		pendingKeys.add(key);
		pendingEntries.push(entry);
		persist();
		scheduleRestore(entry);
		return true;
	}

	// Cargar persistencia en worldLoad
	world.afterEvents.worldLoad.subscribe(() => {
		dbg(config, "worldLoad: cargando pendientes...");
		// 1) Cargar JSON
		pendingEntries = loadPendingEntries(config);
		// 2) Deduplicar por ubicación (si por algún motivo el JSON trae repetidos)
		const byKey = new Map();
		for (const e of pendingEntries) {
			const k = makePendingKey(e);
			const prev = byKey.get(k);
			// Preferimos restaurar lo antes posible: dejamos el restoreAt más chico.
			if (!prev || Number(e.restoreAt) < Number(prev.restoreAt)) byKey.set(k, e);
		}
		pendingEntries = Array.from(byKey.values());
		dbg(config, `worldLoad: pendientes=${pendingEntries.length}`);

		pendingKeys.clear();
		for (const e of pendingEntries) pendingKeys.add(makePendingKey(e));

		// Procesar en batches para evitar pico (restaurar o reprogramar)
		processEntriesInBatches(
			config,
			pendingEntries.slice(),
			(entry) => {
				const key = makePendingKey(entry);
				// Asegurar que exista en set
				pendingKeys.add(key);

				const dim = safeGetDimension(entry.dimensionId);
				if (!dim) return;

				const pos = { x: entry.x, y: entry.y, z: entry.z };
				const current = getBlockTypeIdSafe(dim, pos);
				if (current !== entry.minedBlockId) {
					// Si el mined state ya no está, limpiar entry.
					removePendingByKey(key);
					return;
				}

				if (isExpired(entry)) {
					// Restaurar inmediatamente (best-effort)
					setBlockTypeSafe(dim, pos, entry.oreBlockId);
					removePendingByKey(key);
					return;
				}

				// Si aún no expira, reprogramar
				scheduleRestore(entry);
			},
			() => {
				persist();
			}
		);
	});

	// Evento principal: intercepta minado
	world.beforeEvents.playerBreakBlock.subscribe((ev) => {
		try {
			// Permite cambios dinámicos en config sin reiniciar script.
			refreshConfigIfChanged();
			if (!config || !config.enabled) return;

			if (!ev || !ev.block || !ev.player) return;
			const player = ev.player;
			const dim = ev.dimension;
			if (!dim) return;

			// Traza gamemode (solo si está en modo trace)
			if (debugTellPlayer(config) && debugTraceBreak(config)) {
				const gmName = getGameModeNameBestEffort(player);
				if (gmName) tell(player, `§8[mining] gm=${gmName}`);
			}

			// Bypass Creative
			if (isCreativeBestEffort(player)) return;

			const block = ev.block;
			const blockPos = block.location;
			const dimensionId = String(dim.id != null ? dim.id : "");

			// Traza de prueba: confirmar que el evento corre y qué datos entrega.
			if (debugTellPlayer(config) && debugTraceBreak(config)) {
				tell(player, `§8[mining] dim=${dimensionId} block=${block.typeId} @ ${blockPos.x},${blockPos.y},${blockPos.z}`);
			}

			const isTargetTrace = debugTellPlayer(config) && debugTraceBreak(config) && isTraceTargetBlock(block.typeId);
			if (isTargetTrace) {
				const areasCount = Array.isArray(config.areas) ? config.areas.length : 0;
				const oresCount = Array.isArray(config.ores) ? config.ores.length : 0;
				tell(player, `§8[mining] cfg areas=${areasCount} ores=${oresCount}`);
			}

			// Validación de área
			const inArea = isInAnyArea(dimensionId, blockPos, config.areas);
			if (!inArea) {
				if (isTargetTrace) tell(player, "§c[mining] fuera de area (no aplica)");
				return;
			}
			if (isTargetTrace) tell(player, "§a[mining] area=ok");

			const oreDef = getOreDefinition(registry, block.typeId);
			if (!oreDef) {
				if (isTargetTrace) tell(player, "§c[mining] ore NO registrado en config");
				return;
			}
			if (isTargetTrace) tell(player, `§a[mining] ore=ok regen=${oreDef.regenSeconds}s mined=${oreDef.minedBlockId}`);

			const key = makeKeyFromPos(dimensionId, blockPos);

			// Si ya está pendiente, cancelamos el break para evitar drops vanilla y duplicación.
			if (pendingKeys.has(key) || processingKeys.has(key)) {
				if (isTargetTrace) tell(player, "§e[mining] ya pendiente => cancel");
				ev.cancel = true;
				return;
			}

			// Cancelar el break vanilla (evita drops vanilla)
			ev.cancel = true;
			if (isTargetTrace) tell(player, "§a[mining] cancel=true (procesando next tick)");

			// Importante (2.4.0 stable): en early_execution, cambiar bloques puede fallar.
			// Por eso, hacemos el procesamiento en el siguiente tick.
			// Reservamos la key solo como "en procesamiento" para evitar spam/duplicación por mantener click.
			processingKeys.add(key);

			// Sonido inmediato (antes del set mined-state), para que suene al instante.
			// En modo trace, mostramos qué ruta se usó.
			playMineSoundBestEffort(config, player, dim, blockPos, oreDef, isTargetTrace);

			// Snapshot de lore en el tick actual (ev.itemStack puede ser undefined en el siguiente tick).
			const loreNorm = getNormalizedToolLore(ev.itemStack);

			system.run(() => {
				try {
					if (!config || !config.enabled) {
						processingKeys.delete(key);
						return;
					}

					// Seguridad extra: si el jugador está en Creative, no aplicar mined-state/drops.
					if (isCreativeBestEffort(player)) {
						processingKeys.delete(key);
						return;
					}

					// Verificar que el bloque sigue siendo el ore (si otro plugin lo cambió, abortar)
					const current = getBlockTypeIdSafe(dim, blockPos);
					if (current !== oreDef.oreBlockId) {
						if (isTargetTrace) tell(player, `§c[mining] abort: bloque cambió (${current})`);
						processingKeys.delete(key);
						return;
					}

					const didSetMinedState = setBlockTypeSafe(dim, blockPos, oreDef.minedBlockId);
					if (!didSetMinedState) {
						dbg(config, `No se pudo setear minedState=${oreDef.minedBlockId} en ${key}`);
						if (isTargetTrace) tell(player, "§c[mining] mined-state FAIL (no se puede aplicar)" );
						processingKeys.delete(key);
						return;
					}
					if (isTargetTrace) tell(player, "§a[mining] mined-state=ok" );

						// Sonido configurable: ya se intentó inmediato arriba.
						// (No lo repetimos aquí para evitar doble sonido.)

					// Resolver modifier por lore
					const selected = selectActiveModifier(oreDef, loreNorm);
					const dropsTable = resolveDropsTable(oreDef, selected);

					// Partículas: solo en Silk Touch (ejemplo)
					try {
						if (selected && selected.key === "silk_touch_1") {
							const p = oreDef && oreDef.particlesOnSilkTouch && typeof oreDef.particlesOnSilkTouch === "object" ? oreDef.particlesOnSilkTouch : null;
							if (p && typeof p.fn === "function") {
								const off = p.offset || { x: 0.5, y: 0.5, z: 0.5 };
								p.fn(dim, { x: blockPos.x + off.x, y: blockPos.y + off.y, z: blockPos.z + off.z }, p.options);
							}
						}
					} catch (e) {
						void e;
						// best-effort: no rompemos el minado por partículas
					}

					// Dropear items custom
					const spawned = runDropsTable(dim, blockPos, dropsTable);

						// XP (orbes) configurable
						spawnXpOrbsBestEffort(config, dim, blockPos, oreDef);
					if (debugTellPlayer(config)) {
						tell(player, `§7[mining] drops=${spawned} regen=${oreDef.regenSeconds}s`);
					}

					// Registrar regeneración (esto también mete key en persistencia)
					const entry = {
						dimensionId,
						x: blockPos.x,
						y: blockPos.y,
						z: blockPos.z,
						oreBlockId: oreDef.oreBlockId,
						minedBlockId: oreDef.minedBlockId,
						restoreAt: nowMs() + oreDef.regenSeconds * 1000,
					};
					// Pasamos de "processing" a "pending" real.
					processingKeys.delete(key);
					addPending(entry);
				} catch (e) {
					void e;
					processingKeys.delete(key);
				}
			});
		} catch (e) {
			void e;
			// No hacemos throw para no romper el servidor.
		}
	});
}
