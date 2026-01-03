# AntiCheat Catalogs

Estos catálogos definen **qué items/bloques están prohibidos** en el servidor.

## Formato

Cada catálogo tiene:

- `version`: número
- `items` o `blocks`: array de entradas

Entrada:

```json
{ "id": 0, "typeId": "minecraft:bedrock", "name": "Bedrock", "notes": "..." }
```

Campos:
- `id`: número (puede ser decimal si deseas agrupar variantes)
- `typeId`: string (`minecraft:...`)
- `name`: nombre humano (para leerlo fácil)
- `notes`: (opcional) motivo/notas
- `variant`: (opcional) metadatos, por ejemplo light level

## Importante

- Algunos `typeId` como `minecraft:water`, `minecraft:lava` o `minecraft:fire` **no existen como items legítimos**, pero pueden aparecer por hacks/editores.
- En esos casos, se dejan en el catálogo para que el check los trate como positivo fuerte.
