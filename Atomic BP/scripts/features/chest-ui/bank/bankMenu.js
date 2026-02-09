import { system } from "@minecraft/server";
import ChestFormData from "../chestui/forms.js";
import { logicScoreboard } from "../extensions/logic/logicScoreboard.js";
import { formatIntWithCommas } from "../placeholders/scoreboardPlaceholders.js";
import { showBankCustomAmountModal } from "../modals/bankCustomAmountModal.js";
import { clampBankOverflow, computeDepositWithCap, ensureBankDefaults } from "./bankState.js";

function runNextTick(fn) {
	system.run(fn);
}

export function primaryBankMenu(player) {
	ensureBankDefaults(player, { defaultLimit: 10000 });
	clampBankOverflow(player);

	// Demo / smoke test de las nuevas APIs descritas en chestui/README.md
	const ui = new ChestFormData("36", "§l§eBanco Personal", 1);

	// 1) default(): se usa por pattern(x), border(), fill() cuando no se especifica data
	ui.default({
		itemName: "§8",
		texture: "g/black",
	});

	// 3) fill(): relleno por bounds con coordenadas (x,y)
	ui.fill({ x: 0, y: 3 }, { x: 8, y: 3 }, { texture: "g/black", itemName: "§8" });

	ui.button(
		12,
		"§r§gDepositar Dinero",
		[
			"§r§8Dinero en banco: §6${(DB):@s:true:1}§7/§6${(DBlimite):@s:true:1}",
			"",
			"§r§7Sirve para guardar tu dinero en",
			"§r§7lo que vas de aventura. Al morir",
			"§r§7no lo perderas.",
			"",
			"§r§eClic para interactuar  ",
		],
		"chest",
		0
	);
	ui.button(
		14,
		"§r§aRetirar Dinero",
		[
			"§r§8Dinero en banco: §6${(DB):@s:true:1}§7/§6${(DBlimite):@s:true:1}",
			"",
			"§r§7Podras retirar dinero para comprar",
			"§r§7cosas u otros usos que le des",
			"",
			"§r§eClic para interactuar  ",
		],
		"dropper",
		0
	);
	ui.button({ x: 0, y: 2 }, "§r§cSalir", [], "barrier", 0, 0, false);
	ui.button(
		{ x: 8, y: 0 },
		"§r§eMejoras del banco",
		[
			"",
			"§r§7Podras mejorar la capacidad de",
			"§r§7tu banco personal",
			"",
			"$[@s:Mejora:==:0:(§cAún no tienes mejoras)]$[@s:Mejora:>=:1:(§7Nivel de mejora: §a${(Mejora):@s:true:1})]",
			"§r§7Limite actual: §6${(DBlimite):@s:true:1}",
			"",
			"§r§eClic para interactuar  ",
		],
		"gold_block",
		"+",
		0,
		false,
		"a"
	);

	ui.show(player).then((response) => {
		if (response.canceled) return;
		if (response.selection === 12) depositMenu(player);
		if (response.selection === 14) withdrawMenu(player);
		if (response.selection === 8) upgradesBankMenu(player);
		if (response.selection === 18) return;
	});
}

