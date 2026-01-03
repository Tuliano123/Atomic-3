// Modifiers: detección de "encantamientos falsos" por lore y resolución del modifier activo.
// Responsabilidad: NO spawnear drops ni tocar bloques; solo decidir qué tabla usar.

function stripFormatting(text) {
	// Quita códigos de color/format de Bedrock (ej: §a, §l, etc.)
	return String(text != null ? text : "").replace(/§[0-9a-fklmnor]/gi, "");
}

function normalizeLine(line) {
	return stripFormatting(line).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Extrae lore en formato normalizado (lowercase, sin §, sin espacios dobles).
 * @param {any} toolItemStack
 * @returns {string[]}
 */
export function getNormalizedToolLore(toolItemStack) {
	let lore = [];
	try {
		lore = toolItemStack && typeof toolItemStack.getLore === "function" ? toolItemStack.getLore() : [];
	} catch (e) {
		void e;
		lore = [];
	}
	if (!Array.isArray(lore) || lore.length === 0) return [];
	return lore.map(normalizeLine).filter(Boolean);
}

/**
 * Parser de estado simple para futuras decisiones (sin depender de la config).
 * Nota: el sistema final decide por config/modifiers; esto es solo útil para debug/extensión.
 * @param {string[]} normalizedLoreLines
 */
export function parseFakeEnchantmentsFromLore(normalizedLoreLines) {
	const lines = Array.isArray(normalizedLoreLines) ? normalizedLoreLines : [];
	const joined = lines.join("\n");

	const hasSilk = /\b(silk touch i|toque de seda i)\b/.test(joined);
	let fortuneLevel = 0;
	if (/\b(fortuna iii|fortune iii)\b/.test(joined)) fortuneLevel = 3;
	else if (/\b(fortuna ii|fortune ii)\b/.test(joined)) fortuneLevel = 2;
	else if (/\b(fortuna i|fortune i)\b/.test(joined)) fortuneLevel = 1;

	return {
		silkTouchLevel: hasSilk ? 1 : 0,
		fortuneLevel,
	};
}

function matchesAny(joinedLore, matchList) {
	if (!Array.isArray(matchList) || matchList.length === 0) return false;
	for (const m of matchList) {
		const needle = normalizeLine(m);
		if (!needle) continue;
		if (joinedLore.includes(needle)) return true;
	}
	return false;
}

/**
 * Elige el modifier con mayor prioridad que matchee con el lore.
 * @param {any} oreDef
 * @param {string[]} normalizedLoreLines
 * @returns {{ key: string, def: any } | null}
 */
export function selectActiveModifier(oreDef, normalizedLoreLines) {
	const modifiers = oreDef && oreDef.modifiers && typeof oreDef.modifiers === "object" ? oreDef.modifiers : null;
	if (!modifiers) return null;

	const joinedLore = (Array.isArray(normalizedLoreLines) ? normalizedLoreLines : []).join("\n");
	if (!joinedLore) return null;

	let best = null;
	let bestPriority = -Infinity;

	for (const [key, def] of Object.entries(modifiers)) {
		if (!def || typeof def !== "object") continue;
		const priority = Number(def.priority != null ? def.priority : 0);
		const match = Array.isArray(def.match) ? def.match : [];
		if (!matchesAny(joinedLore, match)) continue;
		if (priority > bestPriority) {
			bestPriority = priority;
			best = { key, def };
		}
	}

	return best;
}

/**
 * Resuelve la tabla final de drops.
 * - mode=override => reemplaza
 * - mode=add => concatena
 * @param {any} oreDef
 * @param {{def:any}|null} selected
 */
export function resolveDropsTable(oreDef, selected) {
	const base = Array.isArray(oreDef && oreDef.drops) ? oreDef.drops : [];
	if (!selected || !selected.def) return base;

	const mode = String(selected.def.mode != null ? selected.def.mode : "override");
	const modDrops = Array.isArray(selected.def.drops) ? selected.def.drops : [];

	if (mode === "add") return base.concat(modDrops);
	// Default: override
	return modDrops.length ? modDrops : base;
}
