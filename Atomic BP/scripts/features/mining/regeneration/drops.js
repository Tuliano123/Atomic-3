// Drops: tirar tabla de drops y spawnear ítems.
// Responsabilidad: NO elegir modifiers ni tocar persistencia.

import * as mc from "@minecraft/server";

function toInt(n, fallback) {
	const v = Number(n);
	if (!Number.isFinite(v)) return fallback;
	return Math.floor(v);
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function randIntInclusive(min, max) {
	const a = Math.ceil(min);
	const b = Math.floor(max);
	return Math.floor(Math.random() * (b - a + 1)) + a;
}

function normalizeLore(value) {
	if (value == null) return [];
	if (Array.isArray(value)) return value.map((x) => String(x)).filter(Boolean);
	const s = String(value);
	return s ? [s] : [];
}

/**
 * Tira un drop entry.
 * DropEntryTuple: [dropId, itemId, minQty, maxQty, chancePct, nameTag, lore]
 * @param {any} dropTuple
 * @returns {{ itemId:string, qty:number, nameTag:string|null, lore:string[] } | null}
 */
export function rollDrop(dropTuple) {
	if (!Array.isArray(dropTuple) || dropTuple.length < 5) return null;

	const itemId = String(dropTuple[1] != null ? dropTuple[1] : "").trim();
	if (!itemId) return null;

	const minQty = clamp(toInt(dropTuple[2], 1), 0, 64);
	const maxQty = clamp(toInt(dropTuple[3], minQty), 0, 64);
	const chancePct = clamp(Number(dropTuple[4] != null ? dropTuple[4] : 0), 0, 100);

	if (chancePct <= 0) return null;
	if (Math.random() * 100 > chancePct) return null;

	const qty = randIntInclusive(minQty, Math.max(minQty, maxQty));
	if (qty <= 0) return null;

	const nameTagRaw = dropTuple.length >= 6 ? dropTuple[5] : null;
	const loreRaw = dropTuple.length >= 7 ? dropTuple[6] : null;

	const nameTag = nameTagRaw != null && String(nameTagRaw).trim() ? String(nameTagRaw) : null;
	const lore = normalizeLore(loreRaw);

	return { itemId, qty, nameTag, lore };
}

/**
 * Spawnea un ítem dropeado en el suelo.
 * @param {mc.Dimension} dimension
 * @param {{x:number,y:number,z:number}} blockPos
 * @param {{ itemId:string, qty:number, nameTag:string|null, lore:string[] }} rolled
 */
export function spawnDropItem(dimension, blockPos, rolled) {
	if (!dimension || !rolled) return false;
	try {
		const item = new mc.ItemStack(rolled.itemId, rolled.qty);
		if (rolled.nameTag) item.nameTag = rolled.nameTag;
		if (rolled.lore && rolled.lore.length) item.setLore(rolled.lore);

		// Centro del bloque para que no quede dentro del bloque.
		const pos = {
			x: Number(blockPos.x) + 0.5,
			y: Number(blockPos.y) + 0.5,
			z: Number(blockPos.z) + 0.5,
		};
		dimension.spawnItem(item, pos);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

/**
 * Ejecuta una tabla de drops y spawnea lo que salga.
 * @param {mc.Dimension} dimension
 * @param {{x:number,y:number,z:number}} blockPos
 * @param {any[]} dropsTable
 */
export function runDropsTable(dimension, blockPos, dropsTable) {
	if (!Array.isArray(dropsTable) || dropsTable.length === 0) return 0;
	let spawned = 0;
	for (const entry of dropsTable) {
		const rolled = rollDrop(entry);
		if (!rolled) continue;
		if (spawnDropItem(dimension, blockPos, rolled)) spawned++;
	}
	return spawned;
}
