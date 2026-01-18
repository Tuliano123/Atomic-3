# Sistema de muerte (BP)

Ruta: `Atomic BP/scripts/systems/death/`

## Objetivo
Reemplazar los mensajes vanilla de muerte (con `showdeathmessages=false`), emitir mensajes globales personalizados y aplicar pérdida de dinero según reglas VIP.

## Requisito global
- **Desactivar mensajes vanilla:** `gamerule showdeathmessages false`

## Scoreboards requeridos
> No se inicializan aquí. Deben existir desde el init central.

- `muertes` (contador de muertes del jugador)
- `D` (dinero)
- `vip` (nivel VIP, 0 si no aplica)
- `H` (habilitación del sistema skills; actualmente no cambia el resolver)

## Configuración
Archivo: [Atomic BP/scripts/systems/death/config.js](../../scripts/systems/death/config.js)

### Ejemplo
```js
export default {
  debug: false,

  emojis: { enabled: true },

  moneyLoss: {
    enabled: true,
    graceDeaths: 3,
    normalLossPercent: 30,
    vipRules: {
      1: { mode: "fraction", numerator: 1, denominator: 4 },
      2: { mode: "fraction", numerator: 1, denominator: 5 },
      3: { mode: "fraction", numerator: 1, denominator: 10 },
      4: { mode: "none" }
    },
    lossTellraw: "§7¡Has perdido §g<Cantidad>§7!",
  },

  warnings: {
    enabled: true,
    warningTellraw: "§7Perderás <CantidadPerder>% de tu dinero...",
  },

  deathMessages: {
    broadcastTarget: "@a",
    killerUnknown: "Desconocido",
    deathCauses: {
      slainByPlayer: "<Target> ha sido asesinado por <Killer>",
      slainByZombie: "<Target> ha sido asesinado por un Zombie",
      slainBySkeleton: "<Target> ha sido asesinado por un Esqueleto",
      slainByCreeper: "<Target> voló en pedazos por un Creeper",
      shotByArrow: "<Target> ha sido alcanzado por una Flecha",
      fall: "<Target> se cayó desde muy alto",
      lava: "<Target> intentó nadar en lava",
      fire: "<Target> se quemó",
      drowning: "<Target> se ahogó",
      explosion: "<Target> explotó",
      void: "<Target> cayó al vacío",
      default: "<Player> ha muerto"
    },
    specialDeathMessages: [
      { name: "Anthe", message: "<Player> ha muerto porque si" }
    ],
    vipDefault: "<Player> ha muerto"
  }
};
```

## Placeholders disponibles
| Placeholder | Descripción |
| --- | --- |
| `<Player>` | Nombre del jugador muerto |
| `<Target>` | Alias de `<Player>` |
| `<Killer>` | Nombre del killer (o `killerUnknown`) |

## Causas soportadas
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

## Flujo
1) Incrementa `muertes` (+1).
2) Resuelve mensaje con prioridad VIP (VIP > causa).
3) Emite mensaje global a `broadcastTarget`.
4) Aplica pérdida de dinero o warning según reglas.

## Entrypoint
- [Atomic BP/scripts/main.js](../../scripts/main.js)
