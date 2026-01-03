import { world } from "@minecraft/server";

const COOLDOWN_SECONDS = 30;
const REQUIRED_OBJECTIVE = "TEST";

/** @type {Map<string, number>} */
const lastUseMsByPlayer = new Map();

function getPlayerKey(player) {
    // id es más estable que name; usa fallback por compat.
    try {
        if (player && player.id) return String(player.id);
        if (player && player.name) return String(player.name);
    } catch (e) {
        void e;
    }
    return "unknown";
}

function getScore(player, objectiveId) {
    const objective = world.scoreboard.getObjective(objectiveId);
    if (!objective) return null;

    const identity = player.scoreboardIdentity;
    if (!identity) return null;

    try {
        return objective.getScore(identity);
    } catch (e) {
		void e;
        return null;
    }
}

function getHeldItemDisplay(player) {
    const invComp = player && typeof player.getComponent === "function" ? player.getComponent("inventory") : null;
    const inv = invComp ? invComp.container : null;
    if (!inv) return "nada";

    const slot = player.selectedSlotIndex;
    const item = inv.getItem(slot);
    if (!item) return "nada";

    const customName = String(item && item.nameTag != null ? item.nameTag : "").trim();
    if (customName.length > 0) return customName;

    // Bedrock Script API no expone directamente el nombre localizado (depende del idioma del cliente).
    // Fallback: convertir minecraft:diamond_sword -> Diamond Sword.
    const typeId = item && item.typeId != null ? item.typeId : "";
    const shortName = typeId.includes(":") ? typeId.split(":")[1] : typeId;
    return shortName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
}

/**
 * Handler del comando show. Mantiene su propio cooldown y validaciones.
 * @param {import("@minecraft/server").CustomCommandOrigin} origin
 */
export function handleShowCommand(origin) {
    const player = origin.sourceEntity;
    if (!player) return;

    const rawScore = getScore(player, REQUIRED_OBJECTIVE);
    const score = rawScore != null ? rawScore : 0;
    if (score < 1) {
        player.sendMessage(`§cNo cumples el requisito: ${REQUIRED_OBJECTIVE} >= 1`);
        return;
    }

    const key = getPlayerKey(player);
    const now = Date.now();
    const last = lastUseMsByPlayer.has(key) ? lastUseMsByPlayer.get(key) : 0;
    const elapsedSeconds = (now - last) / 1000;
    const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);

    if (remaining > 0) {
        player.sendMessage(`§cTienes que esperar ${remaining}s...`);
        return;
    }

    lastUseMsByPlayer.set(key, now);

    const display = getHeldItemDisplay(player);
    world.sendMessage(`§f${player.name} esta sosteniendo [${display}§r§f]§r`);
}