# Logros

Este documento listara los diferentes logros dentro del servidor; Estos logros no son solamente del Modo Historia si no que son de diferentes areas.

## Objetivo

- Aplicar dinamismo en todo el codigo para facilidad de implementación y considerar escalabilidad
- Implementar componentes para su uso posterior

## Apuntes

1) Cada logro tiene una condición una vez cumplida esta condición se mandara un mensaje al jugador con el siguiente formato
    "§--------------------\n
    §l§p LOGRO ALCANZADO§r§f\n
    §g<NombreLogro>\n
    §f<DescripcionLogro>\n
    \n
    §l§gRECOMPENSAS§r§f\n
    §80/<LogrosTotales> ->§e <LogrosActuales>/<LogrosTotales>§f\n
    Obtener logros provocara\n
    una mejora permanente\n
    en los :heart:\n
    §e--------------------"

- Habra 2 de este formato ebido a que los colores cambiaran pero las variables empleadas seran las mismas
- \n significa salto de linea
- Todo esto es un tellraw hacia el jugador que alcanzo el logro
- Hacer el formato dinamico para que sea facil armarlo

2) Los logros NO se pueden repetir son "only-one-time"
- Si el jugador completa el logro x ya no podra volver a hacer el logro x pero si los logros que aún no ha realizado

3) Cada vez que un jugador alcance 10 logros acumulados (10, 20, 30, 40... en Total)
- Se le sumara 1 en el objective "Corazones" con el comando /scoreboard players add <Jugador> Corazones 1 o con getObjectives()
- Solo se hará cada 10 y tendrá un limite de 5; Si el jugador tiene 5 de scoreboard en Corazones ya no se le sumara.

## Como funciona

### Ingresar funcionamento //

## Lista de logros y su obtención:

