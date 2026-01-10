# Custom Emojis (Atomic)

Esta feature convierte símbolos Unicode "normales" que escriben los jugadores (ej. `☠`, `✿`, `✚`) en caracteres Private Use (PUA) `U+Exxx` que Bedrock renderiza como emojis/glyphs.

## Qué resuelve
- Chat y lore sin que el texto cambie a fuente fallback.

## Cómo funciona
- En BP: se reemplazan caracteres (ej. `☠`) -> `U+E302`.
- En RP: se proveen hojas de glifos en `RP/font/`.

### Sheets
- `glyph_E3.png`: 256x256, celdas 16x16 (`U+E3RC`).
- `glyph_E4.png`: 256x256, celdas 16x16 (`U+E4RC`).

Cada celda corresponde a un codepoint:
  - Fila/columna en hex: `U+E3RC`.
  - Ej: (fila 0, col 2) => `U+E302`.

## Prefijos (shortcodes)
Además de escribir el símbolo (ej. `☠`), se soportan prefijos:
- Shortcodes "humanos" (configurables): ej. `:skull:`.
- Shortcode directo por PUA: `:e302:` o `:e4A0:` (también `:e4_A0:`).

La lista de shortcodes "humanos" se define en:
- `scripts/features/custom-emojis/shortcodes.js`

## Compatibilidad / buenas prácticas
- Minecraft Bedrock **sí** interpreta glyph sheets en `RP/font/` para estos caracteres PUA.
- No es un método oficialmente documentado por Mojang para creators (se usa ampliamente; úsalo con cautela).
- Para reducir conflictos con otros packs, usamos `E3xx` (las hojas `E2..F8` suelen estar libres en vanilla).

## Mapeo
El mapeo principal está en:
- `scripts/features/custom-emojis/packs/atomicEssential.js`

Fuentes de verdad (edición):
- `RP/font/mapping.atomic-essential.json` (E3)
- `RP/font/mapping.atomic-e4.json` (E4)

Notas:
- `★`, `☆`, `❤` se mapean a emojis vanilla (`U+E107`, `U+E106`, `U+E10C`) para evitar tener que dibujarlos.
- El resto usa `U+E300..` y requiere dibujar los iconos en el RP.
