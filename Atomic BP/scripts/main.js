import { initInventorySaves } from "./features/inventory/saves.js";
import { initChestUi } from "./features/chest-ui/index.js";
import { initAntiCheat } from "./features/anticheat/index.js";
import { initCommands } from "./modules/commands/index.js";
import { initSkillRegeneration } from "./features/skills/regeneration/index.js";
import { skillRegenConfig } from "./features/skills/regeneration/config.js";
import { initCustomEmojis } from "./features/custom-emojis/index.js";
import { initCustomItems } from "./features/custom-items/index.js";
import { customItemsConfig } from "./features/custom-items/config.js";

initChestUi();
initCommands();
initAntiCheat();
initCustomEmojis();
initCustomItems(customItemsConfig);
initSkillRegeneration(skillRegenConfig);
initInventorySaves({
    slots: 10,
    loopTicks: 5,
    keyPrefix: "atomic3:inv:"
});
