En el servidor existirá una estadistica por niveles la cual será llamada "mining", mining tiene los siguientes trabajos:

Gestionar niveles de la skill; Requerimos algún metodo donde podamos delimitar los niveles para que sea algo como

Nivel 0: 0 XP
Nivel 1: 20 XP
Nivel 2: 100 XP

Entonces el jugador empieza en Nivel 0; Sin XP, si consigue XP puede subir de nivel, con 20 sube al nivel 1, con 100 al nivel 2, pero nunca puede tener varios niveles a la vez; Si no que va subiendo de acuerdo a su XP; y tampoco se reinicia su XP, si no que se acumula
*Lo recomendable es crear un archivo de configuración como config.js y establecer un contrato; La cantidad de niveles serán 60 por el momento y es posible que algunos tengan requisitos

Requisitos de Niveles:

Es posible que ciertos niveles, como 51, 3, u otro tengan un requerimiento adicional a la XP
Por ejemplo

Nivel 3: 500 XP + Acto 1

Acto es un scoreboard; Entonces para que el jugador alcance el nivel 3 requiere el scoreboard de Acto en 1; Además del de XP
La XP se manejara con scoreboards; Para almacenar sin usar tanta memoría se crearan scoreboards y se guardara su nivel y su experiencia allí

Los scoreboards a emplear son:
