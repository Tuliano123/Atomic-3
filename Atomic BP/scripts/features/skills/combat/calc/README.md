# Skills / Combat / Calc

> Minecraft Bedrock 1.21.132 · `@minecraft/server` 2.4.0

Ruta: `Atomic BP/scripts/features/skills/combat/calc`

Este módulo aplica la **fórmula de daño final** consumiendo los **totales por capa** calculados por `skills/lecture/`.

## Responsabilidad

- Lee (por player con `H == 1`):
  - `DanoTotalH`, `PoderTotalH`, `DanoCritTotalH`, `ProbCritTotalH`
  - `MATotalH`, `MMTotalH`
  - `DefensaTotalH`, `ManaTotalH`
- Escribe (outputs legacy consumidos por combat/):
  - `DanoFinalSC`, `DanoFinalCC`
  - `ProbabilidadCriticaTotal` (int)
  - `DtotalH` (copia de `DefensaTotalH`) y `MtotalH` (copia de `ManaTotalH`)

> `VidaMaxTotalH` ya lo escribe `skills/lecture/` (no se escribe aquí para evitar múltiples writers).

## Notas de compatibilidad

- La capa **Personal** actualmente sigue viviendo en scoreboards legacy (`DMGH`, `CDH`, `CCH`, `DH`, `MH`, `MAH`, `MMH`).
- `skills/lecture/` los consume como Personal para construir `*TotalH` durante la migración.