export function depositMenu(player) {
	ensureBankDefaults(player, { defaultLimit: 10000 });
	clampBankOverflow(player);

	const ui = new ChestFormData("36", "§l§gDepositar Dinero", 1);
	ui.default({
		itemName: "§8",
		texture: "g/black",
	});

	ui.fill({ x: 0, y: 3 }, { x: 8, y: 3 }, { texture: "g/black", itemName: "§8" });

	ui.button(
		10,
		"§r§eTodo el dinero",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Guardaras todo tu dinero en",
			"§r§7el banco dejandolo seguro",
			"",
			"§r§8En el banco: §6${(DB):@s:true:1}§7/§6${(DBlimite):@s:true:1}",
			"§r§8A depositar: §6${(D)[DBlimite-DB]:@s:true:1}",
			"",
			"§r§eClic para depositar",
			"$[@s:DB:>=:(DBlimite):(§c)]",
			"$[@s:DB:>=:(DBlimite):(§c¡El banco esta lleno!)]",
		],
		"chest",
		64
	);
	ui.button(
		12,
		"§r§gLa mitad del dinero",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Guardaras todo tu dinero en",
			"§r§7el banco dejandolo seguro",
			"",
			"§r§8En el banco: §6${(DB):@s:true:1}§7/§6${(DBlimite):@s:true:1}",
			"§r§8A depositar: §6${(D)[DBlimite-DB]:@s:true:0.5}",
			"",
			"§r§gClic para depositar  ",
			"$[@s:DB:>=:(DBlimite):(§c)]",
			"$[@s:DB:>=:(DBlimite):(§c¡El banco esta lleno!)]",
		],
		"chest",
		32
	);
	ui.button(
		14,
		"§r§pUn cuarto del dinero",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Guardaras todo tu dinero en",
			"§r§7el banco dejandolo seguro",
			"",
			"§r§8En el banco: §6${(DB):@s:true:1}§7/§6${(DBlimite):@s:true:1}",
			"§r§8A depositar: §6${(D)[DBlimite-DB]:@s:true:0.25}",
			"",
			"§r§pClic para depositar  ",
			"$[@s:DB:>=:(DBlimite):(§c)]",
			"$[@s:DB:>=:(DBlimite):(§c¡El banco esta lleno!)]",
		],
		"chest",
		0
	);
	ui.button(
		16,
		"§r§6Cantidad personalizada",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Deposita una cantidad exacta",
			"§r§7(acepta solo enteros).",
			"",
			"§r§6Clic para depositar",
			"$[@s:DB:>=:(DBlimite):(§c )]",
			"$[@s:DB:>=:(DBlimite):(§c¡El banco esta lleno!)]",
		],
		"i/sign",
		0
	);
	ui.button({ x: 0, y: 2 }, "§r§cRegresar", [], "barrier", 0, 0, false);

	ui.show(player).then(async (response) => {
		if (response.canceled) return;
		if (response.selection === 18) return primaryBankMenu(player);
		if (response.selection === 16) {
			await system.waitTicks(1);
			const amount = await showBankCustomAmountModal(player, "deposit");
			if (amount == null) {
				runNextTick(() => depositMenu(player));
				return;
			}
			await depositCustomAmount(player, amount);
			runNextTick(() => depositMenu(player));
			return;
		}

		/** @type {Record<number, number>} */
		const multipliers = { 10: 1, 12: 0.5, 14: 0.25 };
		const multiplier = multipliers[response.selection];
		if (multiplier != null) {
			logicScoreboard(
				player,
				[
					{
						type: "scoreboard",
						scoreboard: "D",
						conditionSign: ">",
						conditionInt: 0,
						failMessage: "§cNo tienes dinero para depositar.",
					},
				],
				[
					{
						run: (_p, ctx) => {
							const d = ctx.getScore("D");
							const db = ctx.getScore("DB");
							const limit = ctx.getScore("DBlimite");

							const { attempt, real } = computeDepositWithCap({ d, db, limit, multiplier });
							ctx.vars.depositAttempt = attempt;
							ctx.vars.depositReal = real;

							if (!Number.isFinite(attempt) || attempt <= 0) {
								ctx.sendMessage("§cCantidad inválida.");
								ctx.abort = true;
								return;
							}
							if (!Number.isFinite(real) || real <= 0) {
								ctx.sendMessage("§cTu banco está lleno.");
								ctx.abort = true;
								return;
							}

							ctx.setScore("DB", db + real);
							ctx.setScore("D", d - real);
						},
					},
					{
						run: (_p, ctx) => {
							const attempt = Math.trunc(Number(ctx.vars.depositAttempt ?? 0));
							const real = Math.trunc(Number(ctx.vars.depositReal ?? 0));
							if (!Number.isFinite(real) || real <= 0) return;
							if (real < attempt) ctx.sendMessage(`§eBanco lleno, depositaste solo §6${formatIntWithCommas(real)}§e.`);
							else ctx.sendMessage(`§aDepositaste ${formatIntWithCommas(real)}.`);
						},
					},
				],
				{ clampMin0: true }
			);
			depositMenu(player);
		}
	});
}

