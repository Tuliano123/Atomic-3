// Feature: skills/combat/calc
// Config central (evita hardcode). Consumidor de totals producidos por lecture/.

export const damageCalcConfig = {
	loopTicks: 10,

	// Comportamiento cuando H != 1
	disabledBehavior: {
		// Si true, setea a 0 los outputs (SC/CC/ProbCrit/DtotalH/MtotalH) cuando H!=1.
		// Si false, hace early-exit y no escribe nada.
		zeroOutputs: true,
	},

	// Fórmula (hooks). Por defecto replica el MVP documentado.
	formula: {
		// Offset opcional para poder (además de PoderTotalH). Default: 0.
		powerOffset: 0,
		// Multiplicadores fallback si MATotalH/MMTotalH faltan o son inválidos.
		multiplierAdd: 1,
		multiplierMult: 1,
		bonus: 0,
	},

	// Objectives (IDs)
	objectives: {
		// Gate global
		enabled: "H",

		// Legacy personal/base (retrocompat): hoy los comandos y sistemas existentes escriben aquí.
		// lecture/ los consume como Personal para construir los totals.
		baseDamage: "DMGH",
		baseCritDamage: "CDH",
		baseCritChance: "CCH",
		baseDefense: "DH",
		baseMana: "MH",
		baseVidaMax: "VidaMaxH",
		multAdd: "MAH",
		multMult: "MMH",

		// Inputs (totales por capa) — producidos por lecture/
		inDamageTotal: "DanoTotalH",
		inPowerTotal: "PoderTotalH",
		inCritDamageTotal: "DanoCritTotalH",
		inCritChanceTotal: "ProbCritTotalH",
		inDefenseTotal: "DefensaTotalH",
		inManaTotal: "ManaTotalH",
		inMultAddTotal: "MATotalH",
		inMultMultTotal: "MMTotalH",

		// Outputs
		outFinalNoCrit: "DanoFinalSC",
		outFinalCrit: "DanoFinalCC",
		// Output legacy consumido por damage_dealt/ para roll de crítico
		outCritChanceTotal: "ProbabilidadCriticaTotal",
		// Outputs legacy consumidos por módulos antiguos
		outDefenseTotal: "DtotalH",
		outManaTotal: "MtotalH",
		// Se mantiene por retrocompat (health/); escrito por lecture/ (no por calc/)
		outVidaMaxTotal: "VidaMaxTotalH",
	},

	displayNames: {
		enabled: "Habilitado Skills",
		baseDamage: "Daño Base (legacy)",
		baseCritDamage: "Daño Crítico Base (legacy)",
		baseCritChance: "Prob Crítica Base (legacy)",
		baseDefense: "Defensa Base (legacy)",
		baseMana: "Mana Base (legacy)",
		baseVidaMax: "Vida Max Base",
		multAdd: "Multiplicador Aditivo (x10)",
		multMult: "Multiplicador Multiplicativo (x10)",

		inDamageTotal: "Daño Total",
		inPowerTotal: "Poder Total",
		inCritDamageTotal: "Daño Crítico Total",
		inCritChanceTotal: "Prob Crítica Total",
		inDefenseTotal: "Defensa Total",
		inManaTotal: "Mana Total",
		inMultAddTotal: "Multiplicador Aditivo Total (x10)",
		inMultMultTotal: "Multiplicador Multiplicativo Total (x10)",

		outFinalNoCrit: "Daño Final Sin Crit",
		outFinalCrit: "Daño Final Con Crit",
		outCritChanceTotal: "Prob Crit Total (legacy)",
		outDefenseTotal: "Defensa Total (legacy)",
		outManaTotal: "Mana Total (legacy)",
		outVidaMaxTotal: "Vida Max Total",
	},

	debug: {
		enabled: false,
		console: false,
		tellPlayer: false,
		throttleMs: 2000,
		onlyWhenZero: false,
	},
};
