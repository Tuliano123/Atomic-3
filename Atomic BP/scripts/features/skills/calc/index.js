import { system, world } from "@minecraft/server";
import { damageCalcConfig } from "./config.js";
import { clampMin0Int, floorFinite, toNumberOr } from "./utilMath.js";
import { buildEquipmentSignature, getEquippedItemsBestEffort } from "./equipmentReader.js";
import { sumStatsFromItems } from "./totals.js";
import {
	debugLog,
	ensureObjectiveBestEffort,
	getScoreIdentityBestEffort,
	getScoreIdentityOrNameBestEffort,
	setScoreIdentityBestEffort,
} from "./scoreboard.js";

/** @typedef {{
 *  enabled: boolean,
 *  signature: string,
 *  baseDMGH: number,
 *  baseCDH: number,
 *  baseCCH: number,
 *  baseDH: number,
 *  baseMH: number,
 *  rawMAH: number,
 *  rawMMH: number,
 *  outSC: number,
 *  outCC: number,
 *  outCritChanceTotal: number,
 *  outDtotal: number,
 *  outMtotal: number,
 *  vidaGear: number,
 *  baseVidaMaxH: number,
 *  outVidaMaxTotal: number
 * }} PlayerCalcCache */

/** @type {Map<string, PlayerCalcCache>} */
const cacheByPlayerId = new Map();

/** @type {Map<string, number>} */
const lastDebugMsByPlayerKey = new Map();

let didInit = false;
let didStartLoop = false;

function getPlayerKey(player, identity) {
	try {
		if (identity && identity.id != null) return `sb:${String(identity.id)}`;
		if (player && player.id) return `pl:${String(player.id)}`;
		if (player && player.name) return `nm:${String(player.name)}`;
	} catch (e) {
		void e;
	}
	return null;
}

function updatePlayerExtraOutputs(cfg, dimension, player, outDtotal, outMtotal) {
	const o = cfg.objectives;
	const identity = player.scoreboardIdentity;
	setScoreIdentityBestEffort(dimension, o.outDefenseTotal, identity, player.name, outDtotal);
	setScoreIdentityBestEffort(dimension, o.outManaTotal, identity, player.name, outMtotal);
}

function updatePlayerVidaMaxTotalBestEffort(cfg, dimension, player, baseVidaMaxH, vidaGearTotal) {
	const vidaCfg = cfg.vidaMaxTotal;
	if (!vidaCfg || vidaCfg.enabled !== true) return { baseVidaMaxH, outVidaMaxTotal: 0 };

	const o = cfg.objectives;
	const identity = player.scoreboardIdentity;
	const base = Math.max(0, Math.trunc(toNumberOr(baseVidaMaxH, 0)));
	const gear = Math.max(0, Math.trunc(toNumberOr(vidaGearTotal, 0)));
	const total = Math.max(0, Math.trunc(base + gear));

	setScoreIdentityBestEffort(dimension, o.outVidaMaxTotal, identity, player.name, total);
	return { baseVidaMaxH: base, outVidaMaxTotal: total };
}

function safeMultiplierOr1(value) {
	const n = toNumberOr(value, 1);
	// Requisito: nunca 0 ni indefinido/NaN.
	if (!Number.isFinite(n) || n === 0) return 1;
	return n;
}

function scoreX10ToMultiplierOr1(rawScoreX10, defaultScoreX10 = 10) {
	const raw = Math.trunc(toNumberOr(rawScoreX10, 0));
	const effective = raw > 0 ? raw : Math.trunc(defaultScoreX10);
	const mult = effective / 10;
	return safeMultiplierOr1(mult);
}

function ensureDefaultMultiplierScores(cfg, dimension, player, identity) {
	const o = cfg.objectives;
	const name = player ? player.name : "";

	let rawMAH = Math.trunc(getScoreIdentityOrNameBestEffort(o.multAdd, identity, name, 0));
	let rawMMH = Math.trunc(getScoreIdentityOrNameBestEffort(o.multMult, identity, name, 0));

	// Requisito: al entrar, defaults a 10 para que sea x1.
	if (rawMAH <= 0) {
		setScoreIdentityBestEffort(dimension, o.multAdd, identity, name, 10);
		rawMAH = 10;
	}
	if (rawMMH <= 0) {
		setScoreIdentityBestEffort(dimension, o.multMult, identity, name, 10);
		rawMMH = 10;
	}

	return { rawMAH, rawMMH };
}

