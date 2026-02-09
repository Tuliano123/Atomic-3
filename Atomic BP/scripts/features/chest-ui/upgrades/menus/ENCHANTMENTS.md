# Enchantments System - Especificación Técnica

> **Versión**: 1.0.0  
> **Minecraft Bedrock**: 1.21.132  
> **Script API**: `@minecraft/server` 2.4.0, `@minecraft/server-ui` 2.0.0  
> **Última actualización**: Febrero 2026

---

## 1. Resumen Ejecutivo

Este documento especifica el sistema de **encantamientos cosméticos** (lore-based) para el Chest UI de Upgrades. El sistema permite a los jugadores aplicar encantamientos a sus items mediante una interfaz de usuario basada en `ChestFormData`.

### 1.1 Historia de Usuario

> *"Yo como jugador hago clic en el libro encantado que aparece en la interfaz que dice 'Encantamientos de herramienta'. Se abre otro menú donde veo un listado de los encantamientos disponibles para mi armadura. Hago clic en 'Protección' y me lleva a otro menú donde aparecen varios libros encantados (7 en total). Al pasar el cursor por el primero dice 'Protección I', el segundo 'Protección II' y así sucesivamente. Noto que desde el segundo hay un cambio de color y descripciones diferentes. Al hacer clic en 'Protección II', se cierra el menú, pierdo un libro de mi inventario que decía 'Protección II', y el item en mi mano ahora muestra 'Protección II' en su lore. Además, el item ahora tiene glint activado."*

### 1.2 Alcance por Fases (UI vs. Efectos)

Para mantener el sistema mantenible y evitar acoplar UI con mecánicas de combate/minería, los encantamientos se clasifican por **tipo de implementación**:

- **Tipo A (Lore/Stats)**: su efecto es **numérico y determinista** y se refleja modificando el lore del item (ej: “+15 Daño”). En esta fase se implementan **solo** los Tipo A.
- **Tipo B (Integración con sistemas existentes)**: requiere que el daño/defensa/etc. del servidor use el encantamiento como multiplicador o regla (ej: “Castigo” multiplica daño a no-muertos). No se implementa en esta fase.
- **Tipo C (Sistema propio + integración)**: requiere un sistema adicional (ej: estados, hologramas, probabilidades acumulativas) además de integrarse con combate/minería. No se implementa en esta fase.

> Nota: Un encantamiento puede tener descripción “mixta” (ej. muestra un multiplicador y también modifica un stat). En esta fase, **solo se aplican las partes Tipo A** (modificaciones numéricas en lore). Las partes B/C quedan como “informativas” en UI hasta implementar su sistema real.

---

## 2. Arquitectura de Menús

### 2.1 Jerarquía de Navegación

```text
upgradesPrimaryMenu (Menú Principal de Mejoras)
└── enchantsMenu (Menú de Encantamientos - ACTUAL)
    └── enchantsSelectionMenu (Selección de Encantamiento)
        └── enchantsApplicationMenu (Aplicación de Nivel)
```

### 2.2 Flujo de Usuario

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUJO DE ENCANTAMIENTOS                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [upgradesPrimaryMenu]                                                      │
│         │                                                                   │
│         ▼ Clic en "Encantamientos de herramienta"                          │
│  [enchantsMenu] ◄──────────────────────────────────────────────────┐       │
│         │                                                           │       │
│         ▼ (Actualmente vacío, 3x3 sin implementar)                 │       │
│  [enchantsSelectionMenu]                                            │       │
│         │ Muestra lista de encantamientos compatibles               │       │
│         │ (Ej: Protección, Filo, Eficiencia...)                    │       │
│         │                                                           │       │
│         ▼ Clic en un encantamiento                                 │       │
│  [enchantsApplicationMenu]                                          │       │
│         │ Muestra niveles del encantamiento seleccionado           │       │
│         │ (Ej: Protección I, II, III, IV, V, VI, VII)              │       │
│         │                                                           │       │
│         ├──▶ [Volver] ──────────────────────────────────────────────┘       │
│         │                                                                   │
│         ▼ Clic en nivel + Validaciones OK                                  │
│  [Aplicación del encantamiento]                                             │
│         │ - Verificar scoreboards                                          │
│         │ - Consumir item requerido del inventario                         │
│         │ - Modificar lore del item en mainhand                            │
│         │ - Activar glint si es primer encantamiento                       │
│         ▼                                                                   │
│  [Cerrar menú / Feedback al jugador]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Estructura de Archivos Propuesta

```text
scripts/features/chest-ui/upgrades/
├── menus/
│   ├── enchantsMenu.js              # Menú actual (entrada a encantamientos)
│   ├── enchants/                    # Carpeta para el sistema de encantamientos
│   │   ├── enchantsSelectionMenu.js # Lista de encantamientos disponibles
│   │   ├── enchantsApplicationMenu.js # Niveles del encantamiento seleccionado
│   │   ├── enchantsHelpers.js       # Funciones auxiliares (validación, aplicación)
│   │   └── enchantsConfig.js        # Configuración específica de encantamientos
│   └── ...
├── config.js                        # Configuración general de upgrades
├── loreReaders.js                   # Lectura/parsing de lore
├── loreWriters.js                   # Escritura/modificación de lore (a crear)
└── itemMirror.js                    # Utilidades de items
```

---

## 3. Configuración de Encantamientos

### 3.1 Estructura de Datos en `enchantsConfig.js`

```javascript
// scripts/features/chest-ui/upgrades/menus/enchants/enchantsConfig.js

/**
 * @typedef {Object} ScoreRequirement
 * @property {string} objective - Nombre del scoreboard
 * @property {">="|"=="|"<="|"!="} operator - Operador de comparación
 * @property {number} int - Valor entero a comparar
 */

/**
 * @typedef {Object} ItemRequirement
 * @property {string} name - Nombre exacto del item (nameTag) incluyendo códigos §
 * @property {number} quantity - Cantidad requerida (se consumirá del inventario)
 */

/**
 * @typedef {Object} LevelConfig
 * @property {number[]} level - Niveles que abarca esta configuración [1] o [2,3,4,5]
 * @property {string} color - Código de color para el nombre (ej: "§e")
 * @property {string} rarity - Key de rareza (debe existir en upgradesUiConfig.rarities)
 * @property {string[]} levelDescription - Lore del botón, soporta placeholders
 * @property {Object} requirement - Requerimientos para aplicar
 * @property {ScoreRequirement[]} [requirement.scores] - Verificaciones de scoreboard
 * @property {ItemRequirement[]} [requirement.items] - Items a consumir
 */

/**
 * @typedef {Object} EnchantmentDefinition
 * @property {number} id - ID único, determina orden de display
 * @property {string} name - Nombre base del encantamiento
 * @property {string} colorName - Color por defecto para el nombre
 * @property {string[]} mainDescription - Descripción general (enchantsSelectionMenu)
 * @property {number} maxLevel - Nivel máximo del encantamiento
 * @property {string[]} compatible - Categorías compatibles (sword, armor, etc.)
 * @property {LevelConfig[]} levelsMenu - Configuración por nivel/rango de niveles
 */

/** @type {EnchantmentDefinition[]} */
export const enchantmentsData = [
    {
        id: 1,
        name: "Protección",
        colorName: "§t",
        mainDescription: [
            "",
            "§r§7Reduce el daño recibido de",
            "§r§7la mayoría de fuentes.",
            "",
            "§r§8Compatible: Armaduras",
            "",
            "§r§eClic para ver niveles",
        ],
        maxLevel: 6,
        compatible: ["armor", "helmet", "boots"],
        levelsMenu: [
            {
                level: [1],
                color: "§e",
                rarity: "rare",
                levelDescription: [
                    "§r§7Reduce el daño recibido",
                    "§r§7en un §a4%§7.",
                    "",
                    "§r§8Rareza: <rarity>",
                    "",
                    "<action>",
                ],
                requirement: {
                    scores: [
                        { objective: "Nivel", operator: ">=", int: 10 },
                    ],
                    items: [
                        { name: "§r§eProtección I", quantity: 1 },
                    ],
                },
            },
            {
                level: [2, 3, 4, 5, 6],
                color: "§6",
                rarity: "very_rare",
                levelDescription: [
                    "§r§7Reduce el daño recibido",
                    "§r§7en un §a<percentage>%§7.",
                    "",
                    "§r§8Rareza: <rarity>",
                    "",
                    "<action>",
                ],
                requirement: {
                    scores: [
                        { objective: "Nivel", operator: ">=", int: 20 },
                    ],
                    items: [
                        { name: "§r§6Protección <roman>", quantity: 1 },
                    ],
                },
            },
        ],
    },
    {
        id: 2,
        name: "Filo",
        colorName: "§c",
        mainDescription: [
            "",
            "§r§7Aumenta el daño cuerpo",
            "§r§7a cuerpo de forma directa.",
            "",
            "§r§8Compatible: Espadas",
            "",
            "§r§eClic para ver niveles",
        ],
        maxLevel: 7,
        compatible: ["sword"],
        levelsMenu: [
            {
                level: [1, 2, 3],
                color: "§e",
                rarity: "rare",
                levelDescription: [
                    "§r§7Aumenta el daño base",
                    "§r§7en §c+<damage>§7 puntos.",
                    "",
                    "§r§8Rareza: <rarity>",
                    "",
                    "<action>",
                ],
                requirement: {
                    items: [
                        { name: "§r§eFilo <roman>", quantity: 1 },
                    ],
                },
            },
            {
                level: [4, 5, 6, 7],
                color: "§6",
                rarity: "epic",
                levelDescription: [
                    "§r§7Aumenta el daño base",
                    "§r§7en §c+<damage>§7 puntos.",
                    "",
                    "§r§8Rareza: <rarity>",
                    "",
                    "<action>",
                ],
                requirement: {
                    scores: [
                        { objective: "Kills", operator: ">=", int: 100 },
                    ],
                    items: [
                        { name: "§r§6Filo <roman>", quantity: 1 },
                    ],
                },
            },
        ],
    },
    // ... más encantamientos
];

/**
 * Configuración de UI para los menús de encantamientos
 */
export const enchantsMenuConfig = {
    // Slots del grid 3x3 (mismos que upgradesUiConfig.actionSlots)
    gridSlots: [14, 15, 16, 23, 24, 25, 32, 33, 34],
    
    // Paginación
    pagination: {
        nextSlot: 17,
        prevSlot: 35,
        nextButton: {
            itemName: "§r§aSiguiente",
            itemDesc: ["§r§7Ir a la siguiente página"],
            texture: "g/lime",
            enchanted: false,
        },
        prevButton: {
            itemName: "§r§cAnterior",
            itemDesc: ["§r§7Ir a la página anterior"],
            texture: "g/lime",
            enchanted: false,
        },
    },
    
    // Mirror del item (heredado del sistema actual)
    mirrorSlot: 20,
    
    // Botón de volver (heredado del sistema actual)
    backSlot: 29,
    backButton: {
        itemName: "§eVolver",
        itemDesc: ["§7Regresa al menú anterior."],
        texture: "i/gold_nugget",
        enchanted: false,
    },
    
    // Textura para los encantamientos
    enchantmentTexture: "i/enchanted_book",
    
    // Placeholders para descripciones
    placeholders: {
        rarity: "<rarity>",      // Se reemplaza por el texto de rareza formateado
        action: "<action>",       // Se reemplaza por el estado del encantamiento
        roman: "<roman>",         // Se reemplaza por el número romano del nivel
        percentage: "<percentage>", // Valores calculados dinámicamente
        damage: "<damage>",
    },
    
    // Textos de acción según estado
    actionTexts: {
        canApply: "§r§eClic para encantar",
        alreadyHasHigher: "§r§cEncantamiento actual superior",
        alreadyHasSame: "§r§cClic para desencantar",       // Cambiado: ahora permite desencantar
        confirmDisenchant: "§r§c¡Clic de nuevo para confirmar!", // Nuevo: estado de confirmación
        missingRequirements: "§r§cNo cumples los requisitos",
    },
    
    // Color para encantamientos en el lore (§9 = azul)
    enchantmentLoreColor: "§9",
    
    // Máximo de encantamientos por línea en el lore
    maxEnchantsPerLine: 2,
};
```

