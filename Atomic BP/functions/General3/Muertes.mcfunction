#SISTEMA PARA DETECTAR LA MUERTE DEL JUGADOR


##Identificar Jugador Muerto
scoreboard players set @a[scores={muerto=!2}] muerto 0
scoreboard players set @e[type=player] muerto 1

##Set Scores A Jugador Muerto
scoreboard players add @a[scores={muerto=0}] M 1
scoreboard players set @a[scores={muerto=0}] MsgMuerte 1

##Claurina Del Limbo
execute as @a[scores={muerto=0,limbo=0,ExcMuerte=0},hasitem={item=silence_armor_trim_smithing_template}] run scoreboard players random @s limbo 2 3
execute as @a[scores={muerto=0,limbo=2..3},hasitem={item=silence_armor_trim_smithing_template}] run scoreboard players set @s dhlim 15
###Spawnpoints Limbo
spawnpoint @a[scores={limbo=2}] -2 5 -191
spawnpoint @a[scores={limbo=3}] 0 29 0
scoreboard players remove @a[scores={dhlim=2..}] dhlim 1
###Limbo2
tellraw @a[scores={limbo=2,dhlim=2}] {"rawtext":[{"text":"§uLa Claurina no ha funcionado"}]}
tp @a[scores={limbo=2,dhlim=2}] -2 5 -191
###Limbo 3
tellraw @a[scores={limbo=3,dhlim=2}] {"rawtext":[{"text":"§bLa Claurina ha funcionado..."}]}
tp @a[scores={limbo=3,dhlim=2}] 0 29 0
###Clear Playsounds Y Reset Sistema
clear @a[scores={limbo=2..3,dhlim=2}] silence_armor_trim_smithing_template 0 1
execute as @a[scores={limbo=2,dhlim=1}] at @s run playsound item.trident.thunder @s ~~~
execute as @a[scores={limbo=3,dhlim=1}] at @s run playsound shriek.sculk_shrieker @s ~~~
scoreboard players set @a[scores={limbo=2..3,dhlim=1}] limbo 0
scoreboard players set @a[scores={dhlim=1}] dhlim 0

##Reset Sistema Muerte
scoreboard players set @a[scores={muerto=0}] muerto 2