export function withdrawMenu(player) {
	ensureBankDefaults(player, { defaultLimit: 10000 });
	clampBankOverflow(player);

	const ui = new ChestFormData("36", "§l§bRetirar Dinero", 1);
	ui.default({
		itemName: "§8",
		texture: "g/black",
	});

	ui.fill({ x: 0, y: 3 }, { x: 8, y: 3 }, { texture: "g/black", itemName: "§8" });

	ui.button(
		10,
		"§r§bTodo el dinero",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Retiraras todo el dinero",
			"§r§7del banco para tú uso",
			"",
			"§r§8En el banco: §6${(DB):@s:true:1}",
			"§r§8a retirar: §6${(DB):@s:true:1}",
			"",
			"§r§eClic para retirar  ",
			"$[@s:DB:<=:0:(§c)]",
			"$[@s:DB:<=:0:(§cNo hay dinero en tu banco)]",
		],
		"dropper",
		64
	);
	ui.button(
		12,
		"§r§3La mitad del dinero",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Retiraras la mitad del dinero",
			"§r§7del banco para tú uso",
			"",
			"§r§8En el banco: §6${(DB):@s:true:1}",
			"§r§8a retirar: §6${(DB):@s:true:0.5}",
			"",
			"§r§eClic para retirar  ",
			"$[@s:DB:<=:0:(§c)]",
			"$[@s:DB:<=:0:(§cNo hay dinero en tu banco)]",
		],
		"dropper",
		32
	);
	ui.button(
		14,
		"§r§9Un cuarto del dinero",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Retiraras un cuarto del dinero",
			"§r§7del banco para tú uso",
			"",
			"§r§8En el banco: §6${(DB):@s:true:1}",
			"§r§8a retirar: §6${(DB):@s:true:0.25}",
			"",
			"§r§eClic para retirar  ",
			"$[@s:DB:<=:0:(§c)]",
			"$[@s:DB:<=:0:(§cNo hay dinero en tu banco)]",
		],
		"dropper",
		0
	);
	ui.button(
		16,
		"§r§6Cantidad personalizada",
		[
			"§r§8Cuenta personal",
			"",
			"§r§7Retira una cantidad exacta",
			"§r§7Solo acepta numeros.",
			"",
			"§r§6Clic para ingresar cantidad",
			"$[@s:DB:<=:0:( )]",
			"$[@s:DB:<=:0:(§cNo hay dinero en tu banco)]",
		],
		"i/sign",
		0
	);
	ui.button({ x: 0, y: 2 }, "§r§cRegresar", [], "barrier", 0, 0, false);

	ui.show(player).then(async (response) => {
		if (response.canceled) return;
		if (response.selection === 18) return primaryBankMenu(player);
		if (response.selection === 16) {
			await system.waitTicks(1);
			const amount = await showBankCustomAmountModal(player, "withdraw");
			if (amount == null) {
				runNextTick(() => withdrawMenu(player));
				return;
			}
			await withdrawCustomAmount(player, amount);
			runNextTick(() => withdrawMenu(player));
			return;
		}

		/** @type {Record<number, number>} */
		const multipliers = { 10: 1, 12: 0.5, 14: 0.25 };
		const multiplier = multipliers[response.selection];
		if (multiplier != null) {
			logicScoreboard(
				player,
				[
					{
						type: "scoreboard",
						scoreboard: "DB",
						conditionSign: ">",
						conditionInt: 0,
						failMessage: "§cNo tienes dinero para retirar.",
					},
				],
				[
					{
						run: (_p, ctx) => {
							const d = ctx.getScore("DB");
							const amount = Math.floor(d * multiplier);
							ctx.vars.depositAmount = amount;
							if (!Number.isFinite(amount) || amount <= 0 || amount > d) {
								ctx.sendMessage("§cCantidad inválida.");
								ctx.abort = true;
							}
						},
					},
					{
						scoreboardSuccess: {
							scoreboard: "D",
							operation: "+",
							percentage: { scoreboardFrom: "DB", percentage: multiplier },
							order: "normal",
						},
					},
					{
						scoreboardSuccess: {
							scoreboard: "DB",
							operation: "-",
							percentage: { scoreboardFrom: "DB", percentage: multiplier },
							order: "normal",
						},
					},
					{
						run: (_p, ctx) => {
							const amount = Math.trunc(Number(ctx.vars.depositAmount ?? 0));
							ctx.sendMessage(`§aRetiraste ${formatIntWithCommas(amount)}.`);
						},
					},
				],
				{ clampMin0: true }
			);
			withdrawMenu(player);
		}
	});
}