function computeFinalDamageTotals(cfg, dmgTotalInt, critDmgPct, multAddOverride, multMultOverride) {
	const f = cfg && cfg.formula ? cfg.formula : {};

	const dmgTotal = toNumberOr(dmgTotalInt, 0);
	const critPct = toNumberOr(critDmgPct, 0);

	const power = toNumberOr(f.power, 0);
	const multAdd = safeMultiplierOr1(multAddOverride != null ? multAddOverride : f.multiplierAdd);
	const multMult = safeMultiplierOr1(multMultOverride != null ? multMultOverride : f.multiplierMult);
	const bonus = toNumberOr(f.bonus, 0);

	// Fórmula documentada:
	// DañoBaseFinal = (1 + DañoTotal) * (1 + Poder/10) * multAdd * multMult + bonus
	const baseFinal = (1 + dmgTotal) * (1 + power / 10) * multAdd * multMult + bonus;

	const sc = clampMin0Int(floorFinite(baseFinal));
	const cc = clampMin0Int(floorFinite(baseFinal * (1 + critPct / 100)));
	return { sc, cc };
}

function updatePlayerOutputs(cfg, dimension, player, outSC, outCC) {
	const o = cfg.objectives;
	const identity = player.scoreboardIdentity;
	setScoreIdentityBestEffort(dimension, o.outFinalNoCrit, identity, player.name, outSC);
	setScoreIdentityBestEffort(dimension, o.outFinalCrit, identity, player.name, outCC);
}

function updatePlayerCritChanceTotal(cfg, dimension, player, outCritChanceTotal) {
	const o = cfg.objectives;
	const identity = player.scoreboardIdentity;
	setScoreIdentityBestEffort(dimension, o.outCritChanceTotal, identity, player.name, outCritChanceTotal);
}

function shouldDebugEmit(cfg, playerKey, outSC, outCC) {
	const dbg = cfg && cfg.debug ? cfg.debug : null;
	if (!dbg || !dbg.enabled) return false;
	if (dbg.onlyWhenZero && !(outSC === 0 && outCC === 0)) return false;
	const throttleMs = Math.max(0, Math.trunc(dbg.throttleMs != null ? dbg.throttleMs : 0));
	if (!playerKey || throttleMs <= 0) return true;
	const now = Date.now();
	const last = lastDebugMsByPlayerKey.get(playerKey) || 0;
	if (now - last < throttleMs) return false;
	lastDebugMsByPlayerKey.set(playerKey, now);
	return true;
}

function debugTellPlayerBestEffort(cfg, player, message) {
	try {
		const dbg = cfg && cfg.debug ? cfg.debug : null;
		if (!dbg || !dbg.enabled || !dbg.tellPlayer) return;
		if (player && typeof player.sendMessage === "function") player.sendMessage(String(message));
	} catch (e) {
		void e;
	}
}

function zeroPlayerOutputsIfNeeded(cfg, dimension, player, prev) {
	if (
		prev &&
		prev.outSC === 0 &&
		prev.outCC === 0 &&
		prev.outCritChanceTotal === 0 &&
		prev.outDtotal === 0 &&
		prev.outMtotal === 0 &&
		prev.outVidaMaxTotal === 0
	)
		return;
	updatePlayerOutputs(cfg, dimension, player, 0, 0);
	updatePlayerCritChanceTotal(cfg, dimension, player, 0);
	updatePlayerExtraOutputs(cfg, dimension, player, 0, 0);
	// VidaMaxTotalH solo es output (no toca VidaMaxH)
	try {
		const o = cfg.objectives;
		setScoreIdentityBestEffort(dimension, o.outVidaMaxTotal, player.scoreboardIdentity, player.name, 0);
	} catch (e) {
		void e;
	}
}

