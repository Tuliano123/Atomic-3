Este archivo es temporal y tiene como proposito guiar la manera y los sistemas necesarios para los encantamientos de tipo B y C

Lista de encantamientos: Los que dice **A** ya estan realizados, los que dicen **A\*** estan pendientes y también se abordaran aquí


**Tipo A\* pendientes** (requieren lectura de stats para delta variable):
- **Sobrecarga** (id 19): Por cada umbral de Daño Crítico, +5 Daño.
- **Obliteración** (id 21): Por Prob. Crítica > 100%, +DC variable.
- **Linaje** (id 35): Convierte Defensa existente en Fortuna Minera.

#### Espada (`sword`)

| ID | Nombre | Niv. Máx | Tipo | Efecto | Delta por Nivel |
|----|--------|----------|------|--------|-----------------|
| 1 | Filo | VII | **A** | +Daño → S3 | +3 |
| 2 | Primer Golpe | IV | B | Multiplicador primer golpe | — |
| 3 | Crítico | VIII | **A** | +Daño Crítico → S1 y +Prob. Crítica → S1 | +5 DC, +2 PC |
| 4 | Aspecto Ígneo | III | C | Quemaduras 5s/10s/15s al golpear | — |
| 5 | Castigo | V | B | ×0.1 multiplicador a no-muertos/nivel | — |
| 6 | Perdición de los Artrópodos | VIII | B | ×0.1 multiplicador a artrópodos/nivel | — |
| 7 | Discordancia | III | B | ×0.05 multiplicador a no-muertos/nivel | — |
| 8 | Corte Veloz | II | C | 5%/nivel de infligir 50% del daño extra | — |
| 9 | Oxidación | III | C | 60% veneno I/II/III, reduce Daño -1/-2/-3 | — |
| 10 | Asesino del Fin | VII | B | ×0.1 multiplicador a criaturas del End | — |
| 11 | Saqueo | V | C | +3% drops de mobs por nivel | — |
| 12 | Lux | III | B | ×0.1 multiplicador de día/nivel | — |
| 13 | Nux | III | B | ×0.1 multiplicador de noche/nivel | — |
| 14 | Verosimilitud | I | **A** | ×0.5 mult. pero **-35 Daño** → S3 (resta) | -35 |

#### Arco (`bow`)

| ID | Nombre | Niv. Máx | Tipo | Efecto | Delta por Nivel |
|----|--------|----------|------|--------|-----------------|
| 15 | Poder | X | **A** | +Daño → S3 | +15 |
| 16 | Llama | II | C | Quemaduras con flechas | — |
| 17 | Golpe | III | C | Retroceso al impactar | — |
| 18 | Salvación | IV | C | Curación propia | — |
| 19 | Sobrecarga | V | **A\*** | Por cada umbral de DC, +5 Daño → S3 | Tabla de umbrales |
| 20 | Caprificación | I | C | 50% convertir a cabra (5 min CD) | — |
| 21 | Obliteración | V | **A\*** | Por PC > 100%, +2/4/6/8/10 DC → S1 | Variable |
| 22 | Terminación | I | C | +1 flecha extra | — |
| 23 | Artigeno | III | C | 4%/nivel de infligir veneno I | — |
| 24 | Magmatismo | IV | B | Ignora 5% Defensa/nivel | — |
| 25 | Tormenta | III | **A** | +Daño → S3 | +24 |

#### Armadura (`armor` / `helmet` / `boots`)

| ID | Nombre | Niv. Máx | Tipo | Compatible | Efecto |
|----|--------|----------|------|------------|--------|
| 26 | Protección | VI | B | armor, helmet, boots | Reducción % daño recibido |
| 27 | Rejuvenecimiento | V | C | armor, helmet, boots | Regeneración pasiva |
| 28 | Afinidad acuática | I | C | helmet | Mejora minería acuática |
| 29 | Respiración | III | C | helmet | Respiración extendida |
| 30 | Caída de pluma | XII | C | boots | Reducción daño de caída |
| 31 | Lijereza | II | C | boots | Velocidad de movimiento |

#### Herramientas (`pickaxe` / `axe` / `hoe`)

| ID | Nombre | Niv. Máx | Tipo | Compatible | Efecto | Delta por Nivel |
|----|--------|----------|------|------------|--------|-----------------|
| 32 | Eficiencia | V | **Especial** | pickaxe, axe, hoe | Encantamiento vanilla real | — |
| 33 | Fortuna | V | **A** | pickaxe, axe, hoe | +Fortuna minera | +50 |
| 34 | Prisa espontánea | III | C | pickaxe, axe | 0.1% acumulable de prisa II | — |
| 35 | Linaje | II | **A\*** | pickaxe | Convierte Defensa → Fortuna minera | 20/10 Def = +5 FM |
| 36 | Convicción | XII | **A** | pickaxe, axe, hoe | +Todas las fortunas | +5 |
| 37 | Cultivador | X | **A** | hoe | +Fortuna de cultivos | +20 |

> **A\***: Tipo A con matices — requiere lectura de stats o scoreboards existentes para calcular el delta, pero el resultado final sí es una escritura numérica en lore.
>
> **Especial**: Eficiencia es el único encantamiento que se aplica como encantamiento vanilla real al item (usando el componente `Enchantable`), además de la línea cosmética.

---

*Nunca usar dynamic propierties; De ser necesario guardar valores usar scoreboards

Ire encantamiento por encantamiento en orden de arriba para abajo

Primer Golpe usara el sistema de daño ubicado en Atomic BP/scripts/features/skills/combat/damage_dealt; Pero no necesitamos alterar codigo de allí; Usando la formula de DañoFinal vemos que existe "MultiplicadorAditativo"; Simplemente al scoreboard MAH que es Multiplicador Aditativo que esta en escala x10 por cada nivel de "Primer Golpe" aumenta en 4 MMA (El scoreboard) cada vez que se golpe a un mob; Tendrá un cooldown de 1 minuto este encantamiento oeri su ek golpe elimina al objetivo de un solo golpe (Deja su Vida en 0) entonces tendrá 0s de cooldown y se podrá volver a usar instantaneamente; Para esto ultimo talvez sea necesario implementar alguna referencia en el sistema de Vida situado en Atomic BP/scripts/features/skills/combat/health; En resumen Primer Golpe añadira 4 al scoreboard MAH del jugador por nivel hasta que se golpe a un jugador o mob lo cual le quitara los 4 o la cantidad que tenga por el encantamiento hasta que el cooldown se resetee; 4 es equivalente a 0.4 así que se le añade un x0.4 de daño final aditativo por cada nivel de este encantamiento

