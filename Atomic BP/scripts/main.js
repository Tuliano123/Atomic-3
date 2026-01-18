import { initAllScoreboards } from "./scoreboards/index.js";
import { initInventorySaves } from "./features/inventory/saves.js";
import { initChestUi } from "./features/chest-ui/index.js";
import { initAntiCheat } from "./features/anticheat/index.js";
import { initCommands } from "./modules/commands/index.js";
import { initSkillRegeneration } from "./features/skills/regeneration/index.js";
import { skillRegenConfig } from "./features/skills/regeneration/config.js";
import { initCustomEmojis } from "./features/custom-emojis/index.js";
import { initCustomItems } from "./features/custom-items/index.js";
import { customItemsConfig } from "./features/custom-items/config.js";
import { initHolograms } from "./features/holograms/index.js";
import { hologramsConfig } from "./features/holograms/config.js";
import { initDamageCalc } from "./features/skills/calc/index.js";
import { damageCalcConfig } from "./features/skills/calc/config.js";
import { initVanillaDamageCancel } from "./features/skills/combat/damageCancel/index.js";
import { initCombatHealth } from "./features/skills/combat/health/index.js";
import { initDamageDealt } from "./features/skills/combat/damage_dealt/index.js";
import { initDamageTitle } from "./features/skills/combat/damage_title/index.js";
import { initAchievements } from "./features/achievements/index.js";
import { initDeathSystem } from "./systems/death/index.js";
import deathConfig from "./systems/death/config.js";
import { initSpawnpointsSystem } from "./systems/spawnpoints/index.js";
import spawnpointsConfig from "./systems/spawnpoints/config.js";

initAllScoreboards();
initChestUi();
initCommands();
initAntiCheat();
initCustomEmojis();
initCustomItems(customItemsConfig);
initHolograms(hologramsConfig);
initSkillRegeneration(skillRegenConfig);
initVanillaDamageCancel();
initCombatHealth();
initDamageCalc(damageCalcConfig);
initDamageTitle();
initDamageDealt({ debug: false });
initAchievements();
initDeathSystem(deathConfig);
initSpawnpointsSystem(spawnpointsConfig);
initInventorySaves({
    slots: 10,
    loopTicks: 5,
    keyPrefix: "atomic3:inv:"
});