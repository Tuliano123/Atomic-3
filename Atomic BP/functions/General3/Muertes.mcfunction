#SISTEMA PARA DETECTAR LA MUERTE DEL JUGADOR


##Identificar Jugador Muerto
scoreboard players set @a[scores={muerto=!2}] muerto 0
scoreboard players set @e[type=player] muerto 1

##Set Scores A Jugador Muerto
scoreboard players add @a[scores={muerto=0}] M 1
scoreboard players set @a[scores={muerto=0}] MsgMuerte 1

##Reset Sistema Muerte
scoreboard players set @a[scores={muerto=0}] muerto 2