function tickCalc(cfg) {
	const dim = world.getDimension("minecraft:overworld");
	const o = cfg.objectives;

	/** @type {Set<string>} */
	const active = new Set();

	for (const player of world.getPlayers()) {
		const identity = player.scoreboardIdentity;
		// Si identity no existe aún (carrera al join), intentamos igualmente por nombre.
		// Escrituras: setScoreIdentityBestEffort ya tiene fallback a comando por nombre.

		const playerKey = getPlayerKey(player, identity);
		if (playerKey) active.add(playerKey);

		// Defaults de multiplicadores para todos los jugadores (no depende de H).
		let rawMAH = 0;
		let rawMMH = 0;

		const enabledScore = getScoreIdentityOrNameBestEffort(o.enabled, identity, player.name, 0);
		const enabled = Number(enabledScore) === 1;

		const prev = playerKey ? cacheByPlayerId.get(playerKey) || null : null;

		if (!enabled) {
			if (cfg.disabledBehavior?.zeroOutputs !== false) zeroPlayerOutputsIfNeeded(cfg, dim, player, prev);
			if (shouldDebugEmit(cfg, playerKey, 0, 0)) {
				const msg = `§8[calc] disabled: H=${Math.trunc(enabledScore)} outputs=0`;
				debugLog(cfg, msg);
				debugTellPlayerBestEffort(cfg, player, msg);
			}
			if (playerKey) {
				cacheByPlayerId.set(playerKey, {
					enabled: false,
					signature: "",
					baseDMGH: 0,
					baseCDH: 0,
					baseCCH: 0,
					baseDH: 0,
					baseMH: 0,
					rawMAH: 0,
					rawMMH: 0,
					outSC: 0,
					outCC: 0,
					outCritChanceTotal: 0,
					outDtotal: 0,
					outMtotal: 0,
					vidaGear: 0,
					baseVidaMaxH: 0,
					outVidaMaxTotal: 0,
				});
			}
			continue;
		}

		// Solo si está habilitado, leemos stats base.
		const baseDMGH = Math.trunc(getScoreIdentityOrNameBestEffort(o.baseDamage, identity, player.name, 0));
		const baseCDH = Math.trunc(getScoreIdentityOrNameBestEffort(o.baseCritDamage, identity, player.name, 0));
		const baseCCH = Math.trunc(getScoreIdentityOrNameBestEffort(o.baseCritChance, identity, player.name, 0));
		const baseDH = Math.trunc(getScoreIdentityOrNameBestEffort(o.baseDefense, identity, player.name, 0));
		const baseMH = Math.trunc(getScoreIdentityOrNameBestEffort(o.baseMana, identity, player.name, 0));
		const baseVidaMaxH = Math.trunc(
			getScoreIdentityOrNameBestEffort(
				o.baseVidaMax,
				identity,
				player.name,
				Math.trunc(toNumberOr(cfg.vidaMaxTotal?.defaultBaseVidaMax, 0))
			)
		);

		// Multiplicadores por scoreboard (enteros x10). Defaults a 10 (=> 1.0).
		{
			const r = ensureDefaultMultiplierScores(cfg, dim, player, identity);
			rawMAH = r.rawMAH;
			rawMMH = r.rawMMH;
		}
		const multAdd = scoreX10ToMultiplierOr1(rawMAH, 10);
		const multMult = scoreX10ToMultiplierOr1(rawMMH, 10);

		const equip = getEquippedItemsBestEffort(player);
		const signature = buildEquipmentSignature(equip);

		// Skip si nada relevante cambió (solo si hay cache)
		if (
			prev &&
			prev.enabled === true &&
			prev.signature === signature &&
			prev.baseDMGH === baseDMGH &&
			prev.baseCDH === baseCDH &&
			prev.baseCCH === baseCCH &&
			prev.baseDH === baseDH &&
			prev.baseMH === baseMH &&
			prev.baseVidaMaxH === baseVidaMaxH &&
			prev.rawMAH === rawMAH &&
			prev.rawMMH === rawMMH
		) {
			continue;
		}

		const gear = sumStatsFromItems(equip.items);
		const loreCount = Math.trunc(toNumberOr(gear.loreLines, 0));

		// Totales
		const dmgTotal = Math.trunc(baseDMGH + Math.trunc(gear.damageTotal));
		const critDmgTotal = Number(baseCDH) + Number(gear.critDamageTotal);
		// Crit chance total (porcentaje) = base CCH + suma de gear (mainhand + offhand + armadura)
		// Requisito: el output en scoreboard debe ser int.
		const critChanceTotal = Math.trunc(Math.floor(Number(baseCCH) + Number(gear.critChanceTotal)));

		const { sc, cc } = computeFinalDamageTotals(cfg, dmgTotal, critDmgTotal, multAdd, multMult);

		if (shouldDebugEmit(cfg, playerKey, sc, cc)) {
			const wDmg = Math.trunc(gear.damageTotal);
			const wCrit = Number(gear.critDamageTotal);
			const msg =
				`§8[calc] H=1 DMGH=${baseDMGH} CDH=${baseCDH} CCH=${baseCCH} ` +
				`MAH=${rawMAH}(${multAdd}) MMH=${rawMMH}(${multMult}) ` +
				`gearLore=${loreCount} gDmg=${wDmg} gCrit=${wCrit} ` +
				`totalDmg=${dmgTotal} critPct=${Math.trunc(critDmgTotal)} => SC=${sc} CC=${cc}`;
			debugLog(cfg, msg);
			debugTellPlayerBestEffort(cfg, player, msg);
		}

		// Evitar escrituras redundantes
		if (!prev || prev.outSC !== sc || prev.outCC !== cc) {
			updatePlayerOutputs(cfg, dim, player, sc, cc);
		}
		if (!prev || prev.outCritChanceTotal !== critChanceTotal) {
			updatePlayerCritChanceTotal(cfg, dim, player, critChanceTotal);
		}

		const dTotal = Math.trunc(baseDH + Math.trunc(gear.defensaTotal));
		const mTotal = Math.trunc(baseMH + Math.trunc(gear.manaTotal));
		if (!prev || prev.outDtotal !== dTotal || prev.outMtotal !== mTotal) {
			updatePlayerExtraOutputs(cfg, dim, player, dTotal, mTotal);
		}

		const vidaGearTotal = Math.trunc(gear.vidaTotal);
		let vidaOut = { baseVidaMaxH, outVidaMaxTotal: 0 };
		if (cfg.vidaMaxTotal?.enabled === true) {
			const desiredTotal = Math.max(0, Math.trunc(baseVidaMaxH + vidaGearTotal));
			if (!prev || prev.outVidaMaxTotal !== desiredTotal || prev.baseVidaMaxH !== baseVidaMaxH || prev.vidaGear !== vidaGearTotal) {
				vidaOut = updatePlayerVidaMaxTotalBestEffort(cfg, dim, player, baseVidaMaxH, vidaGearTotal);
			} else {
				vidaOut = { baseVidaMaxH, outVidaMaxTotal: desiredTotal };
			}
		}

		if (playerKey) {
			cacheByPlayerId.set(playerKey, {
				enabled: true,
				signature,
				baseDMGH,
				baseCDH,
				baseCCH,
				baseDH,
				baseMH,
				rawMAH,
				rawMMH,
				outSC: sc,
				outCC: cc,
				outCritChanceTotal: critChanceTotal,
				outDtotal: dTotal,
				outMtotal: mTotal,
				vidaGear: vidaGearTotal,
				baseVidaMaxH: vidaOut.baseVidaMaxH,
				outVidaMaxTotal: vidaOut.outVidaMaxTotal,
			});
		}
	}

	// Cleanup (best-effort)
	for (const key of cacheByPlayerId.keys()) {
		if (!active.has(key)) cacheByPlayerId.delete(key);
	}
}

