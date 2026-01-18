function normalize(from, to) {
	const min = {
		x: Math.min(from.x, to.x),
		y: Math.min(from.y, to.y),
		z: Math.min(from.z, to.z),
	};
	const max = {
		x: Math.max(from.x, to.x),
		y: Math.max(from.y, to.y),
		z: Math.max(from.z, to.z),
	};
	return { min, max };
}

export function validateAreaCondition(player, condition) {
	const from = condition?.from;
	const to = condition?.to;
	if (!from || !to) return false;
	if (!Number.isFinite(from.x) || !Number.isFinite(from.y) || !Number.isFinite(from.z)) return false;
	if (!Number.isFinite(to.x) || !Number.isFinite(to.y) || !Number.isFinite(to.z)) return false;

	const loc = player?.location;
	if (!loc) return false;

	const box = normalize(from, to);
	return (
		loc.x >= box.min.x && loc.x <= box.max.x &&
		loc.y >= box.min.y && loc.y <= box.max.y &&
		loc.z >= box.min.z && loc.z <= box.max.z
	);
}
