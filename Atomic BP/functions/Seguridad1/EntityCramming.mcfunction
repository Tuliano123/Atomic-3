#SISTEMA PARA EVITAR MULTIPLES ENTIDADES EN UN MISMO BLOQUE


scoreboard players set @e[tag=EntityCramming] EntityCramming 0
##Set Score
scoreboard players set @r[tag=EntityCramming,type=npc] EntityCramming 1
scoreboard players set @r[tag=EntityCramming,type=armor_stand] EntityCramming 1
scoreboard players set @r[tag=EntityCramming,type=villager] EntityCramming 1
##Kill
execute as @e[scores={EntityCramming=1}] at @s if entity @e[scores={EntityCramming=0},r=0.001] run tp @e[scores={EntityCramming=0},r=0.001] -515 1 195
##Asignar Entidades
tag @e[type=npc] add EntityCramming
tag @e[type=armor_stand] add EntityCramming
tag @e[type=villager] add EntityCramming