export function initDamageCalc(userConfig = damageCalcConfig) {
	if (didInit) return;
	didInit = true;

	const cfg = userConfig || damageCalcConfig;
	const loopTicks = Math.max(1, Math.trunc(cfg.loopTicks || 10));

	function startLoopBestEffort(reason) {
		if (didStartLoop) return;
		didStartLoop = true;

		debugLog(cfg, `init(${String(reason)}) loopTicks=${loopTicks}`);

		// Mitiga carreras al arrancar (objective aún no existe) evitando que el loop dependa del fallback de comandos.
		// Migrado a initAllScoreboards (temporalmente desactivado)
		// try {
		// 	const dim = world.getDimension("minecraft:overworld");
		// 	const o = cfg.objectives;
		// 	const d = cfg.displayNames || {};
		// 	ensureObjectiveBestEffort(dim, o.enabled, "dummy", d.enabled);
		// 	ensureObjectiveBestEffort(dim, o.baseDamage, "dummy", d.baseDamage);
		// 	ensureObjectiveBestEffort(dim, o.baseCritChance, "dummy", d.baseCritChance);
		// 	ensureObjectiveBestEffort(dim, o.baseCritDamage, "dummy", d.baseCritDamage);
		// 	ensureObjectiveBestEffort(dim, o.multAdd, "dummy", d.multAdd);
		// 	ensureObjectiveBestEffort(dim, o.multMult, "dummy", d.multMult);
		// 	ensureObjectiveBestEffort(dim, o.outFinalNoCrit, "dummy", d.outFinalNoCrit);
		// 	ensureObjectiveBestEffort(dim, o.outFinalCrit, "dummy", d.outFinalCrit);
		// 	ensureObjectiveBestEffort(dim, o.outCritChanceTotal, "dummy", d.outCritChanceTotal);
		// 	ensureObjectiveBestEffort(dim, o.baseDefense, "dummy", d.baseDefense);
		// 	ensureObjectiveBestEffort(dim, o.baseMana, "dummy", d.baseMana);
		// 	ensureObjectiveBestEffort(dim, o.baseVidaMax, "dummy", d.baseVidaMax);
		// 	ensureObjectiveBestEffort(dim, o.outDefenseTotal, "dummy", d.outDefenseTotal);
		// 	ensureObjectiveBestEffort(dim, o.outManaTotal, "dummy", d.outManaTotal);
		// 	ensureObjectiveBestEffort(dim, o.outVidaMaxTotal, "dummy", d.outVidaMaxTotal);
		// } catch (e) {
		// 	void e;
		// }

		system.runInterval(() => {
			try {
				tickCalc(cfg);
			} catch (e) {
				void e;
				debugLog(cfg, `tick exception: ${String(e)}`);
			}
		}, loopTicks);
	}

	// Defaults por jugador (best-effort). Si no existe el evento en algún runtime, el tick lo corregirá igual.
	try {
		world.afterEvents.playerSpawn.subscribe((ev) => {
			try {
				const player = ev && ev.player ? ev.player : null;
				if (!player) return;
				if (ev && ev.initialSpawn === false) return;
				const dim = world.getDimension("minecraft:overworld");
				const identity = player.scoreboardIdentity;
				// Asegurar objectives antes de setear (migrado a initAllScoreboards)
				// const o = cfg.objectives;
				// const d = cfg.displayNames || {};
				// ensureObjectiveBestEffort(dim, o.multAdd, "dummy", d.multAdd);
				// ensureObjectiveBestEffort(dim, o.multMult, "dummy", d.multMult);
				ensureDefaultMultiplierScores(cfg, dim, player, identity);
			} catch (e) {
				void e;
			}
		});
	} catch (e) {
		void e;
	}

	// 1) Camino preferido: worldLoad (cuando existe y dispara)
	try {
		world.afterEvents.worldLoad.subscribe(() => startLoopBestEffort("worldLoad"));
	} catch (e) {
		void e;
	}

	// 2) Fallback: siguiente tick (algunas versiones/hostings no disparan worldLoad)
	system.run(() => startLoopBestEffort("system.run"));
}
