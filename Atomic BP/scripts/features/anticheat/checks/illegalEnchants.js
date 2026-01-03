import { EquipmentSlot, PlayerPermissionLevel, system, world } from "@minecraft/server";

let didStart = false;

function isOperator(player) {
	try {
		return Number(player && player.playerPermissionLevel != null ? player.playerPermissionLevel : 0) >= PlayerPermissionLevel.Operator;
	} catch (e) {
		void e;
		return false;
	}
}

function getInventoryContainer(player) {
	try {
		const comp = player.getComponent("inventory");
		return comp && comp.container ? comp.container : undefined;
	} catch (e) {
		void e;
		return undefined;
	}
}

function getEquippable(player) {
	try {
		return player.getComponent("minecraft:equippable");
	} catch (e) {
		void e;
		return undefined;
	}
}

function getEnchantments(item) {
	if (!item) return null;
	try {
		const ench = item.getComponent("minecraft:enchantable");
		if (!ench) return null;
		// Component shape varies slightly across versions; best-effort access.
		if (ench.enchantments) return ench.enchantments;
		if (typeof ench.getEnchantments === "function") return ench.getEnchantments();
	} catch (e) {
		void e;
	}
	return null;
}

// Vanilla max levels (global) for common enchants.
// This intentionally does NOT attempt per-item compatibility (too many edge cases).
const ENCHANT_MAX_LEVEL = {
	"minecraft:protection": 4,
	"minecraft:fire_protection": 4,
	"minecraft:feather_falling": 4,
	"minecraft:blast_protection": 4,
	"minecraft:projectile_protection": 4,
	"minecraft:thorns": 3,
	"minecraft:respiration": 3,
	"minecraft:aqua_affinity": 1,
	"minecraft:depth_strider": 3,
	"minecraft:frost_walker": 2,
	"minecraft:soul_speed": 3,
	"minecraft:swift_sneak": 3,

	"minecraft:sharpness": 5,
	"minecraft:smite": 5,
	"minecraft:bane_of_arthropods": 5,
	"minecraft:knockback": 2,
	"minecraft:fire_aspect": 2,
	"minecraft:looting": 3,

	"minecraft:power": 5,
	"minecraft:punch": 2,
	"minecraft:flame": 1,
	"minecraft:infinity": 1,

	"minecraft:efficiency": 5,
	"minecraft:silk_touch": 1,
	"minecraft:unbreaking": 3,
	"minecraft:fortune": 3,

	"minecraft:mending": 1,

	"minecraft:binding": 1,
	"minecraft:vanishing": 1,
};

function getMaxLevelForEnchant(typeId) {
	if (!typeId) return null;
	const key = String(typeId);
	if (Object.prototype.hasOwnProperty.call(ENCHANT_MAX_LEVEL, key)) return ENCHANT_MAX_LEVEL[key];
	return null;
}

function safeGetEnchantTypeId(enchantment) {
	try {
		// API variants:
		// - enchantment.type.id
		// - enchantment.typeId
		// - enchantment.id
		if (enchantment && enchantment.type && enchantment.type.id != null) return String(enchantment.type.id);
		if (enchantment && enchantment.typeId != null) return String(enchantment.typeId);
		if (enchantment && enchantment.id != null) return String(enchantment.id);
	} catch (e) {
		void e;
	}
	return "";
}

function safeGetEnchantLevel(enchantment) {
	try {
		if (enchantment && enchantment.level != null) return Number(enchantment.level);
		if (enchantment && enchantment.value != null) return Number(enchantment.value);
	} catch (e) {
		void e;
	}
	return NaN;
}

function shouldFlagEnchant(typeId, level) {
	if (!typeId) return false;
	if (!Number.isFinite(level)) return false;
	if (level <= 0) return true;

	const max = getMaxLevelForEnchant(typeId);
	if (max == null) {
		// Unknown enchant: don't flag (avoid false positives on future/experimental enchants).
		return false;
	}
	return level > max;
}

