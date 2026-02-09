function randRange(lo, hi) {
	if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
	if (hi <= lo) return lo;
	return lo + Math.random() * (hi - lo);
}

export function spawnEffectParticles(config, player, particleId, extraYOffset = 0) {
	try {
		if (!player || !player.isValid) return;
		const dim = player.dimension;
		const base = player.location;
		if (!dim || !base) return;
		if (typeof particleId !== "string" || particleId.length === 0) return;

		const p = config?.particles ?? {};
		const baseYOffset = Number(p.baseYOffset ?? 0);
		const extra = Number(extraYOffset);
		const baseY =
			base.y +
			(Number.isFinite(baseYOffset) ? baseYOffset : 0) +
			(Number.isFinite(extra) ? extra : 0);
		const xMax = Math.max(0, Number(p.dxAbsMax ?? 0.9));
		const zMax = Math.max(0, Number(p.dzAbsMax ?? 0.9));
		const yMin = Number(p.dyMin ?? -1.7);
		const yMax = Number(p.dyMax ?? -0.5);
		const yLo = Math.min(yMin, yMax);
		const yHi = Math.max(yMin, yMax);

		const countMin = Math.max(0, Math.trunc(Number(p.countMin ?? 1)));
		const countMax = Math.max(countMin, Math.trunc(Number(p.countMax ?? 3)));
		const count = countMin + Math.floor(Math.random() * (countMax - countMin + 1));

		for (let i = 0; i < count; i++) {
			const dx = randRange(-xMax, xMax);
			const dz = randRange(-zMax, zMax);
			const dy = randRange(yLo, yHi);
			try {
				dim.spawnParticle(particleId, { x: base.x + dx, y: baseY + dy, z: base.z + dz });
			} catch (e) {
				void e;
				// best-effort: si el id no existe o falla, no rompemos el loop
			}
		}
	} catch (e) {
		void e;
	}
}
