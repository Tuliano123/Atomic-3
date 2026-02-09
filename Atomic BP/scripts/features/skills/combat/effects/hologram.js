import { applyCustomEmojisToText } from "../../../custom-emojis/index.js";
import { spawnDamageHologram } from "../damage_title/hologramFactory.js";

const SECTION = String.fromCharCode(167); // '§'

function normalizeSectionSigns(text) {
	let out = String(text);
	out = out.split("Â" + SECTION).join(SECTION);
	out = out.split("Â§").join(SECTION);
	out = out.split("§").join(SECTION);
	return out;
}

function forceResetIfColored(text) {
	const s = String(text);
	if (s.includes(SECTION)) return SECTION + "r" + s + SECTION + "r";
	return s;
}

export function formatThousands(value, sep = ",") {
	const n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) return "0";
	const s = String(Math.abs(n));
	if (s.length <= 3) return n < 0 ? "-" + s : s;
	let out = "";
	let group = 0;
	for (let i = s.length - 1; i >= 0; i--) {
		out = s[i] + out;
		group++;
		if (group === 3 && i !== 0) {
			out = String(sep) + out;
			group = 0;
		}
	}
	return n < 0 ? "-" + out : out;
}

function randRange(lo, hi) {
	if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
	if (hi <= lo) return lo;
	return lo + Math.random() * (hi - lo);
}

export function computeEffectHologramLocation(config, target) {
	try {
		const base = target?.location;
		if (!base) return null;

		const o = config?.hologram?.offset ?? {};
		const xMax = Math.max(0, Number(o.dxAbsMax ?? 0.4));
		const zMax = Math.max(0, Number(o.dzAbsMax ?? 0.4));
		const yMin = Number(o.dyMin ?? -1.7);
		const yMax = Number(o.dyMax ?? -0.5);
		const yLo = Math.min(yMin, yMax);
		const yHi = Math.max(yMin, yMax);
		const jitter = Math.max(0, Number(o.jitter ?? 0.04));

		const signedAbs = (abs) => (Math.random() < 0.5 ? -1 : 1) * abs;
		const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

		const absX = randRange(0, xMax);
		const absZ = randRange(0, zMax);
		const dy = randRange(yLo, yHi);

		const jx = jitter > 0 ? randRange(-jitter, jitter) : 0;
		const jz = jitter > 0 ? randRange(-jitter, jitter) : 0;
		const jy = jitter > 0 ? randRange(-jitter, jitter) : 0;

		const dx = clamp(signedAbs(absX) + jx, -xMax, xMax);
		const dz = clamp(signedAbs(absZ) + jz, -zMax, zMax);
		const dyJ = clamp(dy + jy, yLo, yHi);
		return { x: base.x + dx, y: base.y + dyJ, z: base.z + dz };
	} catch (e) {
		void e;
		return null;
	}
}

export function spawnEffectDamageHologram(config, target, damageInt, templateText) {
	try {
		if (!target || !target.isValid) return null;
		const dim = target.dimension;
		if (!dim) return null;

		const dmg = Math.trunc(Number(damageInt));
		if (!Number.isFinite(dmg) || dmg <= 0) return null;

		const sep = ",";
		const dmgFmt = formatThousands(dmg, sep);

		let text = typeof templateText === "string" ? templateText : "<Daño>";
		text = text.split("<Daño>").join(String(dmgFmt));
		text = text.split("<Dano>").join(String(dmgFmt));
		text = text.split("<DañoReal>").join(String(dmgFmt));
		text = text.split("<DanoReal>").join(String(dmgFmt));

		text = normalizeSectionSigns(text);
		text = forceResetIfColored(text);
		text = applyCustomEmojisToText(text);

		const loc = computeEffectHologramLocation(config, target);
		if (!loc) return null;

		const durationMs = Number(config?.hologram?.durationMs ?? 1200);
		return spawnDamageHologram({ dimension: dim, location: loc, text, durationMs });
	} catch (e) {
		void e;
		return null;
	}
}
