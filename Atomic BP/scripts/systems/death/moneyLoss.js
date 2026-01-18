import { formatNumberWithCommas } from "./format.js";

function toInt(value, fallback = 0) {
	const n = Math.trunc(Number(value));
	return Number.isFinite(n) ? n : fallback;
}

function clampMin0(value) {
	const n = Math.trunc(Number(value));
	return Number.isFinite(n) && n > 0 ? n : 0;
}

function getVipRule(config, vipLevel) {
	const vipRules = config?.moneyLoss?.vipRules || {};
	const rule = vipRules[String(vipLevel)] ?? vipRules[vipLevel];
	return rule && typeof rule === "object" ? rule : null;
}

function computeWarningPercentFromRule(rule, fallbackPercent) {
	if (!rule || typeof rule !== "object") return fallbackPercent;
	if (rule.mode === "none") return 0;
	if (rule.mode === "fraction") {
		const num = clampMin0(rule.numerator);
		const den = clampMin0(rule.denominator);
		if (num > 0 && den > 0) return Math.floor((num * 100) / den);
	}
	return fallbackPercent;
}

export function computeMoneyLoss(state) {
	const config = state?.config || {};
	const moneyLoss = config?.moneyLoss || {};
	const warnings = config?.warnings || {};

	const vip = toInt(state?.vipLevel, 0);
	const deaths = toInt(state?.deathsAfter, 0);
	const money = Math.max(0, toInt(state?.money, 0));
	const graceDeaths = Math.max(0, toInt(moneyLoss?.graceDeaths, 0));

	const defaultPercent = Math.max(0, toInt(moneyLoss?.normalLossPercent, 0));
	const rule = vip >= 1 ? getVipRule(config, vip) : null;

	const warningDefaultByVip = vip === 1 ? 25 : vip === 2 ? 20 : vip === 3 ? 10 : vip >= 4 ? 0 : defaultPercent;
	const warningPercent = computeWarningPercentFromRule(rule, warningDefaultByVip);

	if (!moneyLoss?.enabled) {
		return {
			shouldWarn: false,
			warningPercent,
			lossAmount: 0,
			newMoney: money,
			lossMessage: null,
		};
	}

	if (deaths <= graceDeaths) {
		return {
			shouldWarn: !!warnings?.enabled,
			warningPercent,
			lossAmount: 0,
			newMoney: money,
			lossMessage: null,
		};
	}

	let lossAmount = 0;
	if (vip >= 1 && rule) {
		if (rule.mode === "none") {
			lossAmount = 0;
		} else if (rule.mode === "fraction") {
			const num = clampMin0(rule.numerator);
			const den = clampMin0(rule.denominator);
			if (num > 0 && den > 0) lossAmount = Math.floor((money * num) / den);
		} else {
			lossAmount = Math.floor((money * defaultPercent) / 100);
		}
	} else {
		lossAmount = Math.floor((money * defaultPercent) / 100);
	}

	lossAmount = Math.max(0, Math.trunc(lossAmount));
	const newMoney = Math.max(0, money - lossAmount);

	let lossMessage = null;
	if (lossAmount > 0) {
		const formatted = formatNumberWithCommas(lossAmount);
		lossMessage = String(moneyLoss?.lossTellraw ?? "§7¡Has perdido §g<Cantidad>§7!").split("<Cantidad>").join(formatted);
	}

	return {
		shouldWarn: false,
		warningPercent,
		lossAmount,
		newMoney,
		lossMessage,
	};
}
