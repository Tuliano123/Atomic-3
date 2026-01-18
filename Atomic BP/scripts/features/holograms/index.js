// Feature: Hologramas (atomic:hologram)
// - Template = nameTag al spawnear (por ejemplo /summon ... "texto ${OBJ:participant}")
// - Interpolación best-effort para scoreboards
// - Optimizado: update por interval + cache; sin comandos

import { system, world } from "@minecraft/server";

import { hologramsConfig as defaultConfig } from "./config.js";
import { registerHologramEntityDynamicProperties } from "./internal/dynamicProperties.js";
import { getScoreBestEffort } from "./internal/scoreboard.js";
import { hasPlaceholders, listScoreRefs, parseTemplate } from "./internal/template.js";

let didInit = false;

function normalizeKey(s) {
	return String(s ?? "").replace(/§./g, "").trim().toLowerCase();
}

function makeDebugController(config) {
	const lastLogByKey = new Map();
	let enabled = Boolean(config && config.debug && config.debug.enabled);
	let lastEnabled = enabled;

	const debugCfg = (config && config.debug) || {};
	const toggleCfg = debugCfg.toggle || {};
	const logEveryTicks = Math.max(1, Number(debugCfg.logEveryTicks ?? 40));

	function log(msg) {
		if (!enabled) return;
		// Si el toggle está habilitado, permitimos logs aunque console=false
		if (!debugCfg.console && !(toggleCfg && toggleCfg.enabled)) return;
		try {
			console.log(`[holograms] ${String(msg ?? "")}`);
		} catch (e) {
			void e;
		}
	}

	function shouldLog(key, tick) {
		if (!enabled) return false;
		const k = normalizeKey(key);
		const last = lastLogByKey.get(k) ?? -999999;
		if (tick - last < logEveryTicks) return false;
		lastLogByKey.set(k, tick);
		return true;
	}

	function pollToggle() {
		if (!toggleCfg || !toggleCfg.enabled) return;
		try {
			const objId = String(toggleCfg.objective ?? "atomic_debug");
			const part = String(toggleCfg.participant ?? "holograms");
			const onAtLeast = Number(toggleCfg.onScoreAtLeast ?? 1);
			const obj = world.scoreboard.getObjective(objId);
			if (!obj) return;
			const v = obj.getScore(part);
			if (typeof v === "number" && Number.isFinite(v)) enabled = v >= onAtLeast;
			else enabled = false;

			if (enabled !== lastEnabled) {
				lastEnabled = enabled;
				try {
					world.sendMessage(`§7[holograms] debug ${enabled ? "§aON" : "§cOFF"}`);
				} catch (e) {
					void e;
				}
			}
		} catch (e) {
			void e;
		}
	}

	return { get enabled() { return enabled; }, log, shouldLog, pollToggle };
}

// dbg() reemplazado por debugController

function safeGetDynamicString(entity, key) {
	try {
		const v = entity.getDynamicProperty(key);
		return typeof v === "string" ? v : null;
	} catch (e) {
		void e;
		return null;
	}
}

