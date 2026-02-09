import { enchantsSelectionMenu } from "./enchants/enchantsSelectionMenu.js";

// Punto de entrada existente desde upgradesPrimaryMenu.
// Delega al menú de selección, manteniendo el flujo descrito en ENCHANTMENTS.md.
export function enchantsMenu(player, { categoryMode = "all", onBack } = {}) {
	return enchantsSelectionMenu(player, { categoryMode, page: 0, onBack });
}
