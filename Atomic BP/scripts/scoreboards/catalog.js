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
	addObjective(list, seen, "H", "H"); // Modo Historia (1 = Esta en el modo Historia, 0 = No.)
	addObjective(list, seen, "Vida", "Vida"); // Vida actual del jugador
	addObjective(list, seen, "VidaMaxH", "VidaMax Base"); // Vida maxima base (sin mejoras)
	addObjective(list, seen, "VidaMaxTotalH", "VidaMax Total"); // Vida maxima total (con mejoras)
	addObjective(list, seen, "VidaAbsorcion", "Vida Absorcion"); // Vida de absorcion (corazones dorados)
	addObjective(list, seen, "HDead", "HDead");

	// --- Combat / Damage Dealt ---
	addObjective(list, seen, "DanoFinalSC", "Dano Final SC"); // Daño final del jugador SIN critico sin contar defensa
	addObjective(list, seen, "DanoFinalCC", "Dano Final CC"); // Daño final del jugador CON critico sin contar defensa
	addObjective(list, seen, "ProbabilidadCriticaTotal", "Prob Crit Total"); // Probabilidad de critico total del jugador
	addObjective(list, seen, "DtotalH", "Def Total"); // Defensa total del jugador o mob
	addObjective(list, seen, "DMGH", "DMGH"); // Daño del jugador base
	addObjective(list, seen, "LastKillerId", "Last Killer Id"); // Id del ultimo que mató al jugador
	addObjective(list, seen, "LastKillTick", "Last Kill Tick"); // Tick de la ultima kill del jugador

	// --- Combat / Effects (custom) ---
	addObjective(list, seen, "EffVeneno", "Eff Veneno");
	addObjective(list, seen, "EffCongelamiento", "Eff Congelamiento");
	addObjective(list, seen, "EffCalor", "Eff Calor");

	// --- mcfunction (General3 / Seguridad1) ---
	addObjective(list, seen, "ticksegundos", "ticksegundos"); // Contador de ticks en segundos
	addObjective(list, seen, "segundos", "segundos"); // Contador de segundos
	addObjective(list, seen, "minutos", "minutos"); // Contador de minutos
	addObjective(list, seen, "horas", "horas"); // Contador de horas
	addObjective(list, seen, "dias", "dias"); // Contador de dias
	addObjective(list, seen, "limbo", "limbo"); // Limbo status
	addObjective(list, seen, "lobbytitle", "lobbytitle"); // Titulo de lobby
	addObjective(list, seen, "lt", "lt"); // Lobby title multicolor
	addObjective(list, seen, "ltsuperior", "ltsuperior"); // Lobby title multicolor superior
	addObjective(list, seen, "Coo", "Coo"); // Cooldown general (IMPORTANTE!)
	addObjective(list, seen, "CooHelper", "CooHelper"); // Cooldown de actionbar para helper
	addObjective(list, seen, "D", "Dinero"); // Dinero del jugador
	addObjective(list, seen, "DB", "DineroBanco"); // Dinero en el banco del jugador
	addObjective(list, seen, "DBlimite", "DBlimite"); // Límite del banco del jugador
	addObjective(list, seen, "Mejora", "MejoraBanco"); // Nivel de mejora del banco
	addObjective(list, seen, "Acto", "Acto"); // Progreso de historia (Acto completado)
	addObjective(list, seen, "xptitle", "xptitle"); // Titulo de XP
	addObjective(list, seen, "XP", "XP"); // XP del jugador
	addObjective(list, seen, "killtitle", "killtitle"); // Titulo de kills
	addObjective(list, seen, "Se", "Se"); // Segador de kills
	addObjective(list, seen, "muertetitle", "muertetitle"); // Titulo de muertes
	addObjective(list, seen, "almatitle", "almatitle"); // Titulo de almas
	addObjective(list, seen, "So", "So"); // Souls (Almas)
	addObjective(list, seen, "versiontitle", "versiontitle"); // Titulo de version
	addObjective(list, seen, "versiontitlevalor1", "versiontitlevalor1"); // Titulo de version valor 1
	addObjective(list, seen, "versiontitlevalor2", "versiontitlevalor2"); // Titulo de version valor 2
	addObjective(list, seen, "versiontitlevalor3", "versiontitlevalor3"); // Titulo de version valor 3
	addObjective(list, seen, "ID", "ID"); // ID del jugador
	addObjective(list, seen, "IDAsignada", "IDAsignada"); // ID Asignada del jugador
	addObjective(list, seen, "TotalIDs", "TotalIDs"); // Total de IDs asignadas
	addObjective(list, seen, "EntityCramming", "EntityCramming"); // Entity Cramming (para anticheat)
	addObjective(list, seen, "FillBeeHiveNest", "FillBeeHiveNest"); // Fill Bee Hive Nest (para anticheat)
	addObjective(list, seen, "vip", "vip"); // VIP status
	addObjective(list, seen, "spawnpoint", "spawnpoint"); // Spawnpoint status

	// systems/onJoinFirstTime ---
	addObjective(list, seen, "nuevo", "nuevo");

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