function safeSetDynamicString(entity, key, value) {
	try {
		entity.setDynamicProperty(key, value);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function clampTemplate(config, template) {
	const maxLen = Math.max(64, Number(config && config.persistence && config.persistence.maxTemplateLength != null ? config.persistence.maxTemplateLength : 1024));
	const s = String(template != null ? template : "");
	if (s.length <= maxLen) return s;
	return s.slice(0, maxLen);
}

function makeHologramState(entity, template, tokens, scoreRefs) {
	return {
		id: entity.id,
		entity,
		template,
		tokens,
		scoreRefs,
		// key -> { displayed:number, target:number, startTick:number, startValue:number }
		lerp: new Map(),
		lastRender: null,
		lastSeenTick: 0,
	};
}

function renderFromState(config, state, nowTick, debugCtl) {
	const missing = Number(config && config.runtime && config.runtime.missingValue != null ? config.runtime.missingValue : 0);
	const interp = config && config.interpolation ? config.interpolation : {};
	const interpEnabled = Boolean(interp.enabled);
	const duration = Math.max(1, Number(interp.durationTicks != null ? interp.durationTicks : 20));
	const roundToInt = Boolean(interp.roundToInt);

	/** @type {Record<string, number>} */
	const targets = {};
	for (const ref of state.scoreRefs) {
		const dbgKey = `${ref.objective}:${ref.participant}`;
		const dbg = debugCtl
			? {
				enabled: debugCtl.enabled,
				log: debugCtl.log,
				shouldLog: () => debugCtl.shouldLog(dbgKey, nowTick),
			}
			: null;
		targets[ref.key] = getScoreBestEffort(ref.objective, ref.participant, missing, dbg);
	}

	// Actualizar estados de interpolación
	for (const ref of state.scoreRefs) {
		const key = ref.key;
		const target = targets[key];
		const prev = state.lerp.get(key);

		if (!interpEnabled) {
			state.lerp.set(key, {
				displayed: target,
				target,
				startTick: nowTick,
				startValue: target,
			});
			continue;
		}

		if (!prev) {
			state.lerp.set(key, {
				displayed: target,
				target,
				startTick: nowTick,
				startValue: target,
			});
			continue;
		}

		// Si cambió el target, reiniciar lerp
		if (prev.target !== target) {
			state.lerp.set(key, {
				displayed: prev.displayed,
				target,
				startTick: nowTick,
				startValue: prev.displayed,
			});
		}
	}

	// Calcular displayed actual
	/** @type {Record<string, string>} */
	const values = {};
	for (const ref of state.scoreRefs) {
		const st = state.lerp.get(ref.key);
		let shown = targets[ref.key];
		if (st && interpEnabled) {
			const elapsed = Math.max(0, nowTick - st.startTick);
			const t = Math.min(1, elapsed / duration);
			const cur = st.startValue + (st.target - st.startValue) * t;
			shown = roundToInt ? Math.round(cur) : cur;
			// Persistir displayed para siguiente paso
			st.displayed = Number.isFinite(shown) ? shown : st.target;
		}
		values[ref.key] = String(shown);
	}

	// Render
	let out = "";
	for (const tok of state.tokens) {
		if (!tok) continue;
		if (tok.type === "text") {
			out += tok.value;
			continue;
		}
		if (tok.type === "score") {
			out += values[tok.key] != null ? values[tok.key] : String(missing);
		}
	}

	return out;
}

function shouldTrack(entity) {
	try {
		return entity && entity.isValid && entity.typeId === "atomic:hologram";
	} catch (e) {
		void e;
		return false;
	}
}

function getTemplateKey(config) {
	return String(config && config.persistence && config.persistence.templateKey ? config.persistence.templateKey : "atomic:holo_template");
}

function ensureTrackedHologram(config, tracked, entity) {
	if (!shouldTrack(entity)) return;
	if (tracked.has(entity.id)) return;

	const templateKey = getTemplateKey(config);
	let template = safeGetDynamicString(entity, templateKey);

	// Si no hay template guardado, usamos el nameTag actual (por ejemplo, set por /summon)
	if (template == null) {
		template = clampTemplate(config, entity.nameTag);
		// Guardar best-effort
		const ok = safeSetDynamicString(entity, templateKey, template);
		if (!ok) {
			// Si DP no está disponible (por versión/registro), igual funciona en runtime.
			// (debug)
		}
	}

	const tokens = parseTemplate(template);
	const scoreRefs = listScoreRefs(tokens);
	const state = makeHologramState(entity, template, tokens, scoreRefs);
	tracked.set(entity.id, state);

	// Primer render inmediato si hay placeholders
	if (scoreRefs.length > 0 || hasPlaceholders(template)) {
		try {
			const rendered = renderFromState(config, state, 0, null);
			state.lastRender = rendered;
			entity.nameTag = rendered;
		} catch (e) {
			void e;
		}
	}
}

function scanAllDimensions(config, tracked) {
	const dims = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
	for (const dimId of dims) {
		try {
			const dim = world.getDimension(dimId);
			const list = dim.getEntities({ type: "atomic:hologram" });
			for (const e of list) ensureTrackedHologram(config, tracked, e);
		} catch (e) {
			void e;
		}
	}
}

export function initHolograms(userConfig) {
	if (didInit) return;
	didInit = true;

	const config = userConfig && typeof userConfig === "object" ? userConfig : defaultConfig;
	if (!config.enabled) return;

	// Registrar dynamic properties (para guardar template por entidad)
	registerHologramEntityDynamicProperties(config);

	/** @type {Map<string, any>} */
	const tracked = new Map();
	const debugCtl = makeDebugController(config);

	// Poll debug toggle (scoreboard) si está habilitado
	try {
		const dbgPollEvery = Math.max(1, Number(config.debug && config.debug.toggle && config.debug.toggle.pollIntervalTicks != null ? config.debug.toggle.pollIntervalTicks : 40));
		system.runInterval(() => debugCtl.pollToggle(), dbgPollEvery);
	} catch (e) {
		void e;
	}

	// Track en spawn/load
	try {
		if (world.afterEvents && world.afterEvents.entitySpawn && typeof world.afterEvents.entitySpawn.subscribe === "function") {
			world.afterEvents.entitySpawn.subscribe((ev) => {
				try {
					const e = ev && ev.entity ? ev.entity : null;
					if (!e) return;
					ensureTrackedHologram(config, tracked, e);
				} catch (e) {
					void e;
				}
			});
		}
		if (world.afterEvents && world.afterEvents.entityLoad && typeof world.afterEvents.entityLoad.subscribe === "function") {
			world.afterEvents.entityLoad.subscribe((ev) => {
				try {
					const e = ev && ev.entity ? ev.entity : null;
					if (!e) return;
					ensureTrackedHologram(config, tracked, e);
				} catch (e) {
					void e;
				}
			});
		}
	} catch (e) {
		void e;
	}

	// Scan inicial (para entidades ya existentes)
	system.runTimeout(() => scanAllDimensions(config, tracked), 1);

	const updateEvery = Math.max(1, Number(config.runtime && config.runtime.updateIntervalTicks != null ? config.runtime.updateIntervalTicks : 10));
	const maxPerUpdate = Math.max(1, Number(config.runtime && config.runtime.maxPerUpdate != null ? config.runtime.maxPerUpdate : 200));
	let tick = 0;

	system.runInterval(() => {
		tick += updateEvery;

		// Limpieza + update en batches
		let processed = 0;
		for (const [id, st] of tracked) {
			if (processed >= maxPerUpdate) break;

			const ent = st && st.entity ? st.entity : null;
			if (!ent || !ent.isValid) {
				tracked.delete(id);
				continue;
			}

			// Si no hay placeholders, no hacemos polling.
			if (!st.scoreRefs || st.scoreRefs.length === 0) continue;

			let rendered = null;
			try {
				rendered = renderFromState(config, st, tick, debugCtl);
				if (debugCtl.enabled && debugCtl.shouldLog(`render:${st.id}`, tick)) {
					debugCtl.log(`entity=${st.id} template=${JSON.stringify(st.template)} rendered=${JSON.stringify(rendered)}`);
				}
			} catch (e) {
				void e;
				rendered = null;
			}

			if (rendered != null && rendered !== st.lastRender) {
				try {
					ent.nameTag = rendered;
					st.lastRender = rendered;
				} catch (e) {
					void e;
				}
			}
			processed++;
		}
	}, updateEvery);
}
