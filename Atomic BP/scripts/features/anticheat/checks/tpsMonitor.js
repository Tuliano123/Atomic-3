import { system } from "@minecraft/server";

let didStart = false;

function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}

function nowMs() {
	return Date.now();
}

function getTick() {
	try {
		return Number(system.currentTick != null ? system.currentTick : 0);
	} catch (e) {
		void e;
		return 0;
	}
}

function computeMultiplier(tps, cfg) {
	const rules = Array.isArray(cfg && cfg.severityScalingRules)
		? cfg.severityScalingRules
		: [
			{ minTps: 18, multiplier: 1 },
			{ minTps: 14, multiplier: 0.75 },
			{ minTps: 10, multiplier: 0.5 },
			{ minTps: 0, multiplier: 0.25 },
		];

	const sorted = rules
		.map((r) => {
			const minTps = Number(r && r.minTps != null ? r.minTps : 0);
			const multiplier = Number(r && r.multiplier != null ? r.multiplier : 1);
			return { minTps: minTps, multiplier: multiplier };
		})
		.filter((r) => Number.isFinite(r.minTps) && Number.isFinite(r.multiplier))
		.sort((a, b) => b.minTps - a.minTps);

	for (const r of sorted) {
		if (tps >= r.minTps) return clamp(r.multiplier, 0, 1);
	}
	return 1;
}

export const tpsMonitorCheck = {
	id: "tps",
	section: 14,
	name: "Server TPS monitor",

	start(ctx) {
		if (didStart) return;
		didStart = true;

		const cfg = ctx && ctx.config && ctx.config.tps ? ctx.config.tps : {};
		if (!cfg || !cfg.enabled) return;

		const everyTicks = Math.max(10, Number(cfg.checkEveryTicks != null ? cfg.checkEveryTicks : 20));
		const alpha = clamp(Number(cfg.emaAlpha != null ? cfg.emaAlpha : 0.2), 0.01, 1);
		const maxReportTps = Math.max(1, Number(cfg.maxTps != null ? cfg.maxTps : 20));

		let lastTick = getTick();
		let lastMs = nowMs();
		let emaTps = Number.isFinite(Number(cfg.initialTps != null ? cfg.initialTps : 20)) ? Number(cfg.initialTps) : 20;

		system.runInterval(() => {
			const curTick = getTick();
			const curMs = nowMs();
			const dtTicks = Math.max(1, curTick - lastTick);
			const dtMs = Math.max(1, curMs - lastMs);

			// TPS estimado = ticks por segundo (20 ideal). Se clampa para evitar spikes.
			const instantTps = clamp((dtTicks * 1000) / dtMs, 0, maxReportTps);
			emaTps = emaTps + alpha * (instantTps - emaTps);

			lastTick = curTick;
			lastMs = curMs;

			const multiplier = computeMultiplier(emaTps, cfg);
			try {
				if (ctx && ctx.state && ctx.state.checks && typeof ctx.state.checks.set === "function") {
					ctx.state.checks.set("tps", {
						tick: curTick,
						tps: Number(emaTps.toFixed(2)),
						multiplier: Number(multiplier.toFixed(3)),
					});
				}
			} catch (e) {
				void e;
			}

			if (Boolean(cfg.logToConsole) && curTick % (everyTicks * 10) === 0) {
				try {
					if (ctx && ctx.logger && typeof ctx.logger.debug === "function") {
						ctx.logger.debug({
							checkId: "tps",
							player: null,
							message: "TPS sample",
							data: { tps: Number(emaTps.toFixed(2)), multiplier: multiplier },
						});
					}
				} catch (e) {
					void e;
				}
			}
		}, everyTicks);
	},
};
