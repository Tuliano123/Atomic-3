scoreboard players add @a ticksegundos 1

execute as @a[scores={ticksegundos=20..}] run scoreboard players add @s segundos 1
execute as @a[scores={ticksegundos=20..}] run scoreboard players remove @s ticksegundos 20

execute as @a[scores={segundos=60..}] run scoreboard players add @s minutos 1
execute as @a[scores={segundos=60..}] run scoreboard players remove @s segundos 60

execute as @a[scores={minutos=60..}] run scoreboard players add @s horas 1
execute as @a[scores={minutos=60..}] run scoreboard players remove @s minutos 60

execute as @a[scores={horas=24..}] run scoreboard players add @s dias 1
execute as @a[scores={horas=24..}] run scoreboard players set @s horas 0