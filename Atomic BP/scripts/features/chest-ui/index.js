import { world } from "@minecraft/server";
import { ChestFormData } from "./chestui/forms.js";

function primaryMenu(player) {
new ChestFormData("large")
    .title("§l§5Primary Menu")
    .button(
      21,
      "§l§6Test Item 1",
      ["", "§r§7A testing item"],
      "minecraft:magma_cream",
      14
    )
    .button(
      22,
      "§l§nTest Item 2",
      ["", "§r§7Another item"],
      "minecraft:enchanted_golden_apple",
      1,
      0,
      true
    )
    .button(
      23,
      "§l§bTest Item 3",
      ["", "§r§7A third item"],
      "minecraft:diamond_chestplate",
      1,
      0,
      false
    )
    .button(
      4,
      "§l§cNo deberia existir",
      ["", "§r§7xd"],
      "minecraft:jamaica",
      1,
      0,
      true
    )
    .button(
      45,
      "§l§6OPEN FURNACE MENU!",
      ["", "§r§7Check out the furnace UI!"],
      "minecraft:coal",
      1,
      0,
      true
    )
    .pattern(
      ["_________", "__xxxxx__", "__x___x__", "__x___x__", "__xxxxx__"],
      {
        x: {
          itemName: { rawtext: [{ text: "Pattern" }] },
          itemDesc: ["§7This is a pattern!"],
          enchanted: false,
          stackAmount: 1,
          texture: "textures/blocks/glass_pane_top_gray",
        },
      }
    )
    .show(player)
    .then((response) => {
      if (response.canceled) return;
      world.sendMessage(`${player.name} has chosen item ${response.selection}`);
    });
}

// Exporta una función de inicialización
export function initChestUi() {
  world.afterEvents.itemUse.subscribe((evd) => {
    if (!evd.itemStack) return;

    const item = evd.itemStack;
    if (item.typeId !== "minecraft:compass") return;

    // Requiere que el compás esté renombrado exactamente a "§5Test"
    if (String(item.nameTag != null ? item.nameTag : "") !== "§5Test") return;

    primaryMenu(evd.source);
  });
}