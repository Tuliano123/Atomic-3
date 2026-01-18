function stripColorCodes(text) {
	return String(text ?? "").replace(/§./g, "");
}

function visibleLength(text) {
	return stripColorCodes(text).length;
}

export function wrapVisibleWords(text, maxVisible) {
	const raw = String(text ?? "");
	const words = raw.split(/\s+/).filter(Boolean);
	if (words.length === 0) return "";

	const lines = [];
	let current = "";
	let currentLen = 0;

	for (const word of words) {
		const wordLen = visibleLength(word);
		if (!current) {
			current = word;
			currentLen = wordLen;
			continue;
		}

		const nextLen = currentLen + 1 + wordLen;
		if (nextLen <= maxVisible) {
			current += " " + word;
			currentLen = nextLen;
			continue;
		}

		// mover palabra a nueva línea (no cortar)
		lines.push(current);
		current = word;
		currentLen = wordLen;
	}

	if (current) lines.push(current);
	return lines.join("\n");
}

function extractIndent(text) {
	const raw = String(text ?? "");
	const match = raw.match(/^(\s+)/);
	return match ? match[1] : "";
}

export function wrapVisibleText(text, maxVisible) {
	const raw = String(text ?? "");
	const indent = extractIndent(raw);
	const trimmed = raw.trimStart();
	if (!trimmed) return raw;
	const wrapped = wrapVisibleWords(trimmed, Math.max(1, Number(maxVisible ?? 25) - visibleLength(indent)));
	if (!indent) return wrapped;
	return wrapped
		.split("\n")
		.map((line) => indent + line)
		.join("\n");
}

export function buildAchievementMessage({
	variant,
	name,
	description,
	currentTotal,
	totalCount,
	maxVisibleChars,
}) {
	const v = variant || {};
	const safeMax = Math.max(1, Number(maxVisibleChars ?? 25));

	const nameText = String(name ?? "");
	const rawDesc = String(description ?? "");
	const descWithColor = rawDesc.startsWith("§") ? rawDesc : `§f${rawDesc}`;

	const wrappedName = wrapVisibleText(nameText, safeMax);
	const wrappedDesc = wrapVisibleText(descWithColor, safeMax);

	const prev = Math.max(0, Number(currentTotal) - 1);
	const total = Math.max(0, Number(totalCount));

	const progress = String(v.progress ?? "");
	const progressLine = progress
		.replace(/<LogrosActuales-1>/g, String(prev))
		.replace(/<LogrosActuales>/g, String(currentTotal))
		.replace(/<LogrosTotales>/g, String(total));

	const lines = [
		String(v.separator ?? ""),
		String(v.header ?? ""),
		wrappedName,
		wrappedDesc,
		"",
		String(v.rewardsHeader ?? ""),
		progressLine,
		"   Obtener logros provocara",
		"   una mejora permanente",
		"   en los :heart:",
		String(v.footer ?? ""),
	];

	return lines.join("\n");
}

export function buildTellrawJson(message) {
	const text = String(message ?? "");
	return JSON.stringify({ rawtext: [{ text }] });
}
