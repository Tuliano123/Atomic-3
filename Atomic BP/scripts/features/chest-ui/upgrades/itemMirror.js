import { EquipmentSlot } from "@minecraft/server";

/**
 * Resuelve la textura a usar por ChestFormData para un ItemStack.
 * - Vanilla: devuelve `minecraft:...` para usar el catálogo `typeIds.js`.
 * - Custom namespaces: fallback seguro (barrier) hasta que registres icono.
 */
export function resolveChestUiTextureForItem(itemStack) {
	if (!itemStack) return "barrier";
	const typeId = String(itemStack.typeId ?? "");
	if (typeId.startsWith("minecraft:")) return typeId;

	// Strategy A (docs): interpret custom clones by their vanilla equivalent.
	// Examples: `namespace:diamond_hoe_glint` -> `minecraft:diamond_hoe`
	//           `namespace:chainmail_boots_plain` -> `minecraft:chainmail_boots`
	const shortId = typeId.includes(":") ? typeId.split(":")[1] : typeId;
	if (shortId.endsWith("_glint")) return `minecraft:${shortId.slice(0, -"_glint".length)}`;
	if (shortId.endsWith("_plain")) return `minecraft:${shortId.slice(0, -"_plain".length)}`;

	// Extensión futura: mapear aquí tus custom typeIds a `i/...` o `t/...`.
	return "barrier";
}

export function getMainhandItemStack(player) {
	try {
		const equippable = player.getComponent("equippable");
		return equippable?.getEquipment(EquipmentSlot.Mainhand) ?? null;
	} catch (e) {
		void e;
		return null;
	}
}

export function isItemEnchanted(itemStack) {
	try {
		const typeId = String(itemStack?.typeId ?? "");
		const shortId = typeId.includes(":") ? typeId.split(":")[1] : typeId;
		// Custom clone convention
		if (shortId.endsWith("_glint")) return true;

		const ench = itemStack?.getComponent("enchantable");
		if (!ench) return false;
		if (typeof ench.hasEnchantments === "boolean") return ench.hasEnchantments;
		if (typeof ench.getEnchantments === "function") return ench.getEnchantments().length > 0;
		return false;
	} catch (e) {
		void e;
		return false;
	}
}

export function getVisualDurability99(itemStack) {
	try {
		const dur = itemStack?.getComponent("durability");
		if (!dur) return 0;
		const max = Number(dur.maxDurability);
		const damage = Number(dur.damage);
		if (!Number.isFinite(max) || max <= 0) return 0;
		if (!Number.isFinite(damage) || damage < 0) return 0;
		const pct = 1 - Math.min(1, damage / max);
		return Math.max(0, Math.min(99, Math.floor(pct * 99)));
	} catch (e) {
		void e;
		return 0;
	}
}

export function toTitleFromTypeId(typeId) {
	const raw = String(typeId ?? "").replace(/^minecraft:/, "");
	if (!raw) return "Item";
	return raw
		.split("_")
		.map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
		.join(" ");
}
