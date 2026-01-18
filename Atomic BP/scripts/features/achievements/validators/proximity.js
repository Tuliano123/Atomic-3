import { world } from "@minecraft/server";

function distance(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getTargets(selector) {
	const type = selector?.type ?? "player";
	if (type !== "player") return [];
	const requiredTag = selector?.requiredTag;
	const list = world.getPlayers();
	if (!requiredTag) return list;
	return list.filter((p) => {
		try {
			return p?.hasTag?.(requiredTag) === true;
		} catch (e) {
			void e;
			return false;
		}
	});
}

export function validateProximityCondition(player, condition) {
	const maxDistance = Number(condition?.maxDistance ?? 0);
	if (!Number.isFinite(maxDistance) || maxDistance <= 0) return false;
	const loc = player?.location;
	if (!loc) return false;

	const targets = getTargets(condition?.targetSelector);
	for (const target of targets) {
		if (!target || target.id === player.id) continue;
		const tloc = target.location;
		if (!tloc) continue;
		if (distance(loc, tloc) <= maxDistance) return true;
	}
	return false;
}
