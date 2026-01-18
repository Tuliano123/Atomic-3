import { EquipmentSlot } from "@minecraft/server";

function isArmorItemInHandBestEffort(item) {
	if (!item) return false;
	try {
		// Preferido: detectar por componente wearable (soporta items custom con wearable).
		const wc = item.getComponent?.("minecraft:wearable");
		const slot = String(wc?.slot ?? "");
		if (slot.includes("slot.armor.head") || slot.includes("slot.armor.chest") || slot.includes("slot.armor.legs") || slot.includes("slot.armor.feet")) {
			return true;
		}
	} catch (e) {
		void e;
	}

	// Fallback: heurística por typeId (vanilla y custom suelen incluir estos sufijos).
	try {
		const id = String(item.typeId ?? "");
		return /(_helmet|_chestplate|_leggings|_boots)$/.test(id);
	} catch (e) {
		void e;
		return false;
	}
}

function safeLoreLines(item) {
	if (!item) return [];
	try {
		const v = typeof item.getLore === "function" ? item.getLore() : null;
		return Array.isArray(v) ? v : [];
	} catch (e) {
		void e;
		return [];
	}
}

function safeItemSignature(item) {
	if (!item) return "empty";
	const typeId = String(item.typeId != null ? item.typeId : "");
	const nameTag = String(item.nameTag != null ? item.nameTag : "");
	const lore = safeLoreLines(item);
	return `${typeId}|${nameTag}|${lore.join("\\n")}`;
}

export function getEquippableBestEffort(player) {
	try {
		return player?.getComponent?.("minecraft:equippable") ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

export function getEquipmentItemBestEffort(player, slot) {
	try {
		const eq = getEquippableBestEffort(player);
		if (eq && typeof eq.getEquipment === "function") return eq.getEquipment(slot);
	} catch (e) {
		void e;
	}
	return undefined;
}

export function getEquippedItemsBestEffort(player) {
	let mainhand = getEquipmentItemBestEffort(player, EquipmentSlot.Mainhand);
	// Corrección: ignorar armaduras en mano para el cálculo de daño/stats de mainhand.
	// (Evita que se pueda pegar usando un casco/peto/pantalones/botas con lore.)
	if (isArmorItemInHandBestEffort(mainhand)) mainhand = undefined;
	const offhand = getEquipmentItemBestEffort(player, EquipmentSlot.Offhand);
	const head = getEquipmentItemBestEffort(player, EquipmentSlot.Head);
	const chest = getEquipmentItemBestEffort(player, EquipmentSlot.Chest);
	const legs = getEquipmentItemBestEffort(player, EquipmentSlot.Legs);
	const feet = getEquipmentItemBestEffort(player, EquipmentSlot.Feet);

	return {
		mainhand,
		offhand,
		head,
		chest,
		legs,
		feet,
		items: [mainhand, offhand, head, chest, legs, feet].filter(Boolean),
	};
}

export function getLoreLinesBestEffort(item) {
	return safeLoreLines(item);
}

export function buildEquipmentSignature(equip) {
	if (!equip) return "";
	return [
		safeItemSignature(equip.mainhand),
		safeItemSignature(equip.offhand),
		safeItemSignature(equip.head),
		safeItemSignature(equip.chest),
		safeItemSignature(equip.legs),
		safeItemSignature(equip.feet),
	].join("||");
}
