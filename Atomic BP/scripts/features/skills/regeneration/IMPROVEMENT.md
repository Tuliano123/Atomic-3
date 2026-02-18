# Objetivo

Realizar una mejora estructural adaptando el sistema a las nuevas lecturas realizadas en lecture/ (Analizar antes de proceder)
Además también se requiere cambiar la implementación; regeneration/ dejará de leer el lore de los items y usara el scoreboard para reflejar

La principal cosa a modificar es modifiers; dejará de verse de esta manera debido a que la lectura siempre se hará en lecture/ y no aquí
Así que lecture/ ya hace la lecutra y transforma a scoreboard los valores de "Fortuna" que requerimos envez de operar leyendo el lore operaremos leyendo el scoreboard y en base a ese y condiciones personalizables; Será parecido en cuestion de tener argumentos como "priority", "mode", "drops"

## Tarea

La tarea entonces será una revisión exhaustiva en regeneration/ en busca de hardcodeos o mala implementación; Este es de los unicos sistemas que tiene autorizado usar dynamic propiertes más hay que usarlo de la manera más cuidadosa y conservadora posible, evitando tener registros duplicados y posibles fallos por memoria consumida

### Old version

			modifiers: {
				// Silk Touch: para testear override
				silk_touch_1: {
					match: ["silk touch i", "toque de seda i"],
					priority: 100,
					mode: "override",
					drops: [[1, "minecraft:oak_log", 1, 1, 100, "MaderaTest (Silk)", ["§7Test: Silk Touch"]]],
				},
				// Fortuna: para testear otra tabla
				fortune_1: {
					match: ["fortuna i", "fortune i"],
					priority: 10,
					mode: "override",
					drops: [
						[1, "minecraft:oak_log", 1, 2, 65, "MaderaTest", ["§7Test: Fortune I"]],
						[2, "minecraft:oak_leaves", 1, 4, 40, "Hojitas", ["§7Test: Fortune I"]],
					],
				},
			},

### New version prototype

//WIP
			modifiers: [
                {
                    id: "FortunaMinera",
					scoreboardName: "FortMin",
					scores: [
						{
							range: 0,
							titleDisplay: ["este es un title de ejemplo"," ${@s:D}"]
						}
					]
                },
            ]


