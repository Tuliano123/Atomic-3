// Partículas (helpers)
// Responsabilidad: spawnear patrones de partículas desde un punto (x,y,z).

/**
 * Spawnea una partícula de manera segura (best-effort).
 * @param {any} dimension
 * @param {string} particleId
 * @param {{x:number,y:number,z:number}} location
 */
export function spawnParticleSafe(dimension, particleId, location) {
	try {
		if (!dimension || typeof dimension.spawnParticle !== "function") return false;
		dimension.spawnParticle(String(particleId), location);
		return true;
	} catch (e) {
		void e;
		return false;
	}
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

/**
 * Genera una estrella horizontal (acostada) en el plano XZ.
 * - Tamaño menor a un bloque
 * - Partícula: minecraft:endrod
 * - Y se mantiene constante (no hay altura en el patrón)
 *
 * @param {any} dimension
 * @param {{x:number,y:number,z:number}} origin Punto central (recomendado: centro del bloque)
 * @param {{ size?: number, pointsPerEdge?: number, particleId?: string }} [opts]
 */
export function spawnEndrodStarHorizontal(dimension, origin, opts) {
	const particleId = String(opts && opts.particleId ? opts.particleId : "minecraft:endrod");
	const size = clamp(Number(opts && opts.size != null ? opts.size : 0.35) || 0.35, 0.05, 0.49);
	const pointsPerEdge = clamp(Math.floor(Number(opts && opts.pointsPerEdge != null ? opts.pointsPerEdge : 10) || 10), 2, 80);
	// Contorno punteado: cada cuántos puntos se spawnea una partícula.
	// Ej: 4 => 0,4,8,12,... (menos partículas)
	const pointStep = clamp(Math.floor(Number(opts && opts.pointStep != null ? opts.pointStep : 4) || 4), 1, 40);

	// 5 puntas: 10 vértices alternando radio externo/interno
	const outerR = size;
	const innerR = size * 0.5;
	const vertices = [];
	for (let i = 0; i < 10; i++) {
		const isOuter = i % 2 === 0;
		const r = isOuter ? outerR : innerR;
		// Rotación para que una punta mire hacia +X
		const angle = (Math.PI * 2 * i) / 10;
		vertices.push({
			x: origin.x + Math.cos(angle) * r,
			y: origin.y,
			z: origin.z + Math.sin(angle) * r,
		});
	}

	// Dibujar segmentos entre vértices consecutivos
	for (let i = 0; i < vertices.length; i++) {
		const a = vertices[i];
		const b = vertices[(i + 1) % vertices.length];
		for (let p = 0; p <= pointsPerEdge; p += pointStep) {
			const t = p / pointsPerEdge;
			spawnParticleSafe(dimension, particleId, {
				x: lerp(a.x, b.x, t),
				y: origin.y,
				z: lerp(a.z, b.z, t),
			});
		}
		// Asegurar que el final del segmento quede marcado
		if (pointsPerEdge % pointStep !== 0) {
			spawnParticleSafe(dimension, particleId, { x: b.x, y: origin.y, z: b.z });
		}
	}
}
