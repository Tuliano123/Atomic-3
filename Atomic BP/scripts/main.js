import { initInventorySaves } from "./features/inventory/saves.js";
import { initChestUi } from "./features/chest-ui/index.js";
import { initAntiCheat } from "./features/anticheat/index.js";
import { initCommands } from "./modules/commands/index.js";
import { initMiningRegen } from "./features/mining/regeneration/index.js";
import { miningRegenConfig } from "./features/mining/regeneration/config.js";

initChestUi();
initCommands();
initAntiCheat();
initMiningRegen(miningRegenConfig);
initInventorySaves({
    slots: 10,
    loopTicks: 5,
    keyPrefix: "atomic3:inv:"
});