export function upgradesBankMenu(player) {
	ensureBankDefaults(player, { defaultLimit: 10000 });
	clampBankOverflow(player);

	const ui = new ChestFormData("36", "§l§eMejoras del Banco", 1);
	ui.default({
		itemName: "§8",
		texture: "g/black",
	});

	ui.fill({ x: 0, y: 3 }, { x: 8, y: 3 }, { texture: "g/black", itemName: "§8" });

	ui.button(
		11,
		"§r§eMejora del banco #1",
		[
			"",
			"§r§e>---------------<",
			"§r§7Podrás mejorar tu cuenta del banco",
			"§r§7para almacenar una mayor cantidad",
			"§r§7de dinero, esta mejora es PERMANENTE",
			"",
			"§r§pRequisitos:",
			" §r§p- 1,000 de dinero",
			"",
			"§r§eMejora del banco:",
			"§r§810,000 §7-> §6100,000",
			"",
			"§r§pClic para interactuar  ",
			"",
			"$[@s:Mejora:>=:1:(§c¡Ya has comprado esta mejora!)]",
			"§r§e>---------------<",
		],
		"i/ender_pearl",
		0
	);
	ui.button(
		12,
		"§r§aMejora del banco #2",
		[
			"",
			"§r§a>---------------<",
			"§r§7Podrás mejorar tu cuenta del banco",
			"§r§7para almacenar una mayor cantidad",
			"§r§7de dinero, esta mejora es PERMANENTE",
			"",
			"§r§2Requisitos:",
			" §r§2- 15,000 de dinero",
			" §r§2- Haber comprado la mejora #1",
			" §r§2- Acto I completado",
			"",
			"§r§aMejora del banco:",
			"§r§8100,000 §7-> §6250,000",
			"",
			"§r§2Clic para interactuar  ",
			"",
			"$[@s:Mejora:>=:2:(§c¡Ya has comprado esta mejora!)]",
			"§r§a>---------------<",
		],
		"i/ender_pearl",
		0,
		0,
		true
	);
	ui.button(
		13,
		"§r§bMejora del banco #3",
		[
			"",
			"§r§b>---------------<",
			"§r§7Podrás mejorar tu cuenta del banco",
			"§r§7para almacenar una mayor cantidad",
			"§r§7de dinero, esta mejora es PERMANENTE",
			"",
			"§r§sRequisitos:",
			" §r§s- 50,000 de dinero",
			" §r§s- Haber comprado la mejora #2",
			" §r§s- Acto III completado",
			"",
			"§r§bMejora del banco:",
			"§r§8250,000 §7-> §62,000,000",
			"",
			"§r§sClic para interactuar  ",
			"",
			"$[@s:Mejora:>=:3:(§c¡Ya has comprado esta mejora!)]",
			"§r§b>---------------<",
		],
		"i/ender_eye",
		0,
		0,
		false
	);
	ui.button(
		14,
		"§r§uMejora del banco #4",
		[
			"",
			"§r§u>---------------<",
			"§r§7Podrás mejorar tu cuenta del banco",
			"§r§7para almacenar una mayor cantidad",
			"§r§7de dinero, esta mejora es PERMANENTE",
			"",
			"§r§5Requisitos:",
			" §r§5- 150,000 de dinero",
			" §r§5- Haber comprado la mejora #3",
			" §r§5- Acto IV completado",
			"",
			"§r§uMejora del banco:",
			"§r§82,000,000 §7-> §610,000,000",
			"",
			"§r§5Clic para interactuar  ",
			"",
			"$[@s:Mejora:>=:4:(§c¡Ya has comprado esta mejora!)]",
			"§r§u>---------------<",
		],
		"i/ender_eye",
		0,
		0,
		true
	);
	ui.button(
		15,
		"§r§4Mejora del banco #5",
		[
			"",
			"§r§4>---------------<",
			"§r§7Podrás mejorar tu cuenta del banco",
			"§r§7para almacenar una mayor cantidad",
			"§r§7de dinero, esta mejora es PERMANENTE",
			"",
			"§r§mRequisitos:",
			" §r§m- 1,000,000 de dinero",
			" §r§m- Haber comprado la mejora #4",
			" §r§m- Acto V completado",
			"",
			"§r§4Mejora del banco:",
			"§r§810,000,000 §7-> §61,000,000,000",
			"",
			"§r§mClic para interactuar  ",
			"",
			"$[@s:Mejora:>=:5:(§c¡Ya has comprado esta mejora!)]",
			"§r§4>---------------<",
		],
		"i/end_crystal",
		0,
		0,
		true
	);
	ui.button({ x: 0, y: 2 }, "§r§cRegresar", [], "barrier", 0, 0, false);

	ui.show(player).then((response) => {
		if (response.canceled) return;
		if (response.selection === 18) {
			primaryBankMenu(player);
			return;
		}

		/** @type {Record<number, { cost:number, actoRequired:number, requiredUpgradeLevel:number, limitFrom:number, limitTo:number, setsUpgradeLevelTo:number }>} */
		const upgradesBySlot = {
			11: { cost: 1000, actoRequired: 0, requiredUpgradeLevel: 0, limitFrom: 10000, limitTo: 100000, setsUpgradeLevelTo: 1 },
			12: { cost: 15000, actoRequired: 1, requiredUpgradeLevel: 1, limitFrom: 100000, limitTo: 250000, setsUpgradeLevelTo: 2 },
			13: { cost: 50000, actoRequired: 3, requiredUpgradeLevel: 2, limitFrom: 250000, limitTo: 2000000, setsUpgradeLevelTo: 3 },
			14: { cost: 150000, actoRequired: 4, requiredUpgradeLevel: 3, limitFrom: 2000000, limitTo: 10000000, setsUpgradeLevelTo: 4 },
			15: { cost: 1000000, actoRequired: 5, requiredUpgradeLevel: 4, limitFrom: 10000000, limitTo: 1000000000, setsUpgradeLevelTo: 5 },
		};

		const u = upgradesBySlot[response.selection];
		if (!u) return;

		logicScoreboard(
			player,
			[
				{ type: "scoreboard", scoreboard: "D", conditionSign: ">=", conditionInt: u.cost, failMessage: "§cNo tienes dinero suficiente." },
				{ type: "scoreboard", scoreboard: "Acto", conditionSign: ">=", conditionInt: u.actoRequired, failMessage: "§cNo cumples el acto requerido." },
				{ type: "scoreboard", scoreboard: "Mejora", conditionSign: "==", conditionInt: u.requiredUpgradeLevel, failMessage: "§cNo es tu nivel actual de mejora." },
				{ type: "scoreboard", scoreboard: "DBlimite", conditionSign: "==", conditionInt: u.limitFrom, failMessage: "§cTu límite actual no coincide con esta mejora." },
			],
			[
				{ scoreboardSuccess: { scoreboard: "D", operation: "-", int: u.cost, order: "normal" } },
				{ scoreboardSet: { scoreboard: "DBlimite", value: u.limitTo } },
				{ scoreboardSet: { scoreboard: "Mejora", value: u.setsUpgradeLevelTo } },
				{ run: (_p, ctx) => ctx.sendMessage(`§aMejora comprada. Nuevo límite: ${formatIntWithCommas(u.limitTo)}.`) },
			],
			{ clampMin0: true }
		);

		upgradesBankMenu(player);
	});
}