function flag(ctx, player, reason, details, severity) {
	try {
		if (ctx && ctx.enforce && typeof ctx.enforce.flag === "function") {
			ctx.enforce.flag(player, reason, {
				checkId: "illegal_enchants",
				severity: severity,
				tpsSensitive: false,
				details: details,
			});
		}
	} catch (e) {
		void e;
	}
}

function scanItem(ctx, player, item, source) {
	const ench = getEnchantments(item);
	if (!ench) return;

	let list;
	try {
		// ItemEnchantments typically provides iterator via for..of.
		list = ench;
	} catch (e) {
		void e;
		return;
	}

	try {
		for (const e of list) {
			const typeId = safeGetEnchantTypeId(e);
			const level = safeGetEnchantLevel(e);
			if (!shouldFlagEnchant(typeId, level)) continue;

			flag(ctx, player, "illegal_enchant", {
				source: source,
				itemTypeId: item && item.typeId != null ? item.typeId : "",
				enchant: typeId,
				level: Number(level),
				max: getMaxLevelForEnchant(typeId),
			}, 2);

			try {
				if (ctx && ctx.logger && typeof ctx.logger.warn === "function") {
					ctx.logger.warn({
						checkId: "illegal_enchants",
						player: player,
						message: "Illegal enchant detected",
						data: {
							source: source,
							itemTypeId: item && item.typeId != null ? item.typeId : "",
							enchant: typeId,
							level: Number(level),
							max: getMaxLevelForEnchant(typeId),
						},
					});
				}
			} catch (e2) {
				void e2;
			}

			// Mitigation best-effort: remove the item if possible (prevents ongoing abuse)
			// Only do this for obvious illegal level (level > max) or invalid (<=0).
			// The calling site decides how to remove; here we just report.
		}
	} catch (e3) {
		void e3;
	}
}

function scanPlayer(ctx, player, cfg) {
	if (!player) return;
	if (isOperator(player)) return;

	const enabled = cfg && cfg.enabled === false ? false : true;
	if (!enabled) return;

	const container = getInventoryContainer(player);
	if (container) {
		for (let i = 0; i < container.size; i++) {
			const item = container.getItem(i);
			if (!item) continue;
			scanItem(ctx, player, item, "inventory:" + i);
		}
	}

	const eq = getEquippable(player);
	if (eq) {
		const slots = [
			EquipmentSlot.Mainhand,
			EquipmentSlot.Offhand,
			EquipmentSlot.Head,
			EquipmentSlot.Chest,
			EquipmentSlot.Legs,
			EquipmentSlot.Feet,
		];
		for (const s of slots) {
			let item;
			try {
				item = eq.getEquipment(s);
			} catch (e) {
				void e;
				item = undefined;
			}
			if (!item) continue;
			scanItem(ctx, player, item, "equipment:" + String(s));
		}
	}
}

export const illegalEnchantsCheck = {
	id: "illegal_enchants",
	section: 3,
	name: "Illegal enchant levels",

	start(ctx) {
		if (didStart) return;
		didStart = true;

		const cfg = ctx && ctx.config && ctx.config.illegalEnchants ? ctx.config.illegalEnchants : {};
		const intervalTicks = Math.max(20, Math.floor(Number(cfg.intervalTicks != null ? cfg.intervalTicks : 60)));

		system.runInterval(() => {
			try {
				// Respect global anticheat feature flag if available.
				try {
					if (ctx && ctx.featureFlags && typeof ctx.featureFlags.isAntiCheatEnabled === "function") {
						if (!ctx.featureFlags.isAntiCheatEnabled()) return;
					}
				} catch (e0) {
					void e0;
				}

				const players = world.getPlayers();
				for (const p of players) scanPlayer(ctx, p, cfg);
			} catch (e) {
				void e;
			}
		}, intervalTicks);
	},
};
