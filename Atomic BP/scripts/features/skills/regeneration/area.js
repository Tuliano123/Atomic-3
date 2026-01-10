// Utilidades de áreas (AABB)
// Responsabilidad: validar si una posición cae dentro de un área o lista de áreas.

/**
 * @param {{x:number,y:number,z:number}} pos
 */
function normalizePos(pos) {
	return {
		x: Number(pos && pos.x != null ? pos.x : 0),
		y: Number(pos && pos.y != null ? pos.y : 0),
		z: Number(pos && pos.z != null ? pos.z : 0),
	};
}

/**
 * Chequeo inclusivo: min <= pos <= max
 * @param {string} dimensionId
 * @param {{x:number,y:number,z:number}} pos
 * @param {{dimensionId:string, min:{x:number,y:number,z:number}, max:{x:number,y:number,z:number}}} area
 */
export function isInArea(dimensionId, pos, area) {
	if (!area || typeof area !== "object") return false;
	if (!area.dimensionId || String(area.dimensionId) !== String(dimensionId)) return false;

	const p = normalizePos(pos);
	const min = normalizePos(area.min);
	const max = normalizePos(area.max);

	const minX = Math.min(min.x, max.x);
	const maxX = Math.max(min.x, max.x);
	const minY = Math.min(min.y, max.y);
	const maxY = Math.max(min.y, max.y);
	const minZ = Math.min(min.z, max.z);
	const maxZ = Math.max(min.z, max.z);

	return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY && p.z >= minZ && p.z <= maxZ;
}

/**
 * @param {string} dimensionId
 * @param {{x:number,y:number,z:number}} pos
 * @param {Array<any>} areas
 */
export function isInAnyArea(dimensionId, pos, areas) {
	if (!Array.isArray(areas) || areas.length === 0) return false;
	for (const area of areas) {
		if (isInArea(dimensionId, pos, area)) return true;
	}
	return false;
}