async function depositCustomAmount(player, requestedAmount) {
	const requested = Math.trunc(Number(requestedAmount));
	if (!Number.isFinite(requested) || requested <= 0) return;

	ensureBankDefaults(player, { defaultLimit: 10000 });
	clampBankOverflow(player);

	logicScoreboard(
		player,
		[
			{ type: "scoreboard", scoreboard: "D", conditionSign: ">", conditionInt: 0, failMessage: "§cNo tienes dinero para depositar." },
		],
		[
			{
				run: (_p, ctx) => {
					const d = ctx.getScore("D");
					const db = ctx.getScore("DB");
					const limit = ctx.getScore("DBlimite");
					const space = Math.max(0, Math.trunc(Number(limit)) - Math.trunc(Number(db)));
					const attempt = Math.max(0, Math.min(requested, Math.trunc(Number(d))));
					const real = Math.max(0, Math.min(attempt, space));

					ctx.vars.attempt = attempt;
					ctx.vars.real = real;
					if (attempt <= 0) {
						ctx.sendMessage("§cNo tienes dinero suficiente.");
						ctx.abort = true;
						return;
					}
					if (real <= 0) {
						ctx.sendMessage("§cTu banco está lleno.");
						ctx.abort = true;
						return;
					}

					ctx.setScore("DB", Math.trunc(Number(db)) + real);
					ctx.setScore("D", Math.trunc(Number(d)) - real);
				},
			},
			{
				run: (_p, ctx) => {
					const attempt = Math.trunc(Number(ctx.vars.attempt ?? 0));
					const real = Math.trunc(Number(ctx.vars.real ?? 0));
					if (real <= 0) return;
					if (real < attempt) ctx.sendMessage(`§eBanco lleno, depositaste solo §6${formatIntWithCommas(real)}§e.`);
					else ctx.sendMessage(`§aDepositaste ${formatIntWithCommas(real)}.`);
				},
			},
		],
		{ clampMin0: true }
	);
}

