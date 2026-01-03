
scoreboard players set @r[tag=!SX] FillBeeHiveNest 1
execute at @a[scores={FillBeeHiveNest=1}] run fill ~8 ~8 ~8 ~-8 ~-8 ~-8 composter ["composter_fill_level"=8] replace beehive
tag @e[type=item,name="Bone Meal"] add NoBee
execute at @a[scores={FillBeeHiveNest=1}] run fill ~8 ~8 ~8 ~-8 ~-8 ~-8 beehive replace composter ["composter_fill_level"=8]
execute if entity @e[type=item,tag=!NoBee,name="Bone Meal"] run tellraw @a {"rawtext":[{"text":"§c"},{"selector":"@a[scores={FillBeeHiveNest=1}]"},{"text":" ha infringido las normas del servidor y ha sido §4Baneado, §f1"}]}
execute if entity @e[type=item,tag=!NoBee,name="Bone Meal"] run tag @a[scores={FillBeeHiveNest=1}] add BANhacks
execute at @e[type=item,tag=!NoBee,name="Bone Meal"] align xyz run fill ~~~ ~~~ air replace beehive
kill @e[type=item,tag=!NoBee,name="Bone Meal"]

scoreboard players set @a[scores={FillBeeHiveNest=1}] FillBeeHiveNest 2
execute at @a[scores={FillBeeHiveNest=2}] run fill ~8 ~8 ~8 ~-8 ~-8 ~-8 composter ["composter_fill_level"=8] replace bee_nest
tag @e[type=item,name="Bone Meal"] add NoBee
execute at @a[scores={FillBeeHiveNest=2}] run fill ~8 ~8 ~8 ~-8 ~-8 ~-8 bee_nest replace composter ["composter_fill_level"=8]
execute if entity @e[type=item,tag=!NoBee,name="Bone Meal"] run tellraw @a {"rawtext":[{"text":"§c"},{"selector":"@a[scores={FillBeeHiveNest=2}]"},{"text":" ha infringido las normas del servidor y ha sido §4Baneado, §f2"}]}
execute if entity @e[type=item,tag=!NoBee,name="Bone Meal"] run tag @a[scores={FillBeeHiveNest=2}] add BANhacks
execute at @e[type=item,tag=!NoBee,name="Bone Meal"] align xyz run fill ~~~ ~~~ air replace bee_nest
kill @e[type=item,tag=!NoBee,name="Bone Meal"]

scoreboard players set @a[scores={FillBeeHiveNest=2}] FillBeeHiveNest 3
execute at @a[scores={FillBeeHiveNest=3}] run fill ~8 ~8 ~8 ~-8 ~-8 ~-8 composter ["composter_fill_level"=8] replace end_portal
tag @e[type=item,name="Bone Meal"] add NoBee
execute at @a[scores={FillBeeHiveNest=3}] run fill ~8 ~8 ~8 ~-8 ~-8 ~-8 end_portal replace composter ["composter_fill_level"=8]
execute if entity @e[type=item,tag=!NoBee,name="Bone Meal"] run tellraw @a {"rawtext":[{"text":"§c"},{"selector":"@a[scores={FillBeeHiveNest=3}]"},{"text":" ha infringido las normas del servidor y ha sido §4Baneado, §f3"}]}
execute if entity @e[type=item,tag=!NoBee,name="Bone Meal"] run tag @a[scores={FillBeeHiveNest=3}] add BANhacks
execute at @e[type=item,tag=!NoBee,name="Bone Meal"] align xyz run fill ~~~ ~~~ air replace end_portal
kill @e[type=item,tag=!NoBee,name="Bone Meal"]

scoreboard players reset @a[scores={FillBeeHiveNest=1..}] FillBeeHiveNest

execute at @a[tag=!SX] run fill ~15 ~15 ~15 ~-15 ~-15 ~-15 air replace portal

