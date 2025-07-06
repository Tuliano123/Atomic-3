#SISTEMA PARA TEPEAR JUGADORES AL MOMENTO DE UNIRSE

scoreboard players add @a unido 0
tp @a[scores={unido=0},tag=!SX] 0 29 0 90 0
scoreboard players reset * unido
scoreboard players set @a unido 1