### 3.2 Utilidad de Números Romanos

```javascript
// En enchantsHelpers.js

/**
 * Convierte un número entero a su representación en números romanos.
 * @param {number} num - Número a convertir (1-3999)
 * @returns {string} Representación romana
 */
export function toRoman(num) {
    if (num < 1 || num > 3999) return String(num);
    
    const romanNumerals = [
        { value: 1000, numeral: "M" },
        { value: 900, numeral: "CM" },
        { value: 500, numeral: "D" },
        { value: 400, numeral: "CD" },
        { value: 100, numeral: "C" },
        { value: 90, numeral: "XC" },
        { value: 50, numeral: "L" },
        { value: 40, numeral: "XL" },
        { value: 10, numeral: "X" },
        { value: 9, numeral: "IX" },
        { value: 5, numeral: "V" },
        { value: 4, numeral: "IV" },
        { value: 1, numeral: "I" },
    ];
    
    let result = "";
    for (const { value, numeral } of romanNumerals) {
        while (num >= value) {
            result += numeral;
            num -= value;
        }
    }
    return result;
}

/**
 * Extrae el nivel numérico de un nombre de encantamiento con número romano.
 * @param {string} enchantName - Ej: "Protección VII"
 * @returns {number} Nivel numérico (0 si no se encuentra)
 */
export function extractLevelFromName(enchantName) {
    const romanMatch = enchantName.match(/\s([IVXLCDM]+)$/i);
    if (!romanMatch) return 0;
    return fromRoman(romanMatch[1]);
}

/**
 * Convierte número romano a entero.
 * @param {string} roman - Número romano
 * @returns {number}
 */
export function fromRoman(roman) {
    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let result = 0;
    const upper = roman.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        const current = values[upper[i]] || 0;
        const next = values[upper[i + 1]] || 0;
        if (current < next) {
            result -= current;
        } else {
            result += current;
        }
    }
    return result;
}
```

---

## 4. Menú de Selección de Encantamientos (`enchantsSelectionMenu`)

### 4.1 Responsabilidades

- Mostrar todos los encantamientos **compatibles** con el item en mainhand
- Filtrar según el código del dígito #1 (categoryMode)
- Implementar paginación si hay más de 9 encantamientos
- Navegar al menú de aplicación al seleccionar un encantamiento

### 4.2 Lógica de Filtrado

```javascript
/**
 * Filtra los encantamientos disponibles según la categoría del item.
 * @param {string} categoryMode - Modo de categoría del dígito #1
 * @param {EnchantmentDefinition[]} allEnchantments - Todos los encantamientos
 * @returns {EnchantmentDefinition[]} Encantamientos filtrados
 */
export function filterEnchantmentsByCategory(categoryMode, allEnchantments) {
    // Obtener categorías aplicables (con herencia)
    const categoryUnions = upgradesUiConfig.categoryUnions;
    let categories = [categoryMode];
    
    // Si la categoría tiene herencia, expandir
    if (categoryUnions[categoryMode]) {
        categories = categoryUnions[categoryMode];
    }
    
    // Modo "all" para debug - devuelve todos
    if (categoryMode === "all") {
        return [...allEnchantments].sort((a, b) => a.id - b.id);
    }
    
    // Filtrar por compatibilidad
    return allEnchantments
        .filter(ench => 
            ench.compatible.some(cat => categories.includes(cat))
        )
        .sort((a, b) => a.id - b.id);
}
```

### 4.3 Layout Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                    §l§8Encantamientos                           │
├─────────────────────────────────────────────────────────────────┤
│  [x] [x] [x] [x] [x] [x] [x] [x] [x]                           │  Fila 1
│  [x] [y] [y] [y] [x] [Ench1] [Ench2] [Ench3] [Next→]           │  Fila 2
│  [x] [y] [ ITEM MIRROR ] [y] [x] [Ench4] [Ench5] [Ench6] [x]   │  Fila 3
│  [x] [y] [Volver] [y] [x] [Ench7] [Ench8] [Ench9] [←Prev]      │  Fila 4
│  [x] [x] [x] [x] [x] [x] [x] [x] [x]                           │  Fila 5
└─────────────────────────────────────────────────────────────────┘

Slots del grid 3x3: [14, 15, 16, 23, 24, 25, 32, 33, 34]
Slot Next: 17  |  Slot Prev: 35  |  Mirror: 20  |  Slot Volver: 29
```

### 4.4 Implementación

```javascript
// scripts/features/chest-ui/upgrades/menus/enchants/enchantsSelectionMenu.js

import ChestFormData from "../../../chestui/forms.js";
import { upgradesUiConfig } from "../../config.js";
import { enchantmentsData, enchantsMenuConfig } from "./enchantsConfig.js";
import { filterEnchantmentsByCategory } from "./enchantsHelpers.js";
import { resolveRarityFromLastLoreLine } from "../../loreReaders.js";
import {
    getMainhandItemStack,
    isItemEnchanted,
    resolveChestUiTextureForItem,
    toTitleFromTypeId,
} from "../../itemMirror.js";
import { enchantsApplicationMenu } from "./enchantsApplicationMenu.js";

/**
 * Muestra el menú de selección de encantamientos.
 * @param {Player} player 
 * @param {Object} opts
 * @param {string} opts.categoryMode - Categoría de encantamientos a mostrar
 * @param {number} [opts.page=0] - Página actual (0-indexed)
 * @param {Function} opts.onBack - Callback para volver al menú anterior
 */
export function enchantsSelectionMenu(player, { categoryMode, page = 0, onBack } = {}) {
    const ui = new ChestFormData("45", "§l§8Encantamientos", 1);
    ui.default(upgradesUiConfig.layout.defaultItem);
    
    // Obtener item y lore
    const mainhandItem = getMainhandItemStack(player);
    const loreLines = mainhandItem?.getLore?.() ?? [];
    const lastLine = String(loreLines[loreLines.length - 1] ?? "");
    
    // Configurar patrón con rareza
    const rarity = resolveRarityFromLastLoreLine(lastLine, upgradesUiConfig.rarities);
    const yPane = rarity ? {
        ...upgradesUiConfig.layout.fallbackPaneY,
        itemName: rarity.paneName,
        texture: rarity.paneTexture,
        itemDesc: rarity.paneDescription,
    } : upgradesUiConfig.layout.fallbackPaneY;
    
    ui.pattern(upgradesUiConfig.layout.pattern, {
        ...upgradesUiConfig.layout.patternLegend,
        y: yPane,
    });
    
    // Mirror del item
    renderItemMirror(ui, mainhandItem, loreLines);
    
    // Filtrar encantamientos por categoría
    const availableEnchants = filterEnchantmentsByCategory(categoryMode, enchantmentsData);
    const { gridSlots, pagination } = enchantsMenuConfig;
    const itemsPerPage = gridSlots.length; // 9
    const totalPages = Math.ceil(availableEnchants.length / itemsPerPage);
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));
    
    // Obtener encantamientos de la página actual
    const startIdx = currentPage * itemsPerPage;
    const pageEnchants = availableEnchants.slice(startIdx, startIdx + itemsPerPage);
    
    // Renderizar encantamientos en el grid
    const routesBySlot = {};
    pageEnchants.forEach((enchant, idx) => {
        const slot = gridSlots[idx];
        ui.button(
            slot,
            `${enchant.colorName}${enchant.name}`,
            enchant.mainDescription,
            enchantsMenuConfig.enchantmentTexture,
            0, 0, true // enchanted = true para el glint
        );
        routesBySlot[slot] = { enchantId: enchant.id };
    });
    
    // Botones de paginación
    if (currentPage < totalPages - 1) {
        ui.button(
            pagination.nextSlot,
            pagination.nextButton.itemName,
            [...pagination.nextButton.itemDesc, `§r§8Página ${currentPage + 2}/${totalPages}`],
            pagination.nextButton.texture,
            0, 0, pagination.nextButton.enchanted
        );
    }
    
    if (currentPage > 0) {
        ui.button(
            pagination.prevSlot,
            pagination.prevButton.itemName,
            [...pagination.prevButton.itemDesc, `§r§8Página ${currentPage}/${totalPages}`],
            pagination.prevButton.texture,
            0, 0, pagination.prevButton.enchanted
        );
    }
    
    // Botón volver
    ui.button(
        enchantsMenuConfig.backSlot,
        enchantsMenuConfig.backButton.itemName,
        enchantsMenuConfig.backButton.itemDesc,
        enchantsMenuConfig.backButton.texture,
        0, 0, false
    );
    
    // Manejar respuesta
    ui.show(player).then((res) => {
        if (res.canceled) return;
        
        const selection = res.selection;
        
        // Volver
        if (selection === enchantsMenuConfig.backSlot) {
            if (typeof onBack === "function") onBack();
            return;
        }
        
        // Paginación
        if (selection === pagination.nextSlot && currentPage < totalPages - 1) {
            return enchantsSelectionMenu(player, { categoryMode, page: currentPage + 1, onBack });
        }
        if (selection === pagination.prevSlot && currentPage > 0) {
            return enchantsSelectionMenu(player, { categoryMode, page: currentPage - 1, onBack });
        }
        
        // Selección de encantamiento
        const route = routesBySlot[selection];
        if (route) {
            return enchantsApplicationMenu(player, {
                enchantId: route.enchantId,
                categoryMode,
                onBack: () => enchantsSelectionMenu(player, { categoryMode, page: currentPage, onBack }),
            });
        }
    });
}

