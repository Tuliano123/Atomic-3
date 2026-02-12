import { system, world } from "@minecraft/server";
import configDefault from "./config.js";
import { applyCustomEmojisToText } from "../../features/custom-emojis/index.js";

let didInit = false;

function asStr(v) {
	return String(v != null ? v : "");
}

function safeString(v) {
	return String(v != null ? v : "").trim();
}

function isFiniteNumber(n) {
	return typeof n === "number" && Number.isFinite(n);
}

function debugLog(cfg, msg) {
	if (!cfg?.debug) return;
	try {
		console.log(`[titlesPriority] ${String(msg ?? "")}`);
	} catch (e) {
		void e;
	}
}

function applyEmojisIfEnabled(cfg, text) {
	if (!cfg?.emojis?.enabled) return asStr(text);
	try {
		return applyCustomEmojisToText(asStr(text));
	} catch (e) {
		void e;
		return asStr(text);
	}
}

function normalizeTitles(config) {
	const t = config?.titles;
	if (Array.isArray(t)) return t;
	if (t && typeof t === "object") {
		// Alternativa documentada: titles como mapa por id
		const out = [];
		for (const [id, def] of Object.entries(t)) {
			if (!def || typeof def !== "object") continue;
			out.push({ id, ...def });
		}
		return out;
	}
	return [];
}

function normalizeAabb(area) {
	const at = area?.at;
	const to = area?.to;
	if (!at || !to) return null;
	const ax = Number(at.x), ay = Number(at.y), az = Number(at.z);
	const bx = Number(to.x), by = Number(to.y), bz = Number(to.z);
	if (![ax, ay, az, bx, by, bz].every((v) => Number.isFinite(v))) return null;
	return {
		minX: Math.min(ax, bx),
		minY: Math.min(ay, by),
		minZ: Math.min(az, bz),
		maxX: Math.max(ax, bx),
		maxY: Math.max(ay, by),
		maxZ: Math.max(az, bz),
	};
}

function isInAabb(loc, aabb) {
	if (!loc || !aabb) return false;
	const x = Number(loc.x), y = Number(loc.y), z = Number(loc.z);
	if (![x, y, z].every((v) => Number.isFinite(v))) return false;
	return x >= aabb.minX && x <= aabb.maxX && y >= aabb.minY && y <= aabb.maxY && z >= aabb.minZ && z <= aabb.maxZ;
}

function compareInt(left, op, right) {
	const a = Math.trunc(Number(left));
	const b = Math.trunc(Number(right));
	if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
	const o = safeString(op);
	switch (o) {
		case "==":
			return a === b;
		case "!=":
			return a !== b;
		case ">=":
			return a >= b;
		case "<=":
			return a <= b;
		case ">":
			return a > b;
		case "<":
			return a < b;
		default:
			return false;
	}
}

/** @type {Map<string, any>} */
const objectiveCache = new Map();

function getObjectiveCached(id) {
	const objectiveId = safeString(id);
	if (!objectiveId) return null;
	if (objectiveCache.has(objectiveId)) return objectiveCache.get(objectiveId) ?? null;
	try {
		const obj = world.scoreboard.getObjective(objectiveId) ?? null;
		objectiveCache.set(objectiveId, obj);
		return obj;
	} catch (e) {
		void e;
		objectiveCache.set(objectiveId, null);
		return null;
	}
}

function getScoreBestEffort(player, objectiveId) {
	try {
		const obj = getObjectiveCached(objectiveId);
		if (!obj) return null;
		const identity = player?.scoreboardIdentity ?? null;
		if (!identity) return null;
		const v = obj.getScore(identity);
		if (v === undefined || v === null) return null;
		const n = Math.trunc(Number(v));
		return Number.isFinite(n) ? n : null;
	} catch (e) {
		void e;
		return null;
	}
}

const PLACEHOLDER_RE = /\$\{([^:}]+):([^}]+)\}/g;

