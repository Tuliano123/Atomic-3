# AntiCheat (Arquitectura)

Este directorio contiene **solo la arquitectura** del sistema AntiCheat. La detección y el enforcement real se implementarán después.

## Objetivos

- Separar cada sección de detección en un *check* independiente.
- Tener un registro central que habilite/deshabilite checks por configuración.
- Mantener estado por check (ventanas, cooldowns, muestras) de forma aislada.
- Registrar evidencias y métricas (logger) para auditoría.
- Escalar por advertencias internas para minimizar falsos positivos.

## Estructura

- `index.js`: entrypoint (init idempotente).
- `anticheat.config.js`: configuración y toggles por sección.
- `checks/`: 15 checks (1 archivo por sección).
- `core/registry.js`: registro de checks.
- `core/context.js`: contexto compartido (config + state + enforce stub).
- `core/logger.js`: logger central (buffer + consola).
- `core/warnings.js`: advertencias internas y escalado.
- `core/sanctions.js`: sanciones temporales (contrato, sin permanencia).
- `catalogs/`: catálogos de ítems/bloques ilegales (placeholders).

## Política

Lee primero: [POLICY.md](POLICY.md)

## Documentación técnica

- Persistencia (scoreboards): [STORAGE.md](STORAGE.md)
- TPS scaling (anti falsos-positivos): [TPS.md](TPS.md)

## Contrato de un check

Cada check exporta un objeto:

- `id`: string único
- `section`: número (1..15)
- `name`: nombre humano
- `init(ctx)`: inicialización (sin asumir eventos)
- (opcional) `start(ctx)`: donde luego se conectarán suscripciones/timers

## Próximo paso recomendado

1. Implementar un `logger` central en `core/` para métricas y auditoría.
2. Elegir un modelo de enforcement (LogOnly/Warn/Kick/Ban) con rate limit.
3. Implementar primero checks de bajo falso positivo:
   - 1) ítems ilegales
   - 13) stacks anómalos
   - 4) entity flood
   - 14) TPS monitor (para ajustar sensibilidad)