/**
 * Renderiza el espejo del item en mainhand.
 */
function renderItemMirror(ui, mainhandItem, loreLines) {
    if (!mainhandItem) {
        ui.button(
            enchantsMenuConfig.mirrorSlot,
            "§r§cMano vacía",
            ["§r§7No tienes un item en la mano."],
            "barrier", 0, 0, false
        );
    } else {
        const itemName = mainhandItem.nameTag?.trim()
            ? mainhandItem.nameTag
            : `§r§7${toTitleFromTypeId(mainhandItem.typeId)}`;
        ui.button(
            enchantsMenuConfig.mirrorSlot,
            itemName,
            loreLines,
            resolveChestUiTextureForItem(mainhandItem),
            0, 0, isItemEnchanted(mainhandItem)
        );
    }
}
```

---

## 5. Menú de Aplicación de Encantamiento (`enchantsApplicationMenu`)

### 5.1 Responsabilidades

- Mostrar todos los niveles del encantamiento seleccionado
- Verificar el nivel actual del encantamiento en el item
- Mostrar estado de acción (`<action>` placeholder)
- Validar y ejecutar la aplicación del encantamiento

### 5.2 Layout Visual

> **Nota**: Este menú usa el mismo layout que `enchantsSelectionMenu` (sección 4.3).
> Los niveles del encantamiento se muestran en el grid 3x3 con paginación si hay más de 9 niveles.

```text
Ejemplo: Protección (6 niveles, caben en una página)

┌─────────────────────────────────────────────────────────────────┐
│                    §l§8Protección                               │
├─────────────────────────────────────────────────────────────────┤
│  [x] [x] [x] [x] [x] [x] [x] [x] [x]                           │  Fila 1
│  [x] [y] [y] [y] [x] [Prot I] [Prot II] [Prot III] [x]         │  Fila 2
│  [x] [y] [ ITEM MIRROR ] [y] [x] [Prot IV] [Prot V] [Prot VI] [x] │  Fila 3
│  [x] [y] [Volver] [y] [x] [    ] [    ] [    ] [x]             │  Fila 4
│  [x] [x] [x] [x] [x] [x] [x] [x] [x]                           │  Fila 5
└─────────────────────────────────────────────────────────────────┘

Slots de niveles: [14, 15, 16, 23, 24, 25, 32, 33, 34] (grid 3x3)
Mirror: 20  |  Slot Volver: 29
```

### 5.3 Lógica de Validación

```javascript
/**
 * Determina el estado de acción para un nivel de encantamiento.
 * @param {string} enchantName - Nombre base del encantamiento
 * @param {number} targetLevel - Nivel que se quiere aplicar
 * @param {string[]} loreLines - Lore actual del item
 * @param {LevelConfig} levelConfig - Configuración del nivel
 * @param {Player} player - Jugador
 * @returns {{canApply: boolean, actionText: string, reason?: string}}
 */
export function getEnchantmentActionState(enchantName, targetLevel, loreLines, levelConfig, player) {
    const { actionTexts } = enchantsMenuConfig;
    
    // 1. Detectar nivel actual del encantamiento en el item
    const currentLevel = detectCurrentEnchantmentLevel(enchantName, loreLines);
    
    // 2. Comparar niveles
    if (currentLevel >= targetLevel) {
        if (currentLevel === targetLevel) {
            // NUEVO: Permite desencantar este nivel
            return { 
                canApply: false, 
                canDisenchant: true,  // Flag para desencantar
                actionText: actionTexts.alreadyHasSame,
            };
        }
        return { canApply: false, canDisenchant: false, actionText: actionTexts.alreadyHasHigher };
    }
    
    // 3. Verificar requerimientos
    const reqCheck = checkRequirements(levelConfig.requirement, player);
    if (!reqCheck.passed) {
        return { 
            canApply: false, 
            actionText: actionTexts.missingRequirements,
            reason: reqCheck.reason,
        };
    }

    // Nota (admin): existe un bypass por tag `SXB`.
    // Si el jugador tiene la tag `SXB`, `checkRequirements()` retorna passed=true
    // y la transacción no consume items ni valida scoreboards.
    
    // 4. Puede aplicar
    return { canApply: true, actionText: actionTexts.canApply };
}

/**
 * Detecta el nivel actual de un encantamiento en el lore.
 * @param {string} enchantName - Nombre base (ej: "Protección")
 * @param {string[]} loreLines - Líneas del lore
 * @returns {number} Nivel actual (0 si no tiene)
 */
export function detectCurrentEnchantmentLevel(enchantName, loreLines) {
    // Los encantamientos están en líneas con color §9
    // Formato: "§9Filo VI, Primer Golpe II"
    
    const enchantPattern = new RegExp(
        `${escapeRegex(enchantName)}\\s+([IVXLCDM]+)`,
        "i"
    );
    
    for (const line of loreLines) {
        // Limpiar códigos de color para buscar
        const cleanLine = line.replace(/§[0-9a-fk-or]/gi, "");
        const match = cleanLine.match(enchantPattern);
        if (match) {
            return fromRoman(match[1]);
        }
    }
    
    return 0;
}

/**
 * Verifica los requerimientos para aplicar un encantamiento.
 * @param {Object} requirement
 * @param {Player} player
 * @returns {{passed: boolean, reason?: string}}
 */
export function checkRequirements(requirement, player) {
    if (!requirement) return { passed: true };

    // Bypass por tag `SXB`: permite encantar sin requerimientos.
    // Implementación actual: ver enchantsHelpers.js
    
    // Verificar scoreboards
    if (requirement.scores?.length) {
        for (const score of requirement.scores) {
            const value = getPlayerScore(player, score.objective);
            const check = evaluateOperator(value, score.operator, score.int);
            if (!check) {
                return { 
                    passed: false, 
                    reason: `${score.objective}: ${value} ${score.operator} ${score.int}`,
                };
            }
        }
    }
    
    // Verificar items (solo existencia, no consume aún)
    if (requirement.items?.length) {
        const inventory = player.getComponent("inventory")?.container;
        if (!inventory) return { passed: false, reason: "Sin inventario" };
        
        for (const itemReq of requirement.items) {
            const count = countItemsByName(inventory, itemReq.name);
            if (count < itemReq.quantity) {
                return {
                    passed: false,
                    reason: `Faltan: ${itemReq.name} x${itemReq.quantity - count}`,
                };
            }
        }
    }
    
    return { passed: true };
}
```

---

## 6. Aplicación del Encantamiento

### 6.1 Reglas de Escritura en Lore

#### Caso A: Item YA tiene encantamientos

```javascript
// Estructura actual del lore:
// "§r§9Filo VI, Primer Golpe II"
// "§r§9Castigo V"

// Regla: Máximo 2 encantamientos por línea, separados por ", "

// Al agregar "Saqueo III":
// "§r§9Filo VI, Primer Golpe II"
// "§r§9Castigo V, Saqueo III"
```

#### Caso B: Item NO tiene encantamientos

Existen múltiples variantes de lore que el sistema debe manejar:

```javascript
// Variante B1: Lore completo (estadísticas + descripción + rareza)
// ["§r§7Poder: §c+5☠", "", "§7Daño: §c+15🗡", "", "§o§8Descripción...", "", "§r§d§lMÍTICO"]
// Resultado: ["§r§7Poder: §c+5☠", "", "§7Daño: §c+15🗡", "", "§r§9Protección III", "", "§o§8Descripción...", "", "§r§d§lMÍTICO"]

// Variante B2: Sin descripción (estadísticas + rareza)
// ["§r§7Poder: §c+5☠", "", "§7Daño: §c+15🗡", "", "§r§d§lMÍTICO"]
// Resultado: ["§r§7Poder: §c+5☠", "", "§7Daño: §c+15🗡", "", "§r§9Protección III", "", "§r§d§lMÍTICO"]

// Variante B3: Solo estadísticas (sin descripción, sin rareza visible)
// ["§r§7Poder: §c+5☠", "", "§7Daño: §c+15🗡"]
// Resultado: ["§r§7Poder: §c+5☠", "", "§7Daño: §c+15🗡", "", "§r§9Protección III"]

// Variante B4: Lore mínimo (solo rareza)
// ["§r§d§lMÍTICO"]
// Resultado: ["§r§9Protección III", "", "§r§d§lMÍTICO"]

