// Feature: skills/lecture

import { EquipmentSlot, ItemStack } from "@minecraft/server";

function safeLore(item) {
	try {
		if (!item || typeof item.getLore !== "function") return [];
		const lore = item.getLore();
		return Array.isArray(lore) ? lore.map((l) => String(l ?? "")) : [];
	} catch (e) {
		void e;
		return [];
	}
}

function isWearableArmorInMainhand(item) {
	try {
		if (!item) return false;

		// Si tiene componente wearable y el slot es de armor.
		const wearable = item.getComponent?.("minecraft:wearable");
		const slot = wearable?.slot;
		if (typeof slot === "string" && slot.includes("slot.armor.")) return true;

		// Fallback: typeId termina en piezas típicas.
		const typeId = String(item.typeId ?? "");
		return (
			typeId.endsWith("_helmet") ||
			typeId.endsWith("_chestplate") ||
			typeId.endsWith("_leggings") ||
			typeId.endsWith("_boots")
		);
	} catch (e) {
		void e;
		return false;
	}
}

export function getEquippedItemsBestEffort(player) {
	/** @type {{ items: (ItemStack|null)[] }} */
	const result = { items: [] };
	try {
		const eq = player?.getComponent?.("minecraft:equippable");
		if (!eq || typeof eq.getEquipment !== "function") return result;

		let main = eq.getEquipment(EquipmentSlot.Mainhand) ?? null;
		if (main && isWearableArmorInMainhand(main)) main = null;

		result.items = [
			main,
			eq.getEquipment(EquipmentSlot.Offhand) ?? null,
			eq.getEquipment(EquipmentSlot.Head) ?? null,
			eq.getEquipment(EquipmentSlot.Chest) ?? null,
			eq.getEquipment(EquipmentSlot.Legs) ?? null,
			eq.getEquipment(EquipmentSlot.Feet) ?? null,
		];
	} catch (e) {
		void e;
	}
	return result;
}

export function buildEquipmentSignature(items) {
	try {
		const arr = Array.isArray(items) ? items : [];
		const parts = [];
		for (const it of arr) {
			if (!it) {
				parts.push("-");
				continue;
			}
			const typeId = String(it.typeId ?? "");
			const nameTag = String(it.nameTag ?? "");
			const lore = safeLore(it);
			parts.push(`${typeId}|${nameTag}|${lore.join("\\n")}`);
		}
		return parts.join("||");
	} catch (e) {
		void e;
		return "";
	}
}

export function getItemLoreBestEffort(item) {
	return safeLore(item);
}
