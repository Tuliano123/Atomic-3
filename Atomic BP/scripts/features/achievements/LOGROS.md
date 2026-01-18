# Logros

Este documento lista los logros del servidor y define el **formato** y la **estructura** para crear nuevos logros.

## Objetivo

- Mantener el sistema dinámico y escalable.
- Estandarizar cómo se define y se valida cada logro.

## Reglas generales

1) **Mensaje de logro (tellraw)**

Formato base (se usará `/tellraw`):

"§--------------------\n
§l§p LOGRO ALCANZADO§r§f\n
<NombreLogro>\n
§f<DescripcionLogro>\n
\n
§l§gRECOMPENSAS§r\n
§8<LogrosActuales-1>/<LogrosTotales> ->§e <LogrosActuales>/<LogrosTotales>§f\n
Obtener logros provocara\n
una mejora permanente\n
en los :heart:\n
§e--------------------"

- Habrá **2 variantes** de color (misma estructura, colores distintos).
- `\n` representa salto de línea.
- El mensaje solo se envía al jugador que obtuvo el logro.

2) **Logros only-one-time**

- Solo se usan **scoreboards** (no Dynamic Properties).
- Cada logro tiene un objetivo propio: `Logro_<id> = 0/1`.
- Si `Logro_<id> == 1`, ya está completado y no puede repetirse.

3) **Recompensa por acumulados (cada 10 logros)**

- Cuando el total de logros del jugador llegue a **10, 20, 30, 40, 50**:
  - Se suma 1 al objective `Corazones`.
  - Límite: `Corazones <= 5`.
- La vida extra se aplica con **health_boost**:
  - `Corazones = 1` → `/effect <jugador> health_boost infinite 0 true` (2 corazones extra)
  - Persistencia: el script reaplica el efecto si el jugador muere.

4) **LogrosTotal dinámico**

- Existe un objective global `LogrosTotal`.
- Su valor se calcula automáticamente con `config.achievements.length`.
- Se usa en el tellraw para `<LogrosTotales>`.

5) **Límite de 25 caracteres por línea**

- Aplica **solo** a texto visible (caracteres normales).
- Códigos de color `§x` **no cuentan**.
- Si una palabra supera el límite, **no se corta**: se mueve a la línea siguiente.

Ejemplo:

"Este es un caso de ejemplificación" →
"Este es un caso de\nejemplificación"

## Plantilla para nuevos logros

Usa este formato para agregar un logro nuevo:

**ID interno**: `Logro_<id>`

**Condición:**
- Tipo: `scoreboard` | `evento` | `posicion` | `proximidad`
- Objetivo (si aplica): `<objective>`
- Regla: `>=`, `<=`, `==`
- Valor: `<numero>`

**Nombre:**
- `<NombreLogro>`

**Descripción:**
- `<DescripcionLogro>` (debe incluir color, ej. `§fTexto...`)

**Notas opcionales:**
- Detalles para validación o casos especiales.

**Target (opcional):**
- `@s` → solo quien lo obtuvo
- `@a` → broadcast

Ejemplo:

target: "@s" // solo quien lo obtuvo (ejemplo de uso futuro)

## Nueva condición: area

Se soporta `type: "area"` con esquinas `from` y `to` (AABB). El logro se cumple si el jugador está dentro (bordes incluidos).

Ejemplo:

conditions: [
   {
      type: "area",
      from: { x: 104, y: 104, z: 104 },
      to:   { x: 0,   y: 0,   z: 0   },
   },
]

## Partículas al desbloquear

- Se usa `minecraft:totem_particle`.
- Se genera en la posición del jugador (`~ ~ ~`).
- Solo la ve el jugador que obtiene el logro.

## Lista de logros y su obtención

> Nota: los objetivos de tiempo (`segundos`, `minutos`, `horas`, `dias`) son acumulativos.

1) **Juega durante 10 minutos o más**
   - Condición: `minutos >= 10`
   - Nombre: `§gUn Inicio`
   - Descripción: `Juega durante 10 minutos o más`

2) **Juega durante 1 hora o más**
   - Condición: `horas >= 1`
   - Nombre: `§gPasando el rato`
   - Descripción: `Juega durante 1 hora o más`

3) **Acércate a un admin (tag SX) a 3 bloques o menos**
   - Condición: distancia <= 3 a un jugador con tag `SX`
   - Nombre: `§7¿Y el admin?`
   - Descripción: `Acerca a un admin a 3 bloques o menos`

4) **Llega a Y = 186 o más**
   - Condición: `posY >= 186`
   - Nombre: `§7Ruta al cielo`
   - Descripción: `Llega al cielo.`

5) **Mata 100 mobs**
   - Condición: `mobs >= 100`
   - Nombre: `§sMonster Slayer`
   - Descripción: `Acaba con 100 o más mobs`

6) **Muere 100 veces**
   - Condición: `muertes >= 100`
   - Nombre: `§7Visitante Frecuente`
   - Descripción: `Muere en 100 ocasiones`

7) **Elimina 100 jugadores**
   - Condición: `Se >= 100`
   - Nombre: `§4Slayer`
   - Descripción: `Elimina a 100 Jugadores`

8) **Juega 10 horas o más**
   - Condición: `horas >= 10`
   - Nombre: `§6Un tiempo`
   - Descripción: `Juega 10 horas o más tiempo.`

9) **Juega 10 días o más**
   - Condición: `dias >= 10`
   - Nombre: `§8opmieT`
   - Descripción: `Juega 10 días o más`

10) **Obtén 1,000 de Dinero**
    - Condición: `D >= 1000`
    - Nombre: `§eBaul de Oro`
   - Descripción: `§fObtén 1,000 de Dinero`

11) **Muere 500 veces**
    - Condición: `muertes >= 500`
    - Nombre: `§hInquilino`
   - Descripción: `§fMuere en 500 ocasiones`

12) **Obtén 50,000 de Dinero**
    - Condición: `D >= 50000`
    - Nombre: `§gTesoro Dorado`
   - Descripción: `§fObtén 50,000 de Dinero`

13) **Compra una parcela**
    - Condición: `Parcela >= 1`
    - Nombre: `§7¡Seguridad de Propiedad!`
   - Descripción: `§fCompra una Parcela`

14) **Muere 2,500 veces**
    - Condición: `muertes >= 2500`
    - Nombre: `§8Habitante Local`
   - Descripción: `§fMuere en 2,500 ocasiones`