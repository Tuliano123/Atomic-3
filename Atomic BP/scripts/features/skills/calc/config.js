// Feature: skills/calc
// Config central (evita hardcode). Se puede reutilizar desde main.js.

export const damageCalcConfig = {
	loopTicks: 10,

	// Comportamiento cuando H != 1
	disabledBehavior: {
		// Si true, setea a 0 los outputs (SC/CC/DtotalH/MtotalH/VidaMaxTotalH) cuando H!=1.
		// Si false, hace early-exit y no escribe nada.
		zeroOutputs: true,
	},

	// VidaMax TOTAL por equipamiento.
	// Importante:
	// - `VidaMaxH` es la vida base/personal (editable por comandos). Este feature NUNCA la sobrescribe.
	// - `VidaMaxTotalH` es la vida total (base + gear). Este feature SOLO escribe `VidaMaxTotalH`.
	vidaMaxTotal: {
		enabled: true,
		// Si el jugador no tiene score en VidaMaxH, se usa este default.
		// Recomendado: 0.
		defaultBaseVidaMax: 0,
	},

	// Fórmula (hooks). Por defecto replica el MVP del README.
	// Nota: los multiplicadores nunca deben ser 0; si llegan como 0/undefined/NaN se tratarán como 1.
	formula: {
		power: 0,
		multiplierAdd: 1,
		multiplierMult: 1,
		bonus: 0,
	},

	// Objectives (IDs). Recomendación: mantener ASCII si el hosting/herramientas fallan con acentos.
	objectives: {
		enabled: "H",
		baseDamage: "DMGH",
		baseCritDamage: "CDH",
		baseCritChance: "CCH",
		baseDefense: "DH",
		baseMana: "MH",
		baseVidaMax: "VidaMaxH",

		// Multiplicadores (enteros escalados x10). Ej: 10 -> 1.0, 50 -> 5.0
		multAdd: "MAH",
		multMult: "MMH",

		// Outputs (IDs ASCII para máxima compatibilidad)
		outFinalNoCrit: "DanoFinalSC",
		outFinalCrit: "DanoFinalCC",
		outCritChanceTotal: "ProbabilidadCriticaTotal",
		outDefenseTotal: "DtotalH",
		outManaTotal: "MtotalH",
		outVidaMaxTotal: "VidaMaxTotalH",
	},

	// Display names (solo cosmético) cuando se creen objectives.
	displayNames: {
		enabled: "Habilitado Skills",
		baseDamage: "Daño Base",
		baseCritDamage: "Daño Crítico Base",
		baseCritChance: "Prob Crítica Base",
		multAdd: "Multiplicador Aditativo (x10)",
		multMult: "Multiplicador Multiplicativo (x10)",
		outFinalNoCrit: "Daño Final Sin Crit",
		outFinalCrit: "Daño Final Con Crit",
		outCritChanceTotal: "Prob Crit Total",
		baseDefense: "Defensa Base",
		baseMana: "Mana Base",
		baseVidaMax: "Vida Max Base",
		outDefenseTotal: "Defensa Total",
		outManaTotal: "Mana Total",
		outVidaMaxTotal: "Vida Max Total",
	},

	debug: {
		enabled: false,
		console: false,
		// Si true, manda mensajes al jugador cuando se recalcula (throttled)
		tellPlayer: false,
		// Evita spam: mínimo ms entre mensajes por jugador
		throttleMs: 2000,
		// Si true, solo emite debug cuando el sistema termina dejando SC/CC en 0
		onlyWhenZero: false,
	},
};
