import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

/**
 * Muestra un modal con un input numérico (int) y botón "Aceptar".
 * Devuelve:
 * - number (int) si el usuario confirmó y el input es válido
 * - null si canceló o el input es inválido
 *
 * @param {import("@minecraft/server").Player} player
 * @param {{
 *  title?: string,
 *  label?: string,
 *  placeholder?: string,
 *  acceptText?: string,
 *  min?: number,
 *  max?: number,
 *  allowCommas?: boolean,
 *  errorMessage?: string
 * }} options
 */
export async function showIntPrompt(player, options = undefined) {
	const title = String(options?.title ?? "§6Banco");
	const label = String(options?.label ?? "§7Ingresa una cantidad");
	const placeholder = String(options?.placeholder ?? "Ej: 1000");
	const acceptText = String(options?.acceptText ?? "Aceptar");
	const allowCommas = options?.allowCommas !== false;
	const errorMessage = String(options?.errorMessage ?? "§cIngresa un número entero válido.");

	let min = Math.trunc(Number(options?.min ?? 1));
	let max = Math.trunc(Number(options?.max ?? 2147483647));
	if (!Number.isFinite(min)) min = 1;
	if (!Number.isFinite(max)) max = 2147483647;
	if (max < min) {
		const tmp = max;
		max = min;
		min = tmp;
	}

	try {
		// Importante: si se intenta abrir un ModalFormData inmediatamente después
		// de cerrar/seleccionar un ActionForm (ChestFormData), Bedrock a veces lo
		// cancela o ni lo muestra. Esperamos 1 tick real.
		await system.waitTicks(1);

		const form = new ModalFormData();
		form.title(title);

		// Compat: en algunas versiones el 3er parámetro es un objeto options,
		// en otras se aceptaba un string como default. Probamos options primero.
		try {
			form.textField(label, placeholder, { defaultValue: "" });
		} catch (eTextField) {
			void eTextField;
			// Fallback mínimo (2 args) para máxima compatibilidad.
			form.textField(label, placeholder);
		}

		// Compat: submitButton puede no existir/variar por versión.
		try {
			form.submitButton(acceptText);
		} catch (eSubmit) {
			void eSubmit;
		}

		const response = await form.show(player);
		if (response.canceled) return null;

		const raw0 = Array.isArray(response.formValues) ? response.formValues[0] : "";
		let s = String(raw0 ?? "").trim();
		if (allowCommas) s = s.replace(/,/g, "");

		// Solo enteros positivos (sin + - . espacios)
		if (!/^\d+$/.test(s)) {
			try { player.sendMessage(errorMessage); } catch (e) { void e; }
			return null;
		}

		const value = Math.trunc(Number(s));
		if (!Number.isFinite(value)) {
			try { player.sendMessage(errorMessage); } catch (e) { void e; }
			return null;
		}
		if (value < min || value > max) {
			try { player.sendMessage(errorMessage); } catch (e) { void e; }
			return null;
		}

		return value;
	} catch (e) {
		try {
			const msg = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
			console.warn(`[showIntPrompt] Failed to show modal: ${msg}`);
		} catch (eLog) {
			void eLog;
		}
		try {
			player.sendMessage("§cNo se pudo abrir el formulario. Intente de nuevo.");
		} catch (e2) {
			void e2;
		}
		return null;
	}
}
