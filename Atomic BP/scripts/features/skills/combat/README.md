# Skills / Combat

Ruta: `Atomic BP/scripts/features/skills/combat`

Este módulo agrupa features relacionadas a **combate** que consumen el sistema de cálculo de daño (`skills/calc`) y opcionalmente el sistema de hologramas (`atomic:hologram`).

## Dependencias

- **Damage calc** (ya implementado): mantiene por jugador los scoreboards:
  - `DanoFinalSC` (daño final sin crítico)
  - `DanoFinalCC` (daño final con crítico, teórico)
  - Stats base: `DMGH`, `CDH`, `CCH`, multiplicadores `MAH`, `MMH` (escala x10)
- **Hologram** (BP entity): `atomic:hologram` (ver docs en `Atomic BP/docs/hologram.md`).

## Sub-features

- `health/`: sistema de vida por scoreboards (`H`, `Vida`, `VidaMax`) para players y mobs (MVP).
- `damage_dealt/`: lógica de “daño realizado” al golpear mobs; decide crítico y spawnea holograma temporal.
- `damage_title/`: UI alternativa (title/actionbar) para debug/feedback del daño, sin entidades.

## Scoreboards (combat)

- `H`: habilita sistemas basados en scoreboards.
- `Vida` / `VidaMax`: vida custom (ver `health/`).

## Principios de diseño

- **No recalcular** daño aquí: este módulo **consume** `DanoFinalSC/DanoFinalCC`.
- **Rendimiento**: rate-limit y pooling; nunca crear un intervalo por entidad.
- **Compatibilidad**: fallback a comandos cuando el API no alcance (best-effort).

## Pendiente

Tú vas a agregar aquí las stats de mobs (defensa, reducción, resistencias, inmunidades, etc.) y cómo afectan el daño final aplicado.
