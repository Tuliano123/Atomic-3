# Sistema de muerte (BP) — Atomic

Ruta del sistema: `Atomic BP/scripts/systems/death/`

## Resumen
Este sistema reemplaza los mensajes vanilla de muerte, controla la pérdida de dinero (scoreboard `D`) y soporta reglas VIP mediante scoreboards (`vip`, `muertes`, `H`).

### Requisito global
- **Desactivar mensajes vanilla:** `gamerule showdeathmessages false`

## Inicialización
El sistema se inicia desde el entrypoint principal:
- [Atomic BP/scripts/main.js](../scripts/main.js)

## Scoreboards requeridos
> **No se inicializan aquí**. Deben existir desde el init central.

- `muertes` (contador de muertes del jugador)
- `D` (dinero)
- `vip` (nivel VIP, 0 si no aplica)
- `H` (habilitación del sistema skills; actualmente no cambia el resolver)

## Arquitectura de archivos
- [Atomic BP/scripts/systems/death/config.js](../scripts/systems/death/config.js) — configuración, plantillas y reglas.
- [Atomic BP/scripts/systems/death/index.js](../scripts/systems/death/index.js) — entrypoint del sistema.
- [Atomic BP/scripts/systems/death/deathMessageResolver.js](../scripts/systems/death/deathMessageResolver.js) — resolver de mensajes con prioridad VIP.
- [Atomic BP/scripts/systems/death/moneyLoss.js](../scripts/systems/death/moneyLoss.js) — cálculo de pérdida de dinero.
- [Atomic BP/scripts/systems/death/format.js](../scripts/systems/death/format.js) — helpers de formato.
- [Atomic BP/scripts/systems/death/emoji/index.js](../scripts/systems/death/emoji/index.js) — integración con emojis custom.

## Flujo (resumen)
1) Se incrementa `muertes` (+1) al morir.
2) Se resuelve el mensaje de muerte (prioridad **VIP > causa**).
3) Se emite el mensaje global (`broadcastTarget`, por defecto `@a`).
4) Se aplica pérdida de dinero según reglas (con “graceDeaths”).

## Mensajes y emojis
El sistema integra el **sistema de emojis custom**. Los textos pasan por `applyCustomEmojisToText` antes de enviar `tellraw`.

### Placeholders disponibles
| Placeholder | Descripción |
| --- | --- |
| `<Player>` | Nombre del jugador muerto |
| `<Target>` | Alias de `<Player>` |
| `<Killer>` | Nombre del killer (o `killerUnknown`) |

### Causas soportadas
- `slainByPlayer`
- `slainByZombie`
- `slainBySkeleton`
- `slainByCreeper`
- `shotByArrow`
- `fall`
- `lava`
- `fire`
- `drowning`
- `explosion`
- `void`
- `default` (fallback obligatorio)

## Notas
- El sistema usa `entityDie` y resuelve la causa desde `damageSource`.
- Evita inicializar objectives locales: el init central debe crear `muertes`, `vip`, `D`, `H`.