// Variante B5: Lore vacío
// []
// Resultado: ["§r§9Protección III"]
```

##### Regla de inserción:
1. **Prioridad 1**: Insertar ANTES de la línea de rareza (detectada por `upgradesUiConfig.rarities`)
2. **Prioridad 2**: Insertar DESPUÉS de la última estadística (líneas con `:` y color §7)
3. **Prioridad 3**: Insertar ANTES de descripción (líneas con §o itálica)
4. **Fallback**: Insertar al final del lore

#### 6.1.1 Contrato de Lore para Items Encantables (Anti-Bugs)

Los items “encantables” del pack cumplen este contrato (sirve como base para algoritmos robustos de inserción/remoción y para evitar reordenamientos):

- **Siempre** existen:
    - **Sección de estadísticas** (1 o más líneas). Ej: `§r§7Daño: ...`, `§r§7Daño Crítico: ...`
    - **Línea de rareza** (última sección visible). Ej: `§r§t§lRARO...`
- **Opcional**:
    - **Descripción** (una o varias líneas, típicamente `§o§8...`). Puede no existir.
- **Sección de encantamientos** (si existe) debe ser un bloque contiguo con estas reglas:
    - Cada línea contiene **1–2 encantamientos** máximo.
    - Separador: `", "`.
    - Color de línea: `§9` (se recomienda reset con `§r§9`).
    - Formato válido: `§9<Nombre> <Romano>` o `§r§9<Nombre> <Romano>`.
    - Formato recomendado: `§r§9<Nombre> <Romano>[, <Nombre> <Romano>]`.

#### 6.1.2 Normalización de Lore (Crítico para evitar “lore revuelto”)

Se ha detectado un bug donde al aplicar un encantamiento el lore queda reordenado (ej. “Daño Crítico” se mueve debajo del encantamiento) y aparecen códigos como `§r§9` al inicio de líneas que no corresponden (p. ej. descripción). Esto es considerado **bug de alto impacto**.

Para mitigarlo, el writer debe operar sobre una representación normalizada:

1. **Normalizar a líneas visuales**:
     - Si alguna entrada del array de lore contiene `\n`, debe **dividirse** en múltiples líneas en memoria (manteniendo el orden).
     - Se deben preservar líneas vacías como separadores (`""`).
2. Aplicar inserciones/remociones **solo** entre líneas (nunca concatenar texto al inicio de una línea existente).
3. Al finalizar, limpiar separadores:
     - Evitar múltiples líneas vacías consecutivas.
     - No dejar líneas vacías al inicio o final del lore.

> Objetivo: el bloque de estadísticas nunca debe moverse de lugar; solo se inserta o modifica el bloque de encantamientos y, en Tipo A, los valores numéricos dentro de estadísticas.

#### 6.1.3 Separación estable entre Secciones

La estructura final del lore (si hay descripción) debe respetar este orden:

1) Estadísticas

2) Encantamientos (bloque `§9`)

3) Descripción (si existe)

4) Rareza

Regla de separadores:

- Debe existir **exactamente una** línea vacía `""` entre secciones.
- Los encantamientos no deben “teñir” otras líneas: usar `§r` antes de `§9` en la línea de encantamiento evita arrastrar estilos previos.

#### 6.1.4 Efectos Tipo A (Modificación de Estadísticas en Lore)

En esta fase, aplicar un encantamiento Tipo A implica **dos escrituras**:

1) Insertar/actualizar la(s) línea(s) de encantamientos (`§9Nombre Romano`).

2) Modificar estadísticas dentro del lore para reflejar el efecto numérico.

##### Convención S1 / S2 / S3 (Segmentos Aditivos)

Las estadísticas suelen tener un “valor total” y uno o más segmentos de explicación/“aditivos”. Para estandarizar, se definen tres segmentos lógicos:

- **Total**: el valor principal (ej: `Daño: +40`).
- **S1**: aditivo para líneas de **críticos** (daño crítico / probabilidad crítica). Formato típico: `§9(+X)`.
- **S2**: reservado para otros aditivos futuros (no obligatorio en esta fase).
- **S3**: aditivo para la línea de **Daño**. Formato: `§9(+X)` al final de la línea.

Ejemplo (Filo V agrega +15 Daño):

```text
Antes:
§r§7Daño: §c+40 §c[+20] §6[+8]

Después:
§r§7Daño: §c+55 §c[+20] §6[+8] §9(+15)
§r§9Filo V
```

##### Regla general de suma/resta

- Al **encantar**, el sistema:
    - Suma el delta del encantamiento al **Total** correspondiente.
    - Suma/crea el delta en el segmento (S1 o S3 según la estadística).
- Al **desencantar**, el sistema:
    - Resta el delta del encantamiento del **Total** correspondiente.
    - Resta el delta del segmento (S1/S3). Si el segmento resultara menor que 0, debe **clamp** a 0 y ocultarse (no mostrar negativos).

Casos “ilegales” (no se corrigen en tiempo real):

- Si el segmento (S1/S3) tiene un valor que no coincide con el encantamiento (p. ej. `(+1)` pero debería ser `(+15)`), al desencantar se debe reducir **hasta 0** y remover el encantamiento. No se realiza chequeo constante por rendimiento.

##### Mapeo de estadística por encantamiento (Tipo A)

Este documento define el mapeo de “qué stat toca” cada Tipo A. Los Tipo B/C no deben modificar stats en esta fase (solo UI + lore de encantamiento).

- Daño (S3): “Filo”, “Poder”, “Tormenta”, y cualquier encantamiento cuyo efecto sea `+Daño`.
- Críticos (S1): “Crítico” (Daño crítico y Probabilidad crítica), y cualquier encantamiento que modifique esos stats.

> Importante: la UI muestra descripciones; pero el sistema Tipo A debe reflejar el delta en el lore para que el jugador pueda auditar los cambios.

#### Caso C: Item custom sin glint → con glint

```javascript
// Si typeId es "atomic3:chainmail_boots_plain"
// Cambiar a "atomic3:chainmail_boots_glint"

const glintMapping = {
    "_plain": "_glint",
    // otros mappings...
};
```

### 6.2 Implementación de Aplicación

> Nota de implementación (Feb 2026): la transacción real de encantamiento está en `enchantsApplicationMenu.js` (función `executeEnchantmentTransaction`).
> Los writers (`loreWriters.js`) se encargan de insertar/remover tokens `§r§9` y de aplicar/revertir deltas Tipo A. Antes de escribir, se normaliza a líneas visuales (si alguna entrada trae `\n`, se divide en memoria).

```javascript
// scripts/features/chest-ui/upgrades/loreWriters.js

import { world } from "@minecraft/server";
import { enchantsMenuConfig } from "./menus/enchants/enchantsConfig.js";
import { toRoman } from "./menus/enchants/enchantsHelpers.js";

/**
 * Aplica un encantamiento al item en mainhand del jugador.
 * @param {Player} player
 * @param {string} enchantName - Nombre base del encantamiento
 * @param {number} level - Nivel a aplicar
 * @param {LevelConfig} levelConfig - Configuración del nivel
 * @returns {{success: boolean, error?: string}}
 */
export function applyEnchantmentToMainhand(player, enchantName, level, levelConfig) {
    const equip = player.getComponent("equippable");
    if (!equip) return { success: false, error: "Sin componente equippable" };
    
    const mainhand = equip.getEquipment("Mainhand");
    if (!mainhand) return { success: false, error: "Mano vacía" };
    
    // 1. Consumir items requeridos
    if (levelConfig.requirement?.items?.length) {
        const inventory = player.getComponent("inventory")?.container;
        for (const itemReq of levelConfig.requirement.items) {
            const consumed = consumeItemsByName(inventory, itemReq.name, itemReq.quantity);
            if (!consumed) {
                return { success: false, error: `No se pudo consumir: ${itemReq.name}` };
            }
        }
    }
    
    // 2. Obtener lore actual
    const loreLines = mainhand.getLore() ?? [];
    const { enchantmentLoreColor, maxEnchantsPerLine } = enchantsMenuConfig;
    
    // 3. Crear el texto del nuevo encantamiento
    const enchantText = `${enchantName} ${toRoman(level)}`;
    
    // 4. Buscar si ya hay sección de encantamientos
    const enchantSectionIdx = findEnchantmentSectionIndex(loreLines);
    
    let newLore;
    if (enchantSectionIdx >= 0) {
        // Caso A: Ya hay encantamientos
        newLore = addEnchantmentToExistingSection(
            loreLines, 
            enchantSectionIdx, 
            enchantText, 
            enchantmentLoreColor,
            maxEnchantsPerLine
        );
    } else {
        // Caso B: Primer encantamiento
        newLore = insertFirstEnchantment(
            loreLines,
            enchantText,
            enchantmentLoreColor
        );
    }
    
    // 5. Aplicar nuevo lore
    mainhand.setLore(newLore);
    
    // 6. Verificar cambio de item (glint)
    const newItem = handleGlintConversion(mainhand);
    
    // 7. Actualizar en mainhand
    equip.setEquipment("Mainhand", newItem ?? mainhand);
    
    return { success: true };
}

/**
 * Encuentra el índice donde comienza la sección de encantamientos.
 * Los encantamientos usan el color §9.
 */
function findEnchantmentSectionIndex(loreLines) {
    for (let i = 0; i < loreLines.length; i++) {
        if (loreLines[i].startsWith("§9") || loreLines[i].startsWith("§r§9")) {
            return i;
        }
    }
    return -1;
}

/**
 * Agrega un encantamiento a una sección existente.
 */
function addEnchantmentToExistingSection(loreLines, startIdx, enchantText, color, maxPerLine) {
    const newLore = [...loreLines];
    
    // Encontrar la última línea de encantamientos
    let lastEnchantIdx = startIdx;
    for (let i = startIdx; i < newLore.length; i++) {
        if (newLore[i].startsWith(color)) {
            lastEnchantIdx = i;
        } else if (newLore[i] !== "") {
            break; // Encontramos contenido no-encantamiento
        }
    }
    
    // Contar encantamientos en la última línea
    const lastLine = newLore[lastEnchantIdx];
    const enchantCount = (lastLine.match(/,/g) || []).length + 1;
    
    if (enchantCount < maxPerLine) {
        // Agregar a la línea existente
        newLore[lastEnchantIdx] = `${lastLine}, ${enchantText}`;
    } else {
        // Crear nueva línea
        newLore.splice(lastEnchantIdx + 1, 0, `${color}${enchantText}`);
    }
    
    return newLore;
}

/**
 * Inserta el primer encantamiento en el lore.
 * Usa múltiples estrategias de detección para manejar diferentes formatos de lore.
 * 
 * @param {string[]} loreLines - Líneas actuales del lore
 * @param {string} enchantText - Texto del encantamiento (ej: "Protección III")
 * @param {string} color - Color del encantamiento (ej: "§9")
 * @returns {string[]} Nuevo array de lore con el encantamiento insertado
 */
