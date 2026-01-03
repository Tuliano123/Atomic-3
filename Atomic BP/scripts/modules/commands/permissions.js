import { PlayerPermissionLevel } from "@minecraft/server";

const NO_PERMISSION_MESSAGE = "§cNo tienes permisos suficientes para usar este comando.";

/**
 * Retorna true si el jugador es operador (o superior).
 *
 * @param {import("@minecraft/server").Player} player
 */
export function isOperatorOrHigher(player) {
	try {
		return Number(player && player.playerPermissionLevel != null ? player.playerPermissionLevel : 0) >= PlayerPermissionLevel.Operator;
	} catch (e) {
		void e;
		return false;
	}
}

/**
 * Envía el mensaje estándar de falta de permisos.
 *
 * @param {import("@minecraft/server").Player} player
 */
export function sendNoPermissionMessage(player) {
	try {
		player.sendMessage(NO_PERMISSION_MESSAGE);
	} catch (e) {
		void e;
		// noop
	}
}
