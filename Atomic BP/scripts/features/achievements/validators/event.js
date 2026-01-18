const eventStore = new Map();

function getKey(player) {
	try {
		return player?.id ? String(player.id) : null;
	} catch (e) {
		void e;
		return null;
	}
}

export function emitAchievementEvent(player, eventId, data = undefined) {
	const key = getKey(player);
	if (!key || !eventId) return;
	const list = eventStore.get(key) ?? [];
	list.push({ id: String(eventId), tick: Date.now(), data });
	// Mantener lista acotada
	if (list.length > 50) list.splice(0, list.length - 50);
	eventStore.set(key, list);
}

export function validateEventCondition(player, condition) {
	const key = getKey(player);
	if (!key) return false;
	const list = eventStore.get(key);
	if (!list || list.length === 0) return false;

	const eventId = String(condition?.event ?? "");
	const withinMs = Math.max(0, Number(condition?.withinMs ?? 5000));
	const now = Date.now();

	for (let i = list.length - 1; i >= 0; i--) {
		const ev = list[i];
		if (!ev) continue;
		if (eventId && ev.id !== eventId) continue;
		if (withinMs === 0) return true;
		if (now - ev.tick <= withinMs) return true;
	}

	return false;
}

export function clearExpiredEvents(maxAgeMs = 15000) {
	const now = Date.now();
	for (const [key, list] of eventStore) {
		const filtered = list.filter((ev) => now - ev.tick <= maxAgeMs);
		if (filtered.length) eventStore.set(key, filtered);
		else eventStore.delete(key);
	}
}
