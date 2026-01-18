// AntiCheat feature entry (solo arquitectura)

import { anticheatConfig } from "./anticheat.config.js";
import { AntiCheatRegistry } from "./core/registry.js";
import { createAntiCheatContext } from "./core/context.js";
import { registerAntiCheatChecks } from "./checks/index.js";
import { initAntiCheatScriptEvents } from "./core/scriptEvents.js";
import { initFeatureFlagsDynamicProperties } from "./core/featureFlags.js";

let didInit = false;

export function initAntiCheat(customConfig) {
	if (didInit) return;
	didInit = true;

	const config = customConfig != null ? customConfig : anticheatConfig;
	if (!config || !config.enabled) return;

	// Habilita persistencia por Dynamic Properties (especialmente importante en Realms con cheats OFF).
	initFeatureFlagsDynamicProperties();

	const ctx = createAntiCheatContext({ config });
	// Inicializa TODOS los scoreboards en un solo lugar (post-worldLoad).
	initAntiCheatScriptEvents({ config: config, logger: ctx && ctx.logger ? ctx.logger : undefined });
	const registry = new AntiCheatRegistry();
	registerAntiCheatChecks(registry);
	registry.startAll(ctx);
}
