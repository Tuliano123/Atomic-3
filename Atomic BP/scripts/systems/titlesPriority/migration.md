# Objetivo

Crear titleraws en actionbar con prioridad; Ya que solo se puede ver uno a la vez entonces estableceriamos un contrato donde declarariamos en un arreglo la prioridad de cada uno con variables; Usando un archivo de config.js para añadir; quitar titleraws

# Migración

Anteriormente se utilizaba "Coo" o "CooMayor" para la prioridad; el problema es la falta de orden ya que todo se encuentra revuelto y tiende a fallar si hay dos activos a la vez; Por eso es mejor migrarlo a una prioridad numerica y por jerarquia temporal

## Plan

crear un archivo de config para colocar los diversos titleraws con formatos, serán titleraws debido a que es posible incluir selectores y scoreboards dentro del texto sin tener que implementar logica por parte de script y ahorrar codigo

Si se tiene una mejor solución o propuesta este sistema puede cambiar, así que considerar que este se encuentra en continuo cambio y hay que considerar escalabilidad

Ejemplo de config en pseudocodigo (Considerar que es una ejemplificación de uso)

```js
export default {
	debug: false,

	emojis: {
		// Import obligatorio del sistema de emojis custom (depende de tu proyecto)
		enabled: true,
	},

    titles: [
        {
            id: "Lobby",
            content: ["Este es un titleraw que se usara en un lobby","Y este es otra linea", "Y aquí podemos ver un scoreboard: ${D:@s}"]
			priority: 10
			display_if: {
				area: {
					to:{x: 100, y: 100, z: 100}, 
					at: {x: 0, y: 0, z: 0}
				},
				score: {
					objective: "D",
					condition: ">=",
					int: 100
				}
			}
		},
    ]
}
```

### Sobre el ejemplo

En el ejemplo podemos ver un codigo burdo sobre como sería la configuración, explicando de eso; vemos un id, que funge como identificador unico para cada uno de los titles; De allí tenemos el contenido que es un array debido a que puede llegar a tener saltos de linea.
La prioridad es una variable que usaremos para presentar el display; si el jugador cumple con condiciones para multiples titles solo se reflejara UNO; El que tenga la prioridad más alta

De allí tenemos las condiciones para ver el title en actionbar; siempre en actionbar
Tenemos 2 tipos de consideraciones dentro del display_if; la area y el score
sobre el area: esta es una condición que es true si el jugador esta dentro de esa area en la dimensión del overworld (Considerar solo overworld; No es necesario considerar nether o end)
sobre el score: Consideraremos el nombre del objective y además un operador condicionante como lo son "==, !=, >=, <=, >, <" y el valor a comparar; La comparación será personal; Extrapolandolo al ejemplo:
El title del ejemplo solo se mostraría si el jugador esta en el area indicada y su scoreboard en "D" es mayor o igual a 100; Y solo si no hay otro title con condiciones cumplidas con una prioridad más alta

Dentro del content podemos ver ${D:@s}
basicamente se elige el scoreboard "D" y el selector del scoreboard es "@s", entonces ahí debería mostrar el numero que el jugador tiene en el scoreboard D, así que todos los que vean este title verían su valor de D

## Consideraciones

Aplicar buenas practicas y considerar escalabilidad