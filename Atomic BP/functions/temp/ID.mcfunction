scoreboard players add @a ID 0
scoreboard players add @a IDAsignada 0

execute if entity @a[scores={ID=0}] run scoreboard players add TotalIDs ID 1
scoreboard players operation @r[scores={ID=0}] ID = TotalIDs ID
execute if entity @a[scores={IDAsignada=0,ID=1..}] run tellraw @a {"rawtext":[{"text":"§e"},{"selector":"@a[scores={IDAsignada=0,ID=1..}]"},{"text":" es la persona Num. "},{"score":{"name":"TotalIDs","objective":"ID"}}]}
scoreboard players set @a[scores={IDAsignada=0,ID=1..}] IDAsignada 1