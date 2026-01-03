scoreboard players set @a[x=-50,y=0,z=-230,dx=100,dy=35,dz=100] NoTpUnido 1
execute as @a unless entity @s[x=-50,y=0,z=-230,dx=100,dy=35,dz=100] run scoreboard players set @s NoTpUnido 0

scoreboard players add @a unido 0
tp @a[scores={unido=0,NoTpUnido=0},tag=!SX] 0 29 0 90 0
scoreboard players reset @a unido
scoreboard players set @a unido 1
