#SISTEMA DE SET SPAWNS


scoreboard players add @a limbo 0
spawnpoint @a[scores={limbo=0}] -2 5 -191
spawnpoint @a[scores={limbo=1}] 0 29 0
execute as @a[scores={ExcMuerte=1}] at @s run spawnpoint @s ~~~

###Limbo 0 es general y limbo 1 es para los vips