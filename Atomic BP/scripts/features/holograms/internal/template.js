// Parsing y render de templates con placeholders tipo ${OBJ:participant}

const PLACEHOLDER_RE = /\$\{([^:}]+):([^}]+)\}/g;

export function hasPlaceholders(template) {
	if (typeof template !== "string") return false;
	PLACEHOLDER_RE.lastIndex = 0;
	return PLACEHOLDER_RE.test(template);
}

export function parseTemplate(template) {
	const src = typeof template === "string" ? template : "";
	/** @type {Array<any>} */
	const tokens = [];
	let lastIndex = 0;
	PLACEHOLDER_RE.lastIndex = 0;

	for (;;) {
		const m = PLACEHOLDER_RE.exec(src);
		if (!m) break;
		const start = m.index;
		const end = m.index + m[0].length;

		if (start > lastIndex) {
			tokens.push({ type: "text", value: src.slice(lastIndex, start) });
		}

		const objective = String(m[1] != null ? m[1] : "").trim();
		const participant = String(m[2] != null ? m[2] : "").trim();

		tokens.push({
			type: "score",
			objective,
			participant,
			raw: m[0],
			key: `${objective}:${participant}`,
		});

		lastIndex = end;
	}

	if (lastIndex < src.length) {
		tokens.push({ type: "text", value: src.slice(lastIndex) });
	}

	return tokens;
}

export function listScoreRefs(tokens) {
	/** @type {Array<{ objective: string, participant: string, key: string }>} */
	const out = [];
	for (const t of Array.isArray(tokens) ? tokens : []) {
		if (!t || t.type !== "score") continue;
		if (!t.objective || !t.participant) continue;
		out.push({ objective: t.objective, participant: t.participant, key: t.key });
	}
	return out;
}
