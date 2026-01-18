import { anticheatConfig } from "../features/anticheat/anticheat.config.js";
import { damageCalcConfig } from "../features/skills/calc/config.js";
import { skillRegenConfig } from "../features/skills/regeneration/config.js";
import achievementsConfig from "../features/achievements/config.js";

function safeString(value) {
	return String(value != null ? value : "").trim();
}

/**
 * @typedef {{ id: string, displayName?: string }} ObjectiveDef
 */

function addObjective(list, seen, id, displayName = undefined) {
	const objId = safeString(id);
	if (!objId) return;
	if (seen.has(objId)) return;
	seen.add(objId);
	list.push({ id: objId, displayName: displayName != null ? String(displayName) : undefined });
}

function addObjectivesFromMap(list, seen, mapObj) {
	if (!mapObj || typeof mapObj !== "object") return;
	for (const key of Object.keys(mapObj)) {
		addObjective(list, seen, key, key);
	}
}

function addRegenObjectives(list, seen, config) {
	const metrics = config?.metrics?.scoreboardAddsOnBreak;
	addObjectivesFromMap(list, seen, metrics);

	const blocks = Array.isArray(config?.blocks) ? config.blocks : [];
	for (const block of blocks) {
		addObjectivesFromMap(list, seen, block?.scoreboardAddsOnBreak);

		const modifiers = block?.modifiers && typeof block.modifiers === "object" ? block.modifiers : null;
		if (!modifiers) continue;
		for (const mod of Object.values(modifiers)) {
			addObjectivesFromMap(list, seen, mod?.scoreboardAddsOnBreak);
		}
	}
}

