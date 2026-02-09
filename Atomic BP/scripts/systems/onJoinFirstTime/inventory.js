import { EquipmentSlot, ItemStack } from "@minecraft/server";
import { debugLog, getOverworldDimension, getPlayerSelector, runCommandForPlayer } from "./commands.js";

function getInventoryContainer(player) {
	try {
		const comp = player?.getComponent?.("inventory") ?? player?.getComponent?.("minecraft:inventory");
		return comp?.container ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

function getEnderChestContainer(player) {
	try {
		const comp = player?.getComponent?.("minecraft:ender_chest") ?? player?.getComponent?.("ender_chest");
		return comp?.container ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

// Command helpers are centralized in commands.js

function clearContainer(container) {
	if (!container || typeof container.size !== "number") return false;
	try {
		for (let i = 0; i < container.size; i++) {
			container.setItem(i, undefined);
		}
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function clearEquippedItems(player) {
	try {
		const eq = player?.getComponent?.("minecraft:equippable") ?? player?.getComponent?.("equippable");
		if (!eq) return false;
		let changed = false;
		for (const slot of [EquipmentSlot.Offhand, EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
			try {
				const cur = eq.getEquipment(slot);
				if (cur) {
					eq.setEquipment(slot, undefined);
					changed = true;
				}
			} catch (e) {
				void e;
			}
		}
		return changed;
	} catch (e) {
		void e;
		return false;
	}
}

async function clearEnderChestByCommand(player, config) {
	const selector = getPlayerSelector(player);
	let anyOk = false;
	for (let i = 0; i < 27; i++) {
		anyOk = (await runCommandForPlayer(
			player,
			`item replace entity @s slot.enderchest ${i} with air`,
			`item replace entity ${selector} slot.enderchest ${i} with air`,
			config,
			"enderChest"
		)) || anyOk;
		anyOk = (await runCommandForPlayer(
			player,
			`replaceitem entity @s slot.enderchest ${i} air 1`,
			`replaceitem entity ${selector} slot.enderchest ${i} air 1`,
			config,
			"enderChest"
		)) || anyOk;
	}
	return anyOk;
}

export async function clearPlayerInventory(player, config) {
	if (!player) return false;
	let ok = false;

	const inv = getInventoryContainer(player);
	if (inv) {
		ok = clearContainer(inv) || ok;
	} else {
		const selector = getPlayerSelector(player);
		ok = (await runCommandForPlayer(player, "clear @s", `clear ${selector}`, config, "clearInv")) || ok;
	}

	if (config?.clearAll) {
		const ender = getEnderChestContainer(player);
		if (ender) {
			ok = clearContainer(ender) || ok;
		} else {
			ok = (await clearEnderChestByCommand(player, config)) || ok;
		}
	}

	// Limpiar offhand + armadura (siempre en flujo de primera vez)
	ok = clearEquippedItems(player) || ok;

	return ok;
}

function applyKeepOnDeath(item) {
	if (!item) return;
	try {
		if ("keepOnDeath" in item) {
			item.keepOnDeath = true;
			return;
		}
	} catch (e) {
		void e;
	}
	try {
		const comp = item.getComponent?.("minecraft:keep_on_death");
		if (comp && typeof comp.setValue === "function") comp.setValue(true);
		if (comp && "keepOnDeath" in comp) comp.keepOnDeath = true;
	} catch (e) {
		void e;
	}
}

function applyCanDestroy(item, blocks) {
	if (!item || !Array.isArray(blocks) || !blocks.length) return;
	try {
		if (typeof item.setCanDestroy === "function") {
			item.setCanDestroy(blocks.map((b) => String(b)));
			return;
		}
	} catch (e) {
		void e;
	}
	try {
		const comp = item.getComponent?.("minecraft:can_destroy");
		if (comp && typeof comp.setCanDestroy === "function") {
			comp.setCanDestroy(blocks.map((b) => String(b)));
		}
	} catch (e) {
		void e;
	}
}

function insertItemIntoInventory(player, item, config) {
	const inv = getInventoryContainer(player);
	if (!inv) return false;

	try {
		if (typeof inv.addItem === "function") {
			const leftover = inv.addItem(item);
			if (!leftover) return true;
			try {
				player?.dimension?.spawnItem?.(leftover, player.location);
			} catch (e) {
				void e;
			}
			return true;
		}
	} catch (e) {
		void e;
	}

	for (let i = 0; i < inv.size; i++) {
		try {
			const cur = inv.getItem(i);
			if (!cur) {
				inv.setItem(i, item);
				return true;
			}
		} catch (e) {
			void e;
		}
	}

	try {
		player?.dimension?.spawnItem?.(item, player.location);
	} catch (e) {
		void e;
	}
	return true;
}

export function giveConfiguredItem(player, config) {
	if (!player || !config?.item) return false;

	let item = null;
	try {
		item = new ItemStack(String(config.item), 1);
	} catch (e) {
		void e;
		return false;
	}

	try {
		if (config.name) item.nameTag = String(config.name);
		if (Array.isArray(config.lore) && config.lore.length) item.setLore(config.lore.map((l) => String(l)));
	} catch (e) {
		void e;
	}

	if (Array.isArray(config.properties)) {
		for (const prop of config.properties) {
			if (String(prop) === "keep_on_death") applyKeepOnDeath(item);
		}
	}

	applyCanDestroy(item, config.canDestroy);

	const inserted = insertItemIntoInventory(player, item, config);
	if (!inserted) debugLog({ debug: true }, "No se pudo insertar item en inventario");
	return inserted;
}

