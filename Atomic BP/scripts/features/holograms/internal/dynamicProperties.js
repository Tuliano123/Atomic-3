import * as mc from "@minecraft/server";
import { world } from "@minecraft/server";

export function registerHologramEntityDynamicProperties(config) {
	const key = String(config && config.persistence && config.persistence.templateKey ? config.persistence.templateKey : "atomic:holo_template");
	const maxLen = Math.max(64, Number(config && config.persistence && config.persistence.maxTemplateLength != null ? config.persistence.maxTemplateLength : 1024));

	try {
		if (!world || !world.afterEvents || !world.afterEvents.worldInitialize || typeof world.afterEvents.worldInitialize.subscribe !== "function") return;

		world.afterEvents.worldInitialize.subscribe((ev) => {
			try {
				if (!ev || !ev.propertyRegistry) return;
				const DefCtor = mc && mc.DynamicPropertiesDefinition ? mc.DynamicPropertiesDefinition : null;
				if (!DefCtor) return;
				const def = new DefCtor();
				if (typeof def.defineString === "function") def.defineString(key, maxLen);

				// La firma exacta varía por versión; hacemos best-effort.
				const pr = ev.propertyRegistry;
				if (typeof pr.registerEntityTypeDynamicProperties === "function") {
					pr.registerEntityTypeDynamicProperties(def, "atomic:hologram");
					return;
				}
				if (typeof pr.registerEntityDynamicProperties === "function") {
					pr.registerEntityDynamicProperties(def, "atomic:hologram");
					return;
				}
			} catch (e) {
				void e;
			}
		});
	} catch (e) {
		void e;
	}
}