export function buildScoreboardCatalog() {
	/** @type {ObjectiveDef[]} */
	const list = [];
	const seen = new Set();

	// --- AntiCheat (configurable) ---
	{
		const sb = anticheatConfig?.storage?.scoreboards || {};
		addObjective(list, seen, sb?.featureFlags?.scoreboard ?? "ac_feature_flags", sb?.featureFlags?.display ?? "ac_feature_flags");
		addObjective(list, seen, sb?.playerWarnings?.scoreboard ?? "advertencias", sb?.playerWarnings?.display ?? "advertencias");
		addObjective(list, seen, sb?.banUntil?.scoreboard ?? "ac_ban_until", sb?.banUntil?.display ?? "ac_ban_until");
		addObjective(list, seen, sb?.banSeconds?.scoreboard ?? "ac_ban_seconds", sb?.banSeconds?.display ?? "ac_ban_seconds");
		addObjective(list, seen, sb?.banSanction?.scoreboard ?? "ac_ban_sanction", sb?.banSanction?.display ?? "ac_ban_sanction");
	}

	// --- Skills / Calc (configurable) ---
	{
		const o = damageCalcConfig?.objectives || {};
		const d = damageCalcConfig?.displayNames || {};
		addObjective(list, seen, o.enabled, d.enabled);
		addObjective(list, seen, o.baseDamage, d.baseDamage);
		addObjective(list, seen, o.baseCritDamage, d.baseCritDamage);
		addObjective(list, seen, o.baseCritChance, d.baseCritChance);
		addObjective(list, seen, o.baseDefense, d.baseDefense);
		addObjective(list, seen, o.baseMana, d.baseMana);
		addObjective(list, seen, o.baseVidaMax, d.baseVidaMax);
		addObjective(list, seen, o.multAdd, d.multAdd);
		addObjective(list, seen, o.multMult, d.multMult);
		addObjective(list, seen, o.outFinalNoCrit, d.outFinalNoCrit);
		addObjective(list, seen, o.outFinalCrit, d.outFinalCrit);
		addObjective(list, seen, o.outCritChanceTotal, d.outCritChanceTotal);
		addObjective(list, seen, o.outDefenseTotal, d.outDefenseTotal);
		addObjective(list, seen, o.outManaTotal, d.outManaTotal);
		addObjective(list, seen, o.outVidaMaxTotal, d.outVidaMaxTotal);
	}

	// --- Combat / Health ---
	addObjective(list, seen, "H", "H");
	addObjective(list, seen, "Vida", "Vida");
	addObjective(list, seen, "VidaMaxH", "VidaMax Base");
	addObjective(list, seen, "VidaMaxTotalH", "VidaMax Total");
	addObjective(list, seen, "VidaAbsorcion", "Vida Absorcion");
	addObjective(list, seen, "HDead", "HDead");

	// --- Combat / Damage Dealt ---
	addObjective(list, seen, "DanoFinalSC", "Dano Final SC");
	addObjective(list, seen, "DanoFinalCC", "Dano Final CC");
	addObjective(list, seen, "ProbabilidadCriticaTotal", "Prob Crit Total");
	addObjective(list, seen, "DtotalH", "Def Total");
	addObjective(list, seen, "DMGH", "DMGH");
	addObjective(list, seen, "LastKillerId", "Last Killer Id");
	addObjective(list, seen, "LastKillTick", "Last Kill Tick");

	// --- mcfunction (General3 / Seguridad1) ---
	addObjective(list, seen, "ticksegundos", "ticksegundos");
	addObjective(list, seen, "segundos", "segundos");
	addObjective(list, seen, "minutos", "minutos");
	addObjective(list, seen, "horas", "horas");
	addObjective(list, seen, "dias", "dias");
	addObjective(list, seen, "muerto", "muerto");
	addObjective(list, seen, "M", "M");
	addObjective(list, seen, "MsgMuerte", "MsgMuerte");
	addObjective(list, seen, "NoTpUnido", "NoTpUnido");
	addObjective(list, seen, "unido", "unido");
	addObjective(list, seen, "limbo", "limbo");
	addObjective(list, seen, "ExcMuerte", "ExcMuerte");
	addObjective(list, seen, "lobbytitle", "lobbytitle");
	addObjective(list, seen, "lt", "lt");
	addObjective(list, seen, "ltsuperior", "ltsuperior");
	addObjective(list, seen, "Coo", "Coo");
	addObjective(list, seen, "CooHelper", "CooHelper");
	addObjective(list, seen, "D", "D");
	addObjective(list, seen, "xptitle", "xptitle");
	addObjective(list, seen, "XP", "XP");
	addObjective(list, seen, "killtitle", "killtitle");
	addObjective(list, seen, "Se", "Se");
	addObjective(list, seen, "muertetitle", "muertetitle");
	addObjective(list, seen, "almatitle", "almatitle");
	addObjective(list, seen, "So", "So");
	addObjective(list, seen, "versiontitle", "versiontitle");
	addObjective(list, seen, "versiontitlevalor1", "versiontitlevalor1");
	addObjective(list, seen, "versiontitlevalor2", "versiontitlevalor2");
	addObjective(list, seen, "versiontitlevalor3", "versiontitlevalor3");
	addObjective(list, seen, "ID", "ID");
	addObjective(list, seen, "IDAsignada", "IDAsignada");
	addObjective(list, seen, "TotalIDs", "TotalIDs");
	addObjective(list, seen, "EntityCramming", "EntityCramming");
	addObjective(list, seen, "FillBeeHiveNest", "FillBeeHiveNest");
	addObjective(list, seen, "vip", "vip");
	addObjective(list, seen, "spawnpoint", "spawnpoint");

	// --- Archivements (LOGROS) ---
	addObjective(list, seen, "mobs", "mobs");
	addObjective(list, seen, "muertes", "muertes");
	addObjective(list, seen, "Parcela", "Parcela");
	addObjective(list, seen, "Corazones", "Corazones");
	addObjective(list, seen, String(achievementsConfig?.totals?.playerTotalObjective ?? "Logros"), "Logros");
	addObjective(list, seen, String(achievementsConfig?.totals?.totalObjective ?? "LogrosTotal"), "LogrosTotal");

	// --- Achievements (per-logro objectives) ---
	for (const ach of achievementsConfig?.achievements || []) {
		const internal = ach?.internalObjective ? String(ach.internalObjective) : `Logro_${ach?.id}`;
		addObjective(list, seen, internal, internal);
	}

	// --- Regeneration (configurable) ---
	addRegenObjectives(list, seen, skillRegenConfig);

	return list;
}
