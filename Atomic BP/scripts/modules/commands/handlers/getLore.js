import { EquipmentSlot, system } from "@minecraft/server";

function stringifyLoreForCopy(loreLines) {
	if (!Array.isArray(loreLines) || loreLines.length === 0) return "";
	// Para copiar fácil: mantener § y representar saltos como \n
	return loreLines.join("\\n");
}

/**
 * Handler del comando getlore.
 * Emite el lore del item en mainhand a la consola en formato copiable.
 *
 * @param {import("@minecraft/server").CustomCommandOrigin} origin
 */
export function handleGetLoreCommand(origin) {
	const player = origin.sourceEntity;
	if (!player) return;

	// Lectura únicamente, pero mantenemos system.run por consistencia con entornos donde
	// el callback de custom commands puede variar el modo de ejecución.
	system.run(() => {
		const equippable = player.getComponent("minecraft:equippable");
		if (!equippable) {
			console.warn(`[getlore] No equippable component for ${player.name}`);
			return;
		}

		let currentItem;
		try {
			currentItem = equippable.getEquipment(EquipmentSlot.Mainhand);
		} catch (e) {
			console.warn(`[getlore] getEquipment(Mainhand) threw for ${player.name}: ${String(e)}`);
			return;
		}

		if (!currentItem) {
			console.warn(`[getlore] ${player.name} has no item in mainhand.`);
			return;
		}

		let loreLines = [];
		try {
			const maybeLore = currentItem && typeof currentItem.getLore === "function" ? currentItem.getLore() : null;
			loreLines = Array.isArray(maybeLore) ? maybeLore : [];
		} catch (e) {
			console.warn(`[getlore] getLore() threw for ${player.name}: ${String(e)}`);
			return;
		}

		const loreForCopy = stringifyLoreForCopy(loreLines);
		console.warn(`[getlore] player=${player.name} item=${currentItem.typeId} lore="${loreForCopy}"`);
	});
}