function insertFirstEnchantment(loreLines, enchantText, color) {
    // Caso: Lore vacío
    if (!loreLines || loreLines.length === 0) {
        return [`${color}${enchantText}`];
    }
    
    const newLore = [...loreLines];
    
    // Estrategia 1: Detectar línea de rareza (debe ser la última no-vacía)
    const rarityIdx = findRarityLineIndex(newLore);
    
    // Estrategia 2: Detectar última estadística (líneas con ":")
    const lastStatIdx = findLastStatisticIndex(newLore);
    
    // Estrategia 3: Detectar inicio de descripción (§o itálica)
    const descriptionIdx = findDescriptionStartIndex(newLore);
    
    // Determinar punto de inserción según prioridades
    let insertIdx = determineInsertionPoint({
        loreLength: newLore.length,
        rarityIdx,
        lastStatIdx,
        descriptionIdx,
    });
    
    // Normalizar separadores (líneas vacías)
    insertIdx = normalizeAndInsert(newLore, insertIdx, `${color}${enchantText}`);
    
    return newLore;
}

/**
 * Encuentra el índice de la línea de rareza.
 * La rareza está en la última línea no-vacía y contiene códigos de formato específicos.
 */
function findRarityLineIndex(loreLines) {
    // Patrones de rareza conocidos (de upgradesUiConfig.rarities)
    const rarityPatterns = [
        /§[a-f0-9]§l[A-ZÁÉÍÓÚÑ]+$/i,  // §color§lTEXTO (ej: §d§lMÍTICO)
        /§r§[a-f0-9]§l/,               // §r§color§l
    ];
    
    // Buscar desde el final hacia arriba
    for (let i = loreLines.length - 1; i >= 0; i--) {
        const line = loreLines[i];
        if (line === "" || line === "\n") continue;
        
        for (const pattern of rarityPatterns) {
            if (pattern.test(line)) {
                return i;
            }
        }
        // Si encontramos contenido que no es rareza, dejar de buscar
        break;
    }
    return -1;
}

/**
 * Encuentra el índice de la última línea de estadísticas.
 * Las estadísticas tienen formato: §7Stat: §cValor o similar.
 */
function findLastStatisticIndex(loreLines) {
    let lastIdx = -1;
    
    for (let i = 0; i < loreLines.length; i++) {
        const line = loreLines[i];
        
        // Detectar formato de estadística: contiene ":" y empieza con color gris
        const isStatLine = 
            line.includes(":") && 
            (line.startsWith("§7") || line.startsWith("§r§7") || line.startsWith("§8"));
        
        if (isStatLine) {
            lastIdx = i;
        }
    }
    
    return lastIdx;
}

/**
 * Encuentra el índice donde comienza la descripción.
 * Las descripciones usan §o (itálica) o §8§o.
 */
function findDescriptionStartIndex(loreLines) {
    for (let i = 0; i < loreLines.length; i++) {
        const line = loreLines[i];
        
        // Detectar descripción: empieza con itálica
        if (line.startsWith("§o") || line.startsWith("§8§o") || line.startsWith("§r§o")) {
            return i;
        }
    }
    return -1;
}

/**
 * Determina el punto óptimo de inserción basado en la estructura del lore.
 */
function determineInsertionPoint({ loreLength, rarityIdx, lastStatIdx, descriptionIdx }) {
    // Prioridad 1: Insertar justo antes de la rareza
    if (rarityIdx > 0) {
        // Si hay línea vacía antes de rareza, insertar ahí
        return rarityIdx;
    }
    
    // Prioridad 2: Insertar después de la última estadística
    if (lastStatIdx >= 0) {
        return lastStatIdx + 1;
    }
    
    // Prioridad 3: Insertar antes de la descripción
    if (descriptionIdx >= 0) {
        return descriptionIdx;
    }
    
    // Fallback: insertar al final
    return loreLength;
}

/**
 * Inserta el encantamiento con normalización de separadores.
 * Garantiza líneas vacías apropiadas antes y después.
 * 
 * @returns {number} El índice donde se insertó el encantamiento
 */
function normalizeAndInsert(loreLines, insertIdx, enchantLine) {
    // Asegurar línea vacía ANTES si hay contenido previo
    if (insertIdx > 0 && loreLines[insertIdx - 1] !== "" && loreLines[insertIdx - 1] !== "\n") {
        loreLines.splice(insertIdx, 0, "");
        insertIdx++;
    }
    
    // Insertar el encantamiento
    loreLines.splice(insertIdx, 0, enchantLine);
    
    // Asegurar línea vacía DESPUÉS si hay contenido posterior
    if (insertIdx + 1 < loreLines.length) {
        const nextLine = loreLines[insertIdx + 1];
        if (nextLine !== "" && nextLine !== "\n") {
            loreLines.splice(insertIdx + 1, 0, "");
        }
    }
    
    return insertIdx;
}

/**
 * Convierte un item _plain a _glint si aplica.
 */
function handleGlintConversion(itemStack) {
    const typeId = itemStack.typeId;
    if (typeId.includes("_plain")) {
        const glintTypeId = typeId.replace("_plain", "_glint");
        // Verificar si el tipo glint existe
        try {
            const newItem = new ItemStack(glintTypeId, itemStack.amount);
            newItem.nameTag = itemStack.nameTag;
            newItem.setLore(itemStack.getLore());
            // Copiar otros componentes si es necesario
            return newItem;
        } catch {
            // El tipo glint no existe, mantener original
            return null;
        }
    }
    return null;
}
```

---

## 7. Catálogo de Encantamientos

### 7.1 Resumen por Categoría

| Categoría | Encantamientos | Max Pool |
|-----------|----------------|----------|
| sword | 14 | 14 |
| bow | 11 | 11 |
| armor | 2 | 2 |
| helmet | 2 + armor (4) | 4 |
| boots | 2 + armor (4) | 4 |
| pickaxe | 5 | 5 |
| axe | 4 | 4 |
| hoe | 4 | 4 |

### 7.2 Listado Completo

#### `sword` (14 encantamientos)

| ID | Nombre | Nivel Máx | Descripción |
|----|--------|-----------|-------------|
| 1 | Filo | VII | Aumenta el daño base |
| 2 | Primer Golpe | IV | Daño adicional en primer golpe |
| 3 | Crítico | VIII | Aumenta probabilidad/daño crítico |
| 4 | Aspecto Ígneo | III | Prende fuego al objetivo |
| 5 | Castigo | V | Daño extra a no-muertos |
| 6 | Perdición de los Artrópodos | VIII | Daño extra a artrópodos |
| 7 | Discordancia | III | Efectos de debuff |
| 8 | Corte Veloz | II | Aumenta velocidad de ataque |
| 9 | Oxidación | III | Aplica efecto de oxidación |
| 10 | Asesino del Fin | VII | Daño extra a Ender |
| 11 | Saqueo | V | Aumenta drops |
| 12 | Lux | III | Efectos de luz |
| 13 | Nux | III | Efectos de oscuridad |
| 14 | Verosimilitud | I | Efecto especial único |

#### `bow` (11 encantamientos)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 15 | Power | X |
| 16 | Flame | II |
| 17 | Punch | III |
| 18 | Salvación | IV |
| 19 | Sobrecarga | V |
| 20 | Caprificación | I |
| 21 | Obliteración | V |
| 22 | Terminación | I |
| 23 | Artigeno | III |
| 24 | Magmatismo | IV |
| 25 | Tormenta | III |

#### `armor` (2 encantamientos)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 26 | Protección | VI |
| 27 | Rejuvenecimiento | V |

#### `helmet` (2 encantamientos + armor)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 28 | Afinidad acuática | I |
| 29 | Respiración | III |

#### `boots` (2 encantamientos + armor)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 30 | Caída de pluma | XII |
| 31 | Lijereza | II |

#### `pickaxe` (5 encantamientos)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 32 | Eficiencia | V |
| 33 | Fortuna | V |
| 34 | Prisa espontánea | III |
| 35 | Linaje | II |
| 36 | Convicción | XII |

#### `axe` (4 encantamientos)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 32 | Eficiencia | V |
| 33 | Fortuna | V |
| 34 | Prisa espontánea | III |
| 36 | Convicción | XII |

#### `hoe` (4 encantamientos)

| ID | Nombre | Nivel Máx |
|----|--------|-----------|
| 32 | Eficiencia | V |
| 33 | Fortuna | V |
| 37 | Cultivador | X |
| 36 | Convicción | XII |

### 7.3 Efectos (Fase actual: solo Tipo A)

Esta sección define **fórmulas y objetivo de escritura** para encantamientos Tipo A. La implementación de Tipo A consiste en actualizar:

1) El bloque de encantamientos (`§9Nombre Romano`).

2) Las estadísticas del lore (Total + segmento S1/S3 según aplique).

> Tipo B/C: quedan fuera de esta fase. Pueden mostrarse en UI, pero no deben modificar estadísticas ni aplicar efectos reales.

#### 7.3.1 Tabla de fórmulas Tipo A

- **Filo (I–VII)**: $+3$ Daño por nivel.
    - Objetivo: línea `Daño` → Total y **S3**.
- **Crítico (I–VIII)**: $+5$ Daño Crítico por nivel y $+2$ Probabilidad Crítica por nivel.
    - Objetivo: líneas de críticos → Total y **S1**.
- **Poder (I–X)**: $+15$ Daño por nivel.
    - Objetivo: `Daño` → Total y **S3**.
- **Tormenta (I–III)**: $+24$ Daño por nivel.
    - Objetivo: `Daño` → Total y **S3**.

#### 7.3.2 Tipo A con matices (dependen de stats existentes)

Los siguientes se consideran “Tipo A” en cuanto a que su resultado es un número en lore, pero requieren leer otros valores del item o del jugador para calcular el delta:

- **Sobrecarga (I–V)**: por cada umbral de Daño Crítico total agrega Daño adicional (reglas exactas se implementarán según la redacción final en `enchantsConfig.js`).
    - Objetivo: `Daño` → Total y **S3**.
- **Obliteración (I–V)**: por cada Probabilidad Crítica excedente a 100% añade Daño Crítico adicional.
    - Requiere lectura de scoreboard: `ProbabilidadCriticaTotal`.
    - Objetivo: `Daño Crítico` → Total y **S1**.
- **Linaje (I–II)**: convierte Defensa en Fortuna minera adicional.
    - Objetivo: línea(s) de fortuna correspondientes (cuando existan en el lore del item).

> Regla de seguridad (implementación actual): si la estadística objetivo no existe en el item y el delta neto es **positivo**, el writer Tipo A puede **crear** la línea de stat usando el render config (color/icono) para mantener auditabilidad. Si el delta neto es **0 o negativo**, no se crea la línea y se omite la modificación numérica. Al desencantar, si la stat queda en 0 y no hay otras fuentes (corchetes/paréntesis), se elimina la línea para restaurar la forma original del lore.

---

## 8. Riesgos Técnicos y Mitigaciones

### 8.1 Riesgos Identificados

| Riesgo | Impacto | Mitigación Implementada |
|--------|---------|-------------------------|
| **Parsing de lore incorrecto** | Alto | Regex robustos + múltiples estrategias de detección |
| **Reordenamiento de lore / fuga de color** | Alto | Contrato de secciones + normalización a líneas visuales + `§r§9` en líneas de encantamiento |
| **Items custom sin glint** | Medio | Try-catch con fallback a item original |
| **Scoreboards inexistentes** | Medio | `safeGetScore()` con verificación previa |
| **Consumo sin aplicación** | Alto | Transacción de 2 fases: validar → consumir |
| **Race condition en UI** | Medio | Estado inmutable, refresh on open |

### 8.2 Implementación de Mitigaciones

#### Mitigación 1: Safe Score Reader

```javascript
// En loreReaders.js

