// Registro centralizado de checks AntiCheat.
// Nota: varios checks inestables se removieron temporalmente (fly/killaura/reach/teleportY/autoclicker/aimassist)
// para evitar crashes o falsos positivos. Se re-implementarán más adelante.

import { illegalItemsCheck } from "./illegalItems.js";
import { illegalBlocksCheck } from "./illegalBlocks.js";
import { illegalEnchantsCheck } from "./illegalEnchants.js";
import { entityFloodCheck } from "./entityFlood.js";
import { noClipCheck } from "./noClip.js";
import { abnormalStacksCheck } from "./abnormalStacks.js";
import { tpsMonitorCheck } from "./tpsMonitor.js";
import { adminAllowlistCheck } from "./adminAllowlist.js";

/**
 * @param {{ register: (check:any) => void }} registry
 */
export function registerAntiCheatChecks(registry) {
	registry.register(illegalItemsCheck);
	registry.register(illegalBlocksCheck);
	registry.register(illegalEnchantsCheck);
	registry.register(entityFloodCheck);
	registry.register(noClipCheck);
	registry.register(abnormalStacksCheck);
	registry.register(tpsMonitorCheck);
	registry.register(adminAllowlistCheck);
}
