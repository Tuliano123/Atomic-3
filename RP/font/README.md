# RP/font (Custom Emojis)

Este pack usa glyph sheets para mostrar iconos en texto (chat, lore, carteles, etc.).

Bedrock carga automáticamente los glyph sheets ubicados en `RP/font/` cuando existen y cuando se usan caracteres PUA `U+Exxx` en el texto.

## Sheets
- `font/glyph_E3.png` (E3 / 16x16)
- `font/glyph_E4.png` (E4 / 32x32)

## Archivo auxiliar (solo edición)
- `font/glyph_grid.png` (plantilla de grilla, NO la usa Minecraft)

Importante:
- No dibujes líneas de grilla dentro de `glyph_E3.png`. Cualquier pixel en los bordes de cada celda puede verse en juego como “borde” (especialmente arriba/izquierda).
- Usa `glyph_grid.png` como overlay en tu editor (encima de `glyph_E3.png`) y exporta `glyph_E3.png` sin la grilla.

## Tamaño esperado (E3)
- 256x256 px
- 16x16 celdas
- Cada celda: 16x16 px

## Tamaño esperado (E4)
- En juego (`glyph_E4.png`): 256x256 px, 16x16 celdas, cada celda 16x16 px.
- Master de edición (opcional): `glyph_E4.master512.png` (512x512, 32px por celda) para trabajar cómodo y luego convertir.

## Reglas de dibujo (E3)
- Dibujar cada icono en un bloque de 8x8 dentro de su celda 16x16.
- Centrado y 1px más arriba (offset Y = -1).
- E3 usa sombreado manual: blanco + sombra #7F7F7F.
- Mantener bordes de celda limpios (sin grilla, sin pixeles tocando el borde si no es necesario).

## Reglas de dibujo (E4)
- En el master 32x32, el icono vive en un área útil 16x16 (centrado, offset Y = -1).
- En el export final para el juego (`glyph_E4.png`), el icono queda en 16x16 (ancho estándar del chat).
- Se permiten niveles de gris (alpha) para mayor fidelidad.

Nota:
- Durante ajuste/QA se puede dibujar un marco rojo 16x16 y punto central, pero el export final recomendado es sin esos overlays.

## Celdas “fijas”
Estas celdas se consideran legacy y se rehacen manualmente para que queden fieles:
- E32E, E32F, E334, E335, E37D, E37E, E37F

## Cómo se asigna un icono a un carácter
- Cada celda corresponde a `U+E3RC` (hex)
  - R = fila (0..F)
  - C = columna (0..F)
- Ejemplos:
  - U+E300 = fila 0, col 0
  - U+E30A = fila 0, col A
  - U+E310 = fila 1, col 0

## Qué dibujar
Consulta los mappings en:
- `font/mapping.atomic-essential.json` (E3)
- `font/mapping.atomic-e4.json` (E4)

Nota:
- Se omiten completamente los símbolos "circled" (números/letras) y no se generan en los maps.

Recomendación:
- Fondo transparente.
- Prioriza legibilidad a 1x (escala del chat).

## Sources
- La carpeta `font/examples/` fue eliminada (las imágenes fuente no se versionan aquí).
