function compare(op, left, right) {
	switch (op) {
		case ">=":
			return left >= right;
		case ">":
			return left > right;
		case "<=":
			return left <= right;
		case "<":
			return left < right;
		case "==":
			return left === right;
		case "!=" :
			return left !== right;
		default:
			return false;
	}
}

export function validatePositionCondition(player, condition) {
	const axis = String(condition?.axis ?? "y").toLowerCase();
	const op = String(condition?.operator ?? ">=");
	const value = Number(condition?.value ?? 0);

	const loc = player?.location;
	if (!loc || !Number.isFinite(value)) return false;
	const axisValue = axis === "x" ? loc.x : axis === "z" ? loc.z : loc.y;
	return compare(op, axisValue, value);
}