async function withdrawCustomAmount(player, requestedAmount) {
	const requested = Math.trunc(Number(requestedAmount));
	if (!Number.isFinite(requested) || requested <= 0) return;

	ensureBankDefaults(player, { defaultLimit: 10000 });
	clampBankOverflow(player);

	logicScoreboard(
		player,
		[
			{ type: "scoreboard", scoreboard: "DB", conditionSign: ">", conditionInt: 0, failMessage: "§cNo hay dinero en tu banco." },
		],
		[
			{
				run: (_p, ctx) => {
					const db = ctx.getScore("DB");
					const d = ctx.getScore("D");
					const available = Math.max(0, Math.trunc(Number(db)));
					const real = Math.max(0, Math.min(requested, available));

					ctx.vars.real = real;
					if (real <= 0) {
						ctx.sendMessage("§cNo hay dinero suficiente en tu banco.");
						ctx.abort = true;
						return;
					}

					ctx.setScore("D", Math.trunc(Number(d)) + real);
					ctx.setScore("DB", available - real);
				},
			},
			{
				run: (_p, ctx) => {
					const real = Math.trunc(Number(ctx.vars.real ?? 0));
					if (real <= 0) return;
					if (real < requested) ctx.sendMessage(`§eSolo pudiste retirar §6${formatIntWithCommas(real)}§e.`);
					else ctx.sendMessage(`§aRetiraste ${formatIntWithCommas(real)}.`);
				},
			},
		],
		{ clampMin0: true }
	);
}