function parseLineToRawtext(cfg, line) {
	const s = asStr(line);
	/** @type {any[]} */
	const raw = [];
	let last = 0;
	PLACEHOLDER_RE.lastIndex = 0;
	for (let m = PLACEHOLDER_RE.exec(s); m; m = PLACEHOLDER_RE.exec(s)) {
		const start = m.index;
		const end = m.index + m[0].length;
		if (start > last) {
			const chunk = s.slice(last, start);
			if (chunk) raw.push({ text: applyEmojisIfEnabled(cfg, chunk) });
		}

		const objective = safeString(m[1]);
		const name = safeString(m[2]);
		if (objective && name) raw.push({ score: { name, objective } });
		else raw.push({ text: applyEmojisIfEnabled(cfg, m[0]) });

		last = end;
	}
	if (last < s.length) {
		const tail = s.slice(last);
		if (tail) raw.push({ text: applyEmojisIfEnabled(cfg, tail) });
	}
	if (raw.length === 0) raw.push({ text: applyEmojisIfEnabled(cfg, s) });
	return raw;
}

function buildActionbarRawtext(cfg, contentLines) {
	const lines = Array.isArray(contentLines) ? contentLines : [contentLines];
	/** @type {any[]} */
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		out.push(...parseLineToRawtext(cfg, line));
		if (i !== lines.length - 1) out.push({ text: "\n" });
	}
	return out;
}

function playerIsInOverworld(player) {
	try {
		return player?.dimension?.id === "minecraft:overworld";
	} catch (e) {
		void e;
		return false;
	}
}

function matchesDisplayIf(player, displayIf) {
	const di = displayIf && typeof displayIf === "object" ? displayIf : null;
	if (!di) return true;

	if (di.area != null) {
		if (!playerIsInOverworld(player)) return false;
		const aabb = normalizeAabb(di.area);
		if (!aabb) return false;
		const loc = player?.location;
		if (!isInAabb(loc, aabb)) return false;
	}

	if (di.score != null) {
		const sc = di.score && typeof di.score === "object" ? di.score : null;
		if (!sc) return false;
		const objectiveId = safeString(sc.objective);
		const cond = safeString(sc.condition);
		const rhs = Math.trunc(Number(sc.int));
		if (!objectiveId || !cond || !Number.isFinite(rhs)) return false;
		const lhs = getScoreBestEffort(player, objectiveId);
		if (lhs == null) return false;
		if (!compareInt(lhs, cond, rhs)) return false;
	}

	return true;
}

function pickBestTitle(cfg, titles, player) {
	let best = null;
	let bestPriority = -Infinity;

	for (const entry of titles) {
		if (!entry || typeof entry !== "object") continue;
		const id = safeString(entry.id);
		const priority = Number(entry.priority);
		const pr = isFiniteNumber(priority) ? priority : 0;
		if (!id) continue;
		if (!matchesDisplayIf(player, entry.display_if)) continue;
		if (best == null || pr > bestPriority) {
			best = entry;
			bestPriority = pr;
		}
		// Desempate por orden: si pr == bestPriority, NO reemplazamos.
	}

	return best;
}

async function sendActionbarTitleraw(player, rawtext) {
	try {
		if (!player?.runCommandAsync) return false;
		const payload = JSON.stringify({ rawtext });
		await player.runCommandAsync(`titleraw @s actionbar ${payload}`);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function getPlayerId(player) {
	try {
		return safeString(player?.id) || safeString(player?.name);
	} catch (e) {
		void e;
		return "";
	}
}

async function tickTitlesPriority(cfg) {
	const titles = normalizeTitles(cfg);
	if (!titles.length) return;

	const players = world.getAllPlayers();
	for (const player of players) {
		const best = pickBestTitle(cfg, titles, player);
		if (!best) continue;

		// Importante: el actionbar se desvanece y los scores se resuelven al ejecutar el comando.
		// Por eso se re-emite el titleraw en cada tick del loop.
		const rawtext = buildActionbarRawtext(cfg, best.content ?? "");
		await sendActionbarTitleraw(player, rawtext);
	}
}

export function initTitlesPrioritySystem(userConfig = undefined) {
	if (didInit) return;
	didInit = true;

	const cfg = userConfig && typeof userConfig === "object" ? userConfig : configDefault;
	const loopTicks = 10; // actionbar requiere refresco; mantener constante para evitar scope extra en config
	debugLog(cfg, `init loopTicks=${loopTicks}`);

	system.runInterval(() => {
		try {
			void tickTitlesPriority(cfg);
		} catch (e) {
			void e;
		}
	}, loopTicks);
}
