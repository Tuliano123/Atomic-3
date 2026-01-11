import { EquipmentSlot, system } from "@minecraft/server";

const INVALID_STRING_MESSAGE = "§cString inválido";
const SUCCESS_APPLIED_MESSAGE = "§fNombre aplicado correctamente";
const SUCCESS_OVERWROTE_MESSAGE = "§fNombre sobreescrito correctamente";

/**
 * Extrae texto desde argumentos de Custom Commands (Bedrock-safe)
 */
function extractStringValue(input) {
	if (typeof input === "string") return input;

	if (Array.isArray(input)) {
		let out = "";
		for (const part of input) {
			const v = extractStringValue(part);
			if (typeof v === "string") out += v;
		}
		return out || null;
	}

	if (input && typeof input === "object") {
		if (Array.isArray(input.rawtext)) return extractStringValue(input.rawtext);
		if (typeof input.text === "string") return input.text;
		if (typeof input.value === "string") return input.value;
	}

	return null;
}

/**
 * /rename <string>
 */
export function handleRenameCommand(origin, nameText) {
	const player = origin.sourceEntity;
	if (!player) return;

	const itemName = `§r${extractStringValue(nameText)}`;
	if (!itemName) {
		player.sendMessage(INVALID_STRING_MESSAGE);
		return;
	}

	system.run(() => {
		const equippable = player.getComponent("minecraft:equippable");
		if (!equippable) return player.sendMessage(INVALID_STRING_MESSAGE);

		const item = equippable.getEquipment(EquipmentSlot.Mainhand);
		if (!item) return player.sendMessage(INVALID_STRING_MESSAGE);

		const hadNameBefore = !!item.nameTag;

		const updatedItem = item.clone();
		updatedItem.nameTag = itemName;

		if (!equippable.setEquipment(EquipmentSlot.Mainhand, updatedItem)) {
			player.sendMessage(INVALID_STRING_MESSAGE);
			return;
		}

		player.sendMessage(
			hadNameBefore
				? SUCCESS_OVERWROTE_MESSAGE
				: SUCCESS_APPLIED_MESSAGE
		);
	});
}