/**
 * Obtiene el score de un jugador de forma segura.
 * @param {Player} player
 * @param {string} objective - Nombre del scoreboard
 * @returns {number} Score actual o 0 si no existe
 */
export function safeGetScore(player, objective) {
    try {
        const scoreboard = world.scoreboard.getObjective(objective);
        if (!scoreboard) {
            console.warn(`[Enchants] Scoreboard "${objective}" no existe`);
            return 0;
        }
        
        const participant = scoreboard.getParticipants()
            .find(p => p.displayName === player.name);
        
        return participant ? scoreboard.getScore(participant) : 0;
    } catch (error) {
        console.error(`[Enchants] Error al leer score: ${error.message}`);
        return 0;
    }
}

/**
 * Evalúa un operador de comparación.
 * @param {number} value - Valor actual
 * @param {string} operator - Operador (>=, ==, <=, !=)
 * @param {number} target - Valor objetivo
 * @returns {boolean}
 */
export function evaluateOperator(value, operator, target) {
    switch (operator) {
        case ">=": return value >= target;
        case "==": return value === target;
        case "<=": return value <= target;
        case "!=": return value !== target;
        case ">":  return value > target;
        case "<":  return value < target;
        default:
            console.warn(`[Enchants] Operador desconocido: ${operator}`);
            return false;
    }
}
```

#### Mitigación 2: Transacción de 2 Fases

```javascript
// En enchantsHelpers.js

/**
 * Ejecuta la aplicación de encantamiento como transacción.
 * Fase 1: Validación completa (sin modificaciones)
 * Fase 2: Ejecución (consumir + aplicar)
 * 
 * @param {Player} player
 * @param {EnchantmentDefinition} enchant
 * @param {number} level
 * @param {LevelConfig} levelConfig
 * @returns {{success: boolean, error?: string}}
 */
export function executeEnchantmentTransaction(player, enchant, level, levelConfig) {
    // ═══════════════════════════════════════════════════════════
    // FASE 1: VALIDACIÓN (read-only, no modifica estado)
    // ═══════════════════════════════════════════════════════════
    
    const validation = validateEnchantmentApplication(player, enchant, level, levelConfig);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    
    // Cache de datos necesarios para Fase 2
    const { mainhand, inventory, itemsToConsume } = validation;
    
    // ═══════════════════════════════════════════════════════════
    // FASE 2: EJECUCIÓN (modificaciones atómicas)
    // ═══════════════════════════════════════════════════════════
    
    try {
        // 2a. Consumir items del inventario
        for (const { slot, quantity } of itemsToConsume) {
            const item = inventory.getItem(slot);
            if (item.amount <= quantity) {
                inventory.setItem(slot, undefined);
            } else {
                item.amount -= quantity;
                inventory.setItem(slot, item);
            }
        }
        
        // 2b. Modificar lore del item
        const loreLines = mainhand.getLore() ?? [];
        const newLore = applyEnchantmentToLore(loreLines, enchant.name, level);
        mainhand.setLore(newLore);
        
        // 2c. Conversión de glint si aplica
        const finalItem = handleGlintConversion(mainhand) ?? mainhand;
        
        // 2d. Actualizar mainhand
        const equip = player.getComponent("equippable");
        equip.setEquipment("Mainhand", finalItem);
        
        return { success: true };
        
    } catch (error) {
        // En caso de error durante ejecución, loguear pero no hay rollback automático
        console.error(`[Enchants] Error en transacción: ${error.message}`);
        return { success: false, error: "Error interno al aplicar" };
    }
}

/**
 * Validación completa sin modificar estado.
 */
function validateEnchantmentApplication(player, enchant, level, levelConfig) {
    const equip = player.getComponent("equippable");
    const mainhand = equip?.getEquipment("Mainhand");
    
    if (!mainhand) {
        return { valid: false, error: "Mano vacía" };
    }
    
    // Verificar nivel actual del encantamiento
    const loreLines = mainhand.getLore() ?? [];
    const currentLevel = detectCurrentEnchantmentLevel(enchant.name, loreLines);
    
    if (currentLevel >= level) {
        return { 
            valid: false, 
            error: currentLevel === level ? "Ya tienes este nivel" : "Nivel actual superior" 
        };
    }
    
    // Verificar scoreboards
    if (levelConfig.requirement?.scores?.length) {
        for (const score of levelConfig.requirement.scores) {
            const value = safeGetScore(player, score.objective);
            if (!evaluateOperator(value, score.operator, score.int)) {
                return { 
                    valid: false, 
                    error: `Requiere ${score.objective} ${score.operator} ${score.int}` 
                };
            }
        }
    }
    
    // Verificar y localizar items a consumir
    const itemsToConsume = [];
    if (levelConfig.requirement?.items?.length) {
        const inventory = player.getComponent("inventory")?.container;
        if (!inventory) {
            return { valid: false, error: "Sin acceso al inventario" };
        }
        
        for (const itemReq of levelConfig.requirement.items) {
            const found = findItemsInInventory(inventory, itemReq.name, itemReq.quantity);
            if (!found.success) {
                return { valid: false, error: `Falta: ${itemReq.name}` };
            }
            itemsToConsume.push(...found.slots);
        }
        
        return { 
            valid: true, 
            mainhand, 
            inventory, 
            itemsToConsume 
        };
    }
    
    return { valid: true, mainhand, inventory: null, itemsToConsume: [] };
}
```

---

## 9. Centralización en loreReaders.js

### 9.1 Funciones Centralizadas

Todas las funciones de lectura y análisis de lore deben estar en `loreReaders.js`:

```javascript
// scripts/features/chest-ui/upgrades/loreReaders.js

import { upgradesUiConfig } from "./config.js";

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE LECTURA BÁSICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene las líneas de lore de forma segura.
 * @param {ItemStack} itemStack
 * @returns {string[]} Array de líneas (nunca null/undefined)
 */
export function getSafeLoreLines(itemStack) {
    try {
        return itemStack?.getLore?.() ?? [];
    } catch {
        return [];
    }
}

/**
 * Obtiene la última línea no vacía del lore.
 * @param {string[]} loreLines
 * @returns {string} Última línea o string vacío
 */
export function getLastNonEmptyLine(loreLines) {
    for (let i = loreLines.length - 1; i >= 0; i--) {
        const line = loreLines[i];
        if (line && line.trim() !== "" && line !== "\n") {
            return line;
        }
    }
    return "";
}

/**
 * Limpia códigos de formato § de un string.
 * @param {string} text
 * @returns {string} Texto sin códigos de color/formato
 */
