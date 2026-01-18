import { system, world, EquipmentSlot } from "@minecraft/server";

// Custom Items: durability-fix
//
// Alternativa a `minecraft:custom_components` (deprecated / hard error en parse en algunas builds).
// Mantiene las herramientas custom sin desgaste reseteando el daño de durabilidad a 0.
//
// Nota:
// - En @minecraft/server 2.4.0 NO existe `ItemDurabilityComponent.unbreakable` (aparece recién en 2.5.0-beta).
// - Por compatibilidad con engine estable, usamos `ItemDurabilityComponent.damage = 0`.

let didInit = false;

function buildToolIdRegex(namespace) {
	const ns = String(namespace || "").trim();
	if (!ns) return null;
	const escapedNs = ns.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Cubre las 56 tools actuales: tier + tipo + variante
	return new RegExp(
		`^${escapedNs}` +
			":(wooden|stone|copper|iron|golden|diamond|netherite)_(pickaxe|axe|sword|hoe)_(plain|glint)$",
		"i"
	);
}

function buildArmorIdRegex(namespace) {
	const ns = String(namespace || "").trim();
	if (!ns) return null;
	const escapedNs = ns.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	// Cubre 7 sets x 4 piezas x 2 variantes
	return new RegExp(
		`^${escapedNs}` +
			":(leather|copper|chainmail|iron|golden|diamond|netherite)_(helmet|chestplate|leggings|boots)_(plain|glint)$",
		"i"
	);
}

function tryResetDurabilityDamage(item) {
	try {
		if (!item || typeof item.getComponent !== "function") return false;
		const dur = item.getComponent("minecraft:durability");
		if (!dur) return false;
		// `damage` es settable en 2.4.0
		if (typeof dur.damage !== "number") return false;
		if (dur.damage === 0) return false;
		dur.damage = 0;
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function getEquippable(player) {
	try {
		return player.getComponent("minecraft:equippable");
	} catch {
		return undefined;
	}
}

export function initCustomToolDurabilityFix(cfg) {
	if (didInit) return;
	didInit = true;

	const namespace = cfg?.NAMESPACE ?? cfg?.namespace;
	const toolIdRe = buildToolIdRegex(namespace);
	const armorIdRe = buildArmorIdRegex(namespace);
	if (!toolIdRe && !armorIdRe) return;

	// Muy liviano: revisa mano principal/secundaria + slots de armadura.
	const every = Math.max(1, Math.trunc(cfg?.durabilityFix?.equipmentEveryTicks ?? 1));

	system.runInterval(() => {
		try {
			for (const player of world.getPlayers()) {
				const eq = getEquippable(player);
				if (!eq) continue;

				for (const slot of [
					EquipmentSlot.Mainhand,
					EquipmentSlot.Offhand,
					EquipmentSlot.Head,
					EquipmentSlot.Chest,
					EquipmentSlot.Legs,
					EquipmentSlot.Feet,
				]) {
					let item;
					try {
						item = eq.getEquipment(slot);
					} catch {
						item = undefined;
					}
					if (!item) continue;

					const typeId = String(item.typeId);
					const isTool = toolIdRe ? toolIdRe.test(typeId) : false;
					const isArmor = armorIdRe ? armorIdRe.test(typeId) : false;
					if (!isTool && !isArmor) continue;

					if (tryResetDurabilityDamage(item)) {
						try {
							eq.setEquipment(slot, item);
						} catch {
							// ignore
						}
					}
				}
			}
		} catch (e) {
			void e;
		}
	}, every);
}
