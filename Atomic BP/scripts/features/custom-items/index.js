import { system, world, EquipmentSlot } from "@minecraft/server";
import { initCustomToolDurabilityFix } from "./durability-fix.js";

let didInit = false;

function arraysEqual(a, b) {
	if (a === b) return true;
	if (!Array.isArray(a) || !Array.isArray(b)) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (String(a[i]) !== String(b[i])) return false;
	}
	return true;
}

function getInventoryContainer(player) {
	try {
		const inv = player.getComponent("inventory");
		return inv && inv.container ? inv.container : undefined;
	} catch {
		return undefined;
	}
}

function getEquippable(player) {
	try {
		return player.getComponent("minecraft:equippable");
	} catch {
		return undefined;
	}
}

function applyDefaultsIfMissing(item, defaults) {
	if (!item) return false;
	let changed = false;

	// Nombre: solo si viene vacío
	try {
		const cur = String(item.nameTag != null ? item.nameTag : "");
		if (!cur) {
			item.nameTag = String(defaults.displayName != null ? defaults.displayName : "");
			changed = true;
		}
	} catch {
		// ignore
	}

	// Lore: solo si viene vacío
	try {
		const curLore = typeof item.getLore === "function" ? item.getLore() : [];
		const nextLore = Array.isArray(defaults.lore) ? defaults.lore.map((s) => String(s)) : [];
		if ((!curLore || curLore.length === 0) && nextLore.length > 0) {
			item.setLore(nextLore);
			changed = true;
		}
	} catch {
		// ignore
	}

	return changed;
}

function processPlayer(player, cfg) {
	const inv = getInventoryContainer(player);
	const eq = getEquippable(player);
	const ids = Object.values(cfg.items || {})
		.map((x) => (x && x.id ? String(x.id) : ""))
		.filter(Boolean);
	if (ids.length === 0) return;

	// Inventario
	if (inv) {
		for (let slot = 0; slot < inv.size; slot++) {
			const it = inv.getItem(slot);
			if (!it) continue;
			if (!ids.includes(it.typeId)) continue;

			if (applyDefaultsIfMissing(it, cfg.defaults)) {
				inv.setItem(slot, it);
			}
		}
	}

	// Equipo
	if (eq) {
		const slots = [
			EquipmentSlot.Mainhand,
			EquipmentSlot.Offhand,
			EquipmentSlot.Head,
			EquipmentSlot.Chest,
			EquipmentSlot.Legs,
			EquipmentSlot.Feet,
		];
		for (const s of slots) {
			let it;
			try {
				it = eq.getEquipment(s);
			} catch {
				it = undefined;
			}
			if (!it) continue;
			if (!ids.includes(it.typeId)) continue;

			if (applyDefaultsIfMissing(it, cfg.defaults)) {
				try {
					eq.setEquipment(s, it);
				} catch {
					// ignore
				}
			}
		}
	}
}

export function initCustomItems(cfg) {
	if (didInit) return;
	didInit = true;

	// Fix durabilidad por script (sin custom components)
	initCustomToolDurabilityFix(cfg);

	const every = Math.max(10, Number(cfg && cfg.scanEveryTicks != null ? cfg.scanEveryTicks : 40));

	world.afterEvents.worldLoad.subscribe(() => {
		system.runInterval(() => {
			for (const player of world.getPlayers()) {
				try {
					processPlayer(player, cfg);
				} catch {
					// ignore
				}
			}
		}, every);
	});
}