export function stripColorCodes(text) {
    return text.replace(/§[0-9a-fk-or]/gi, "");
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE DETECCIÓN DE RAREZA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resuelve la configuración de rareza desde la última línea del lore.
 * @param {string} lastLine - Última línea del lore
 * @param {Object} raritiesConfig - upgradesUiConfig.rarities
 * @returns {Object|null} Configuración de rareza o null
 */
export function resolveRarityFromLastLoreLine(lastLine, raritiesConfig) {
    const cleanLine = stripColorCodes(lastLine).toUpperCase().trim();
    
    for (const [key, config] of Object.entries(raritiesConfig)) {
        const rarityName = stripColorCodes(config.paneName || "").toUpperCase().trim();
        if (cleanLine === rarityName || cleanLine.includes(rarityName)) {
            return { key, ...config };
        }
    }
    
    return null;
}

/**
 * Detecta si una línea es de rareza.
 * @param {string} line
 * @returns {boolean}
 */
export function isRarityLine(line) {
    // Patrones comunes de rareza: §<color>§l<TEXTO_MAYÚSCULAS>
    return /§[a-f0-9]§l[A-ZÁÉÍÓÚÑ]+$/i.test(line) || /§r§[a-f0-9]§l/.test(line);
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE DETECCIÓN DE ENCANTAMIENTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detecta el nivel actual de un encantamiento en el lore.
 * @param {string} enchantName - Nombre base (ej: "Protección")
 * @param {string[]} loreLines
 * @returns {number} Nivel (0 si no tiene)
 */
export function detectCurrentEnchantmentLevel(enchantName, loreLines) {
    const pattern = new RegExp(
        `${escapeRegex(enchantName)}\\s+([IVXLCDM]+)`,
        "i"
    );
    
    for (const line of loreLines) {
        const cleanLine = stripColorCodes(line);
        const match = cleanLine.match(pattern);
        if (match) {
            return fromRoman(match[1]);
        }
    }
    
    return 0;
}

/**
 * Obtiene todos los encantamientos presentes en el lore.
 * @param {string[]} loreLines
 * @returns {Array<{name: string, level: number, lineIdx: number}>}
 */
export function getAllEnchantmentsFromLore(loreLines) {
    const result = [];
    const enchantColor = "§9";
    
    // Patrón para capturar nombre y número romano
    const enchantPattern = /([A-Za-záéíóúñÁÉÍÓÚÑ\s]+)\s+([IVXLCDM]+)/gi;
    
    for (let i = 0; i < loreLines.length; i++) {
        const line = loreLines[i];
        if (!line.startsWith(enchantColor)) continue;
        
        const cleanLine = stripColorCodes(line);
        let match;
        
        while ((match = enchantPattern.exec(cleanLine)) !== null) {
            result.push({
                name: match[1].trim(),
                level: fromRoman(match[2]),
                lineIdx: i,
            });
        }
    }
    
    return result;
}

/**
 * Encuentra el índice donde comienza la sección de encantamientos.
 * @param {string[]} loreLines
 * @returns {number} Índice o -1 si no hay encantamientos
 */
export function findEnchantmentSectionIndex(loreLines) {
    for (let i = 0; i < loreLines.length; i++) {
        if (loreLines[i].startsWith("§9")) {
            return i;
        }
    }
    return -1;
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE DETECCIÓN DE ESTRUCTURA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analiza la estructura completa del lore.
 * @param {string[]} loreLines
 * @returns {Object} Índices de cada sección
 */
export function analyzeLoreStructure(loreLines) {
    return {
        stats: findStatisticsRange(loreLines),
        enchants: findEnchantmentRange(loreLines),
        description: findDescriptionRange(loreLines),
        rarity: findRarityLineIndex(loreLines),
    };
}

/**
 * Encuentra el rango de líneas de estadísticas.
 */
function findStatisticsRange(loreLines) {
    let start = -1;
    let end = -1;
    
    for (let i = 0; i < loreLines.length; i++) {
        const line = loreLines[i];
        const isStatLine = line.includes(":") && 
            (line.startsWith("§7") || line.startsWith("§r§7"));
        
        if (isStatLine) {
            if (start === -1) start = i;
            end = i;
        }
    }
    
    return start >= 0 ? { start, end } : null;
}

/**
 * Encuentra el rango de líneas de encantamientos.
 */
function findEnchantmentRange(loreLines) {
    let start = -1;
    let end = -1;
    
    for (let i = 0; i < loreLines.length; i++) {
        if (loreLines[i].startsWith("§9")) {
            if (start === -1) start = i;
            end = i;
        }
    }
    
    return start >= 0 ? { start, end } : null;
}

/**
 * Encuentra el rango de descripción.
 */
function findDescriptionRange(loreLines) {
    let start = -1;
    let end = -1;
    
    for (let i = 0; i < loreLines.length; i++) {
        const line = loreLines[i];
        const isDescLine = line.startsWith("§o") || 
            line.startsWith("§8§o") || 
            line.startsWith("§r§o");
        
        if (isDescLine) {
            if (start === -1) start = i;
            end = i;
        }
    }
    
    return start >= 0 ? { start, end } : null;
}

/**
 * Encuentra el índice de la línea de rareza.
 */
function findRarityLineIndex(loreLines) {
    for (let i = loreLines.length - 1; i >= 0; i--) {
        if (isRarityLine(loreLines[i])) {
            return i;
        }
    }
    return -1;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Escapa caracteres especiales para uso en RegExp.
 */
export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convierte número romano a entero.
 */
export function fromRoman(roman) {
    const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let result = 0;
    const upper = roman.toUpperCase();
    
    for (let i = 0; i < upper.length; i++) {
        const current = values[upper[i]] || 0;
        const next = values[upper[i + 1]] || 0;
        result += current < next ? -current : current;
    }
    
    return result;
}
```

### 9.2 Mapeo de Categorías Centralizado

```javascript
// Añadir a loreReaders.js

/**
 * Obtiene la categoría desde el dígito del código.
 * Centraliza el mapeo que estaba hardcodeado.
 * 
 * @param {string} digit - Dígito del código (0-9)
 * @returns {string} Nombre de la categoría
 */
export function getCategoryFromDigit(digit) {
    const { variantsByDigit } = upgradesUiConfig.actionsByCodeIndex[1] ?? {};
    if (!variantsByDigit) return "unknown";
    
    const variant = variantsByDigit[digit];
    return variant?.categoryMode ?? "unknown";
}

/**
 * Obtiene el dígito desde el nombre de categoría.
 * @param {string} categoryName
 * @returns {string} Dígito ("0"-"9") o "0" por defecto
 */
export function getDigitFromCategory(categoryName) {
    const { variantsByDigit } = upgradesUiConfig.actionsByCodeIndex[1] ?? {};
    if (!variantsByDigit) return "0";
    
    for (const [digit, variant] of Object.entries(variantsByDigit)) {
        if (variant.categoryMode === categoryName) {
            return digit;
        }
    }
    return "0";
}
```

---

## 10. Sistema de Desencantamiento (Integrado)

### 10.1 Enfoque de Diseño

El sistema de desencantamiento está **integrado directamente** en el menú de aplicación de niveles (`enchantsApplicationMenu`). No requiere un menú separado.

> *"Como jugador, cuando veo el nivel de encantamiento que ya tengo en mi item, puedo hacer clic para desencantarlo. El sistema me pide confirmación con un segundo clic. Sin costos, sin complicaciones."*

### 10.2 Flujo de Usuario

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                   DESENCANTAMIENTO INTEGRADO                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [enchantsApplicationMenu]                                              │
│         │                                                               │
│         │ Jugador tiene "Protección III" en su item                     │
│         │ Botón "Protección III" muestra:                                │
│         │   "§r§cClic para desencantar"                                   │
│         │                                                               │
│         ▼ PRIMER CLIC en "Protección III"                               │
│  [Re-render del menú]                                                   │
│         │ Botón ahora muestra:                                          │
│         │   "§r§c¡Clic de nuevo para confirmar!"                          │
│         │ (pendingDisenchant = { enchantId, level: 3 })                 │
│         │                                                               │
│         ▼ SEGUNDO CLIC en "Protección III"                              │
│  [Ejecución]                                                            │
│         │ - Remover "Protección III" del lore                           │
│         │ - Reordenar lore si es necesario                              │
│         │ - Revertir glint si 0 encantamientos                          │
│         ▼                                                               │
│  [Feedback + Re-render]                                                 │
│         │ Mensaje: "§a✓ Removido: Protección III"                        │
│         │ Menú se actualiza sin el encantamiento                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Estados del Botón de Nivel

| Estado | `currentLevel` vs `targetLevel` | Texto | Acción |
|--------|--------------------------------|-------|--------|
| Puede aplicar | current < target | "§eClic para encantar" | Aplicar encantamiento |
| Ya tiene este nivel | current == target | "§cClic para desencantar" | Primer clic → confirmación |
| Confirmando | current == target + pending | "§c¡Clic de nuevo!" | Segundo clic → ejecutar |
| Nivel superior | current > target | "§cNivel actual superior" | Deshabilitado |
| Sin requisitos | current < target | "§cNo cumples requisitos" | Deshabilitado |

### 10.4 Modificaciones a `enchantsApplicationMenu`

```javascript
// scripts/features/chest-ui/upgrades/menus/enchants/enchantsApplicationMenu.js

/**
 * Muestra el menú de niveles de un encantamiento.
 * @param {Player} player
 * @param {Object} opts
 * @param {number} opts.enchantId - ID del encantamiento
 * @param {string} opts.categoryMode - Categoría actual
 * @param {Function} opts.onBack - Callback para volver
 * @param {Object} [opts.pendingDisenchant] - Estado de confirmación pendiente
 * @param {number} [opts.pendingDisenchant.level] - Nivel pendiente de desencantamiento
 */
export function enchantsApplicationMenu(player, { 
    enchantId, 
    categoryMode, 
    onBack,
    pendingDisenchant = null,  // NUEVO: estado de confirmación
} = {}) {
    const enchant = enchantmentsData.find(e => e.id === enchantId);
    if (!enchant) return;
    
    const ui = new ChestFormData("45", `§l§8${enchant.name}`, 1);
    ui.default(upgradesUiConfig.layout.defaultItem);
    
    // ... setup pattern y mirror ...
    
    const mainhandItem = getMainhandItemStack(player);
    const loreLines = getSafeLoreLines(mainhandItem);
    const currentLevel = detectCurrentEnchantmentLevel(enchant.name, loreLines);
    
    // Renderizar niveles del encantamiento
    const { gridSlots } = enchantsMenuConfig;
    const routesBySlot = {};
    
    for (let level = 1; level <= enchant.maxLevel; level++) {
        if (level - 1 >= gridSlots.length) break; // Paginación futura
        
        const slot = gridSlots[level - 1];
        const levelConfig = getLevelConfig(enchant, level);
        const state = getEnchantmentActionState(enchant.name, level, loreLines, levelConfig, player);
        
        // Determinar texto de acción
        let actionText = state.actionText;
        let isConfirming = false;
        
        // NUEVO: Manejar estado de confirmación de desencantamiento
        if (state.canDisenchant && pendingDisenchant?.level === level) {
            actionText = enchantsMenuConfig.actionTexts.confirmDisenchant;
            isConfirming = true;
        }
        
        // Construir descripción del botón
        const description = buildLevelDescription(levelConfig, level, actionText);
        
        ui.button(
            slot,
            `${levelConfig.color}${enchant.name} ${toRoman(level)}`,
            description,
            enchantsMenuConfig.enchantmentTexture,
            0, 0, true
        );
        
        routesBySlot[slot] = { 
            level, 
            canApply: state.canApply,
            canDisenchant: state.canDisenchant,
            isConfirming,
        };
    }
    
    // Botón volver
    ui.button(
        enchantsMenuConfig.backSlot,
        enchantsMenuConfig.backButton.itemName,
        enchantsMenuConfig.backButton.itemDesc,
        enchantsMenuConfig.backButton.texture,
        0, 0, false
    );
    
    ui.show(player).then((res) => {
        if (res.canceled) return;
        
        if (res.selection === enchantsMenuConfig.backSlot) {
            if (typeof onBack === "function") onBack();
            return;
        }
        
        const route = routesBySlot[res.selection];
        if (!route) return;
        
        // Caso 1: Aplicar encantamiento
        if (route.canApply) {
            const levelConfig = getLevelConfig(enchant, route.level);
            const result = executeEnchantmentTransaction(player, enchant, route.level, levelConfig);
            
            if (result.success) {
                player.sendMessage(`§a✓ Encantado: ${enchant.name} ${toRoman(route.level)}`);
            } else {
                player.sendMessage(`§c✗ Error: ${result.error}`);
            }
            
            // Re-abrir menú actualizado
            return enchantsApplicationMenu(player, { enchantId, categoryMode, onBack });
        }
        
        // Caso 2: Desencantamiento - PRIMER CLIC
        if (route.canDisenchant && !route.isConfirming) {
            // Pasar a estado de confirmación
            return enchantsApplicationMenu(player, {
                enchantId,
                categoryMode,
                onBack,
                pendingDisenchant: { level: route.level },  // Marcar como pendiente
            });
        }
        
        // Caso 3: Desencantamiento - SEGUNDO CLIC (confirmación)
        if (route.canDisenchant && route.isConfirming) {
            const result = removeEnchantmentFromMainhand(player, enchant.name);
            
            if (result.success) {
                player.sendMessage(`§a✓ Removido: ${enchant.name} ${toRoman(route.level)}`);
            } else {
                player.sendMessage(`§c✗ Error: ${result.error}`);
            }
            
            // Re-abrir menú sin estado pendiente
            return enchantsApplicationMenu(player, { enchantId, categoryMode, onBack });
        }
    });
}
```

### 10.5 Función de Remoción de Encantamiento

```javascript
// scripts/features/chest-ui/upgrades/loreWriters.js

/**
 * Remueve un encantamiento del item en mainhand.
 * Sin costos ni requerimientos - acción directa.
 * 
 * @param {Player} player
 * @param {string} enchantName - Nombre del encantamiento a remover
 * @returns {{success: boolean, error?: string}}
 */
export function removeEnchantmentFromMainhand(player, enchantName) {
    const equip = player.getComponent("equippable");
    const mainhand = equip?.getEquipment("Mainhand");
    
    if (!mainhand) {
        return { success: false, error: "Mano vacía" };
    }
    
    // Obtener lore y remover encantamiento
    const loreLines = mainhand.getLore() ?? [];
    const newLore = removeEnchantFromLore(loreLines, enchantName);
    
    // Verificar que realmente se removió algo
    if (newLore.length === loreLines.length) {
        // Podría no haber cambiado si el encantamiento no existía
        const oldEnchants = getAllEnchantmentsFromLore(loreLines);
        const newEnchants = getAllEnchantmentsFromLore(newLore);
        if (oldEnchants.length === newEnchants.length) {
            return { success: false, error: "Encantamiento no encontrado" };
        }
    }
    
    // Aplicar nuevo lore
    mainhand.setLore(newLore);
    
    // Verificar si quedan encantamientos para el glint
    const remainingEnchants = getAllEnchantmentsFromLore(newLore);
    
    if (remainingEnchants.length === 0) {
        // Revertir glint (_glint → _plain)
        const deglintedItem = handleDeglintConversion(mainhand);
        equip.setEquipment("Mainhand", deglintedItem ?? mainhand);
    } else {
        equip.setEquipment("Mainhand", mainhand);
    }
    
    return { success: true };
}

/**
 * Remueve un encantamiento específico del lore.
 * Mantiene el orden y limpia líneas vacías innecesarias.
 * 
 * @param {string[]} loreLines
 * @param {string} enchantName - Nombre base (ej: "Protección")
 * @returns {string[]}
 */
function removeEnchantFromLore(loreLines, enchantName) {
    const newLore = [];
    const pattern = new RegExp(
        `${escapeRegex(enchantName)}\\s+[IVXLCDM]+`,
        "i"
    );
    
    let enchantSectionStart = -1;
    let enchantSectionEnd = -1;
    
    for (let i = 0; i < loreLines.length; i++) {
        const line = loreLines[i];
        
        // Detectar sección de encantamientos
        if (line.startsWith("§9")) {
            if (enchantSectionStart === -1) enchantSectionStart = i;
            enchantSectionEnd = i;
            
            const cleanLine = stripColorCodes(line);
            
            if (!pattern.test(cleanLine)) {
                // Esta línea no contiene el encantamiento a remover
                newLore.push(line);
            } else {
                // Verificar si hay múltiples encantamientos en la línea
                // Formato: "§9Filo VI, Primer Golpe II"
                const parts = line.substring(2).split(", "); // Quitar §9 y dividir
                const remaining = parts.filter(p => !pattern.test(stripColorCodes(p)));
                
                if (remaining.length > 0) {
                    newLore.push(`§9${remaining.join(", ")}`);
                }
                // Si remaining está vacío, la línea simplemente se omite
            }
        } else {
            newLore.push(line);
        }
    }
    
    // Limpiar líneas vacías consecutivas que pudieron quedar
    return cleanupEmptyLines(newLore);
}

/**
 * Limpia líneas vacías consecutivas y en los bordes.
 */
function cleanupEmptyLines(loreLines) {
    const result = [];
    let lastWasEmpty = false;
    
    for (const line of loreLines) {
        const isEmpty = line === "" || line === "\n" || line.trim() === "";
        
        if (isEmpty && lastWasEmpty) {
            continue; // Skip líneas vacías consecutivas
        }
        
        result.push(line);
        lastWasEmpty = isEmpty;
    }
    
    // Remover líneas vacías al inicio
    while (result.length > 0 && isEmptyLine(result[0])) {
        result.shift();
    }
    
    // Remover líneas vacías al final (excepto antes de rareza)
    while (result.length > 1 && isEmptyLine(result[result.length - 1])) {
        // Verificar si la anterior a la última es rareza
        const secondToLast = result[result.length - 2];
        if (isRarityLine(secondToLast)) {
            break; // Mantener línea vacía antes de rareza
        }
        result.pop();
    }
    
    return result;
}

function isEmptyLine(line) {
    return line === "" || line === "\n" || line?.trim() === "";
}

/**
 * Revierte conversión de glint (_glint → _plain).
 */
function handleDeglintConversion(itemStack) {
    const typeId = itemStack.typeId;
    
    if (typeId.includes("_glint")) {
        const plainTypeId = typeId.replace("_glint", "_plain");
        try {
            const newItem = new ItemStack(plainTypeId, itemStack.amount);
            newItem.nameTag = itemStack.nameTag;
            newItem.setLore(itemStack.getLore());
            // Copiar otros componentes dinámicos si existen
            return newItem;
        } catch {
            // El tipo plain no existe, mantener original
            return null;
        }
    }
    return null;
}
```

### 10.6 Ventajas del Enfoque Integrado

| Aspecto | Enfoque Anterior (Menú Separado) | Enfoque Actual (Integrado) |
|---------|----------------------------------|---------------------------|
| **UX** | Requiere navegar a otro menú | Misma ubicación, flujo natural |
| **Confirmación** | Menú de confirmación separado | Doble-clic in situ |
| **Código** | Archivo adicional `disenchantMenu.js` | Reutiliza `enchantsApplicationMenu.js` |
| **Costos** | Requería items/scoreboards | Sin costos, acción directa |
| **Descubrimiento** | Necesita botón en menú principal | Implícito al ver encantamiento actual |

---

## 11. Plan de Implementación

### Fase 1: Infraestructura (2-3 horas)
- [ ] Actualizar `loreReaders.js` con funciones centralizadas
- [ ] Crear `loreWriters.js` con funciones de escritura
- [ ] Implementar `enchantsHelpers.js` (toRoman, filtrado, validación)
- [ ] Tests manuales de parsing en diferentes formatos de lore

### Fase 2: Configuración (1-2 horas)
- [ ] Crear `enchantsConfig.js` con estructura completa
- [ ] Agregar los 37 encantamientos con su configuración

### Fase 3: Menú de Selección (2-3 horas)
- [ ] Implementar `enchantsSelectionMenu.js`
- [ ] Integrar con `enchantsMenu.js` existente
- [ ] Probar paginación y filtrado por categoría

### Fase 4: Menú de Aplicación y Desencantamiento (3-4 horas)
- [ ] Implementar `enchantsApplicationMenu.js`
- [ ] Implementar lógica de placeholders (`<rarity>`, `<action>`, etc.)
- [ ] Implementar sistema de transacciones (validar → consumir → aplicar)
- [ ] Implementar sistema de desencantamiento integrado (doble clic)
- [ ] Implementar `removeEnchantmentFromMainhand` en loreWriters.js

### Fase 5: Integración y Testing (2-3 horas)
- [ ] Conectar flujo completo de encantamiento
- [ ] Probar flujo de desencantamiento con doble confirmación
- [ ] Probar casos edge:
  - [ ] Item sin lore
  - [ ] Item solo con rareza
  - [ ] Item sin descripción
  - [ ] Múltiples encantamientos en línea
  - [ ] Conversión glint/plain bidireccional
  - [ ] Desencantamiento del último encantamiento (revertir a plain)
- [ ] Verificar consumo transaccional de items

---

## 12. Referencias

### Archivos del Sistema de Upgrades
- [config.js](../config.js) - Configuración general (`upgradesUiConfig`, `upgradesMenusConfig`)
- [loreReaders.js](../loreReaders.js) - Funciones centralizadas de lectura de lore
- [loreWriters.js](../loreWriters.js) - Funciones de escritura/modificación de lore (a crear)
- [itemMirror.js](../itemMirror.js) - Utilidades de items y texturas

### Archivos del Sistema de Encantamientos
- [enchantsConfig.js](./enchants/enchantsConfig.js) - Configuración de encantamientos (a crear)
- [enchantsHelpers.js](./enchants/enchantsHelpers.js) - Utilidades (toRoman, validación) (a crear)
- [enchantsSelectionMenu.js](./enchants/enchantsSelectionMenu.js) - Menú de selección (a crear)
- [enchantsApplicationMenu.js](./enchants/enchantsApplicationMenu.js) - Menú de niveles y desencantamiento (a crear)

### Documentación Externa
- [ChestFormData](../../chestui/forms.js) - Clase base para UI de cofre
- [Minecraft Script API Reference](https://learn.microsoft.com/minecraft/creator/scriptapi/)
- [README.md de upgrades](../README.md) - Especificación general del sistema



