import { showIntPrompt } from "./numberPrompt.js";

/**
 * Wrapper del banco (solo textos). No toca scoreboards.
 * @param {import("@minecraft/server").Player} player
 * @param {"deposit"|"withdraw"} mode
 * @param {{
 *  title?: string,
 *  label?: string,
 *  placeholder?: string,
 *  acceptText?: string,
 *  min?: number,
 *  max?: number,
 *  allowCommas?: boolean,
 *  errorMessage?: string
 * }=} overrides
 */
export async function showBankCustomAmountModal(player, mode, overrides = undefined) {
	const m = String(mode);
	if (m === "withdraw") {
		return showIntPrompt(player, {
			title: overrides?.title ?? "§6Banco",
			label: overrides?.label ?? "§7Cantidad a retirar",
			placeholder: overrides?.placeholder ?? "§7Ej: 100",
			acceptText: overrides?.acceptText ?? "Aceptar",
			min: overrides?.min ?? 1,
			max: overrides?.max ?? 2147483647,
			allowCommas: overrides?.allowCommas ?? true,
			errorMessage: overrides?.errorMessage ?? "§cIngresa un número entero válido.",
		});
	}

	// default: deposit
	return showIntPrompt(player, {
		title: overrides?.title ?? "§6Banco",
		label: overrides?.label ?? "§7Cantidad a depositar",
		placeholder: overrides?.placeholder ?? "§7Ej: 5000",
		acceptText: overrides?.acceptText ?? "Aceptar",
		min: overrides?.min ?? 1,
		max: overrides?.max ?? 2147483647,
		allowCommas: overrides?.allowCommas ?? true,
		errorMessage: overrides?.errorMessage ?? "§cIngresa un número entero válido.",
	});
